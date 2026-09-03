import Foundation
import HealthKit

private let observationEnabledKey = "moodHealth.observationEnabled.v1"
private let readRequestCompletedKey = "moodHealth.readRequestCompleted.v1"

@available(iOS 18.0, *)
final class MoodHealthObserver {
  static let shared = MoodHealthObserver()

  private let healthStore = HKHealthStore()
  private let defaults = UserDefaults.standard
  private var observerQuery: HKObserverQuery?
  private var eventSink: (([String: Any]) -> Void)?
  private var backgroundState = "disabled"
  private var observerErrorCode: String?
  private var backgroundErrorCode: String?
  private var revision: UInt64 = 0
  private var configurationInProgress = false
  private var pendingConfigurationCompletions: [([String: Any]) -> Void] = []
  private let snapshotLock = NSLock()
  private var latestSnapshot: [String: Any]

  private init() {
    latestSnapshot = [
      "enabled": UserDefaults.standard.bool(forKey: observationEnabledKey),
      "observing": false,
      "backgroundDelivery": "disabled",
      "revision": 0
    ]
  }

  static var wasReadAuthorizationRequested: Bool {
    UserDefaults.standard.bool(forKey: readRequestCompletedKey)
  }

  static func markReadAuthorizationRequested() {
    UserDefaults.standard.set(true, forKey: readRequestCompletedKey)
  }

  static var shouldRestoreAtLaunch: Bool {
    UserDefaults.standard.bool(forKey: observationEnabledKey) && wasReadAuthorizationRequested
  }

  func setEventSink(_ sink: (([String: Any]) -> Void)?) {
    dispatchPrecondition(condition: .onQueue(.main))
    eventSink = sink
  }

  func status() -> [String: Any] {
    // Synchronous Expo calls run on the JS queue. Read a published snapshot
    // instead of synchronously dispatching to main and risking a JS/UI deadlock.
    if !Thread.isMainThread {
      snapshotLock.lock()
      defer { snapshotLock.unlock() }
      return latestSnapshot
    }
    dispatchPrecondition(condition: .onQueue(.main))
    var result: [String: Any] = [
      "enabled": defaults.bool(forKey: observationEnabledKey),
      "observing": observerQuery != nil,
      "backgroundDelivery": backgroundState,
      "revision": NSNumber(value: revision)
    ]
    if let errorCode = observerErrorCode ?? backgroundErrorCode { result["errorCode"] = errorCode }
    snapshotLock.lock()
    latestSnapshot = result
    snapshotLock.unlock()
    return result
  }

  func start(completion: @escaping ([String: Any]) -> Void) {
    dispatchPrecondition(condition: .onQueue(.main))
    guard Self.wasReadAuthorizationRequested else {
      completion([
        "enabled": false,
        "observing": false,
        "backgroundDelivery": "disabled",
        "revision": NSNumber(value: revision),
        "errorCode": "ERR_MOOD_HEALTH_READ_REQUEST_REQUIRED"
      ])
      return
    }
    defaults.set(true, forKey: observationEnabledKey)
    ensureObserverQuery()
    configureBackgroundDelivery(completion: completion)
  }

  func restoreAtLaunch() {
    dispatchPrecondition(condition: .onQueue(.main))
    guard Self.shouldRestoreAtLaunch else { return }
    ensureObserverQuery()
    configureBackgroundDelivery { _ in }
  }

  func stop(completion: @escaping ([String: Any]) -> Void) {
    dispatchPrecondition(condition: .onQueue(.main))
    defaults.set(false, forKey: observationEnabledKey)
    if let observerQuery {
      healthStore.stop(observerQuery)
      self.observerQuery = nil
    }
    observerErrorCode = nil
    configureBackgroundDelivery(completion: completion)
  }

  func appDidBecomeActive() {
    dispatchPrecondition(condition: .onQueue(.main))
    guard defaults.bool(forKey: observationEnabledKey) else { return }
    ensureObserverQuery()
    emitChange(reason: "foreground")
  }

  private func ensureObserverQuery() {
    dispatchPrecondition(condition: .onQueue(.main))
    guard observerQuery == nil else { return }
    let query = HKObserverQuery(sampleType: HKObjectType.stateOfMindType(), predicate: nil) { [weak self] query, completion, error in
      DispatchQueue.main.async {
        // The native background work is an in-memory invalidation only. No health
        // samples are fetched here; a foreground consumer always reads afresh.
        // Acknowledge even errors/stale callbacks, including before JS exists.
        defer { completion() }
        guard let self, self.defaults.bool(forKey: observationEnabledKey), self.observerQuery === query else { return }
        if let error {
          self.observerErrorCode = self.safeErrorCode(error, operation: "OBSERVER")
          self.healthStore.stop(query)
          self.observerQuery = nil
          self.emitChange(reason: "error")
          return
        }
        self.observerErrorCode = nil
        self.emitChange(reason: "changed")
      }
    }
    observerQuery = query
    _ = status()
    healthStore.execute(query)
  }

  private func configureBackgroundDelivery(completion: @escaping ([String: Any]) -> Void) {
    dispatchPrecondition(condition: .onQueue(.main))
    pendingConfigurationCompletions.append(completion)
    _ = status()
    reconcileBackgroundDelivery()
  }

  private func reconcileBackgroundDelivery() {
    dispatchPrecondition(condition: .onQueue(.main))
    guard !configurationInProgress else { return }
    configurationInProgress = true
    let enabled = defaults.bool(forKey: observationEnabledKey)
    let type = HKObjectType.stateOfMindType()
    let result: (Bool, Error?) -> Void = { [weak self] success, error in
      DispatchQueue.main.async {
        guard let self else { return }
        self.configurationInProgress = false
        let stillEnabled = self.defaults.bool(forKey: observationEnabledKey)
        guard stillEnabled == enabled else {
          // A newer start/stop won. Reapply the latest desired system state so an
          // older asynchronous completion cannot leave background delivery stale.
          self.reconcileBackgroundDelivery()
          return
        }
        if success {
          self.backgroundState = enabled ? "enabled" : "disabled"
          self.backgroundErrorCode = nil
        } else {
          self.backgroundState = "unavailable"
          self.backgroundErrorCode = self.safeErrorCode(error, operation: "BACKGROUND_DELIVERY")
        }
        let callbacks = self.pendingConfigurationCompletions
        self.pendingConfigurationCompletions.removeAll()
        let settledStatus = self.status()
        callbacks.forEach { $0(settledStatus) }
      }
    }
    if enabled {
      backgroundState = "disabled"
      _ = status()
      healthStore.enableBackgroundDelivery(for: type, frequency: .immediate, withCompletion: result)
    } else {
      healthStore.disableBackgroundDelivery(for: type, withCompletion: result)
    }
  }

  private func emitChange(reason: String) {
    revision &+= 1
    _ = status()
    var event: [String: Any] = ["reason": reason, "revision": NSNumber(value: revision)]
    if reason == "error", let observerErrorCode { event["errorCode"] = observerErrorCode }
    eventSink?(event)
  }

  private func safeErrorCode(_ error: Error?, operation: String) -> String {
    guard let nsError = error as NSError?, nsError.domain == HKErrorDomain else {
      return "ERR_MOOD_HEALTH_\(operation)"
    }
    switch nsError.code {
    case HKError.Code.errorAuthorizationDenied.rawValue,
         HKError.Code.errorAuthorizationNotDetermined.rawValue,
         HKError.Code.errorRequiredAuthorizationDenied.rawValue:
      return "ERR_MOOD_HEALTH_AUTHORIZATION_REQUIRED"
    case HKError.Code.errorDatabaseInaccessible.rawValue:
      return "ERR_MOOD_HEALTH_PROTECTED_DATA_UNAVAILABLE"
    case HKError.Code.errorHealthDataRestricted.rawValue:
      return "ERR_MOOD_HEALTH_RESTRICTED"
    case HKError.Code.errorHealthDataUnavailable.rawValue:
      return "ERR_MOOD_HEALTH_UNAVAILABLE"
    case HKError.Code.errorInvalidArgument.rawValue:
      return "ERR_MOOD_HEALTH_CONFIGURATION"
    default:
      return "ERR_MOOD_HEALTH_\(operation)"
    }
  }
}
