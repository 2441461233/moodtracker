import ExpoModulesCore
import Foundation
import HealthKit

private struct StateOfMindInput: Record {
  @Field var syncIdentifier: String = ""
  @Field var syncVersion: Double = 0
  @Field var timestamp: Double = -1
  @Field var valence: Double = .nan
  @Field var kind: String = ""
  @Field var associations: [String] = []
}

public final class MoodHealthModule: Module {
  private let healthStoreLock = NSLock()
  private var storedHealthStore: HKHealthStore?
  // Construct the store only after a public entry point has checked availability.
  // The lock also makes first access from JS and asynchronous module queues safe.
  private var healthStore: HKHealthStore {
    healthStoreLock.lock()
    defer { healthStoreLock.unlock() }
    if let store = storedHealthStore { return store }
    let store = HKHealthStore()
    storedHealthStore = store
    return store
  }
  private var authorizationInProgress = false
  private let writeQueue = DispatchQueue(label: "com.zhenyu.moodjournal.health-writes")
  private var pendingWrites: [(@escaping () -> Void) -> Void] = []
  private var writeInProgress = false

  public func definition() -> ModuleDefinition {
    Name("MoodHealth")

    Function("getAvailability") { () -> [String: Any] in
      self.availability()
    }

    Function("getWriteAuthorization") { () -> String in
      self.writeAuthorization()
    }

    AsyncFunction("requestAuthorization") { (read: Bool, write: Bool, promise: Promise) in
      guard #available(iOS 18.0, *), HKHealthStore.isHealthDataAvailable() else {
        promise.resolve(["requestCompleted": false, "writeAuthorization": "notDetermined"])
        return
      }
      guard read || write else {
        promise.resolve(["requestCompleted": false, "writeAuthorization": self.writeAuthorization()])
        return
      }
      guard !self.authorizationInProgress else {
        promise.reject("ERR_MOOD_HEALTH_AUTHORIZATION_IN_PROGRESS", "健康授权窗口已经打开，请先完成当前请求。")
        return
      }
      guard (!read || self.hasUsageDescription("NSHealthShareUsageDescription")),
            (!write || self.hasUsageDescription("NSHealthUpdateUsageDescription")) else {
        promise.reject("ERR_MOOD_HEALTH_CONFIGURATION", "此构建缺少 Apple 健康的授权用途说明。")
        return
      }
      let type = HKObjectType.stateOfMindType()
      let shareTypes: Set<HKSampleType> = write ? [type] : []
      let readTypes: Set<HKObjectType> = read ? [type] : []
      self.authorizationInProgress = true
      self.healthStore.requestAuthorization(toShare: shareTypes, read: readTypes) { completed, error in
        DispatchQueue.main.async {
          self.authorizationInProgress = false
          if let error {
            self.rejectHealthError(error, operation: "AUTHORIZATION", promise: promise)
            return
          }
          // `completed` does not reveal read authorization, even when it is true.
          promise.resolve(["requestCompleted": completed, "writeAuthorization": self.writeAuthorization()])
        }
      }
    }.runOnQueue(.main)

    AsyncFunction("queryStateOfMind") { (startMs: Double, endMs: Double, limit: Double, promise: Promise) in
      guard #available(iOS 18.0, *), HKHealthStore.isHealthDataAvailable() else {
        self.rejectUnavailable(promise)
        return
      }
      guard startMs.isFinite, endMs.isFinite, startMs >= 0, endMs <= 8.64e15, endMs > startMs,
            endMs - startMs <= 366 * 86_400_000,
            limit.isFinite, limit.rounded(.down) == limit, limit >= 1, limit <= 5000 else {
        promise.reject("ERR_MOOD_HEALTH_INVALID_INPUT", "每次最多读取 366 天、5000 条记录，请检查时间范围和数量。")
        return
      }
      // Read denial is deliberately indistinguishable from no matching data.
      // Never check write permission as a proxy for read permission.
      let start = Date(timeIntervalSince1970: startMs / 1000)
      let end = Date(timeIntervalSince1970: endMs / 1000)
      let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
        HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate),
        NSPredicate(format: "%K < %@", HKPredicateKeyPathStartDate, end as NSDate)
      ])
      let ownBundle = HKSource.default().bundleIdentifier
      let query = HKSampleQuery(
        sampleType: HKObjectType.stateOfMindType(),
        predicate: predicate,
        limit: Int(limit),
        sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
      ) { _, samples, error in
        if let error {
          self.rejectHealthError(error, operation: "QUERY", promise: promise)
          return
        }
        var result: [[String: Any]] = []
        for case let sample as HKStateOfMind in samples ?? [] {
          let kind: String
          switch sample.kind {
          case .momentaryEmotion: kind = "momentaryEmotion"
          case .dailyMood: kind = "dailyMood"
          @unknown default:
            // Do not silently relabel a new Apple kind as a known kind.
            promise.reject("ERR_MOOD_HEALTH_UNSUPPORTED_KIND", "发现此版本暂不支持的 Apple 健康情绪类型，请更新应用。")
            return
          }
          let source = sample.sourceRevision.source
          result.append([
            "uuid": sample.uuid.uuidString,
            "timestamp": sample.startDate.timeIntervalSince1970 * 1000,
            "kind": kind,
            "valence": sample.valence,
            "labels": sample.labels.map { $0.rawValue },
            "associations": sample.associations.map { $0.rawValue },
            "sourceName": source.name,
            "sourceBundleId": source.bundleIdentifier,
            "isFromThisApp": source.bundleIdentifier == ownBundle
          ])
        }
        promise.resolve(result)
      }
      self.healthStore.execute(query)
    }

    AsyncFunction("saveStateOfMind") { (input: StateOfMindInput, promise: Promise) in
      guard #available(iOS 18.0, *), HKHealthStore.isHealthDataAvailable() else {
        self.rejectUnavailable(promise)
        return
      }
      guard input.syncIdentifier.hasPrefix("moodtracker:"), input.syncIdentifier.utf16.count > 12,
            input.syncIdentifier.utf16.count <= 200,
            input.syncIdentifier.rangeOfCharacter(from: .controlCharacters) == nil,
            input.syncVersion.isFinite, input.syncVersion >= 1,
            input.syncVersion <= 9_007_199_254_740_991,
            input.syncVersion.rounded(.down) == input.syncVersion,
            input.timestamp.isFinite, input.timestamp >= 0,
            input.timestamp <= Date().timeIntervalSince1970 * 1000,
            input.valence.isFinite, (-1.0...1.0).contains(input.valence),
            input.kind == "momentaryEmotion", input.associations.count <= 13 else {
        promise.reject("ERR_MOOD_HEALTH_INVALID_INPUT", "情绪记录的同步标识、版本、时间或愉悦度无效。")
        return
      }
      var associations: [HKStateOfMind.Association] = []
      for name in input.associations {
        guard let association = self.association(named: name) else {
          promise.reject("ERR_MOOD_HEALTH_INVALID_INPUT", "记录包含不支持的 Apple 健康关联类型。")
          return
        }
        if !associations.contains(association) { associations.append(association) }
      }
      // Serialize complete read/compare/save operations, not just callback dispatch.
      // This also returns the persisted UUID for duplicate submissions.
      self.enqueueWrite { finished in
        self.performSave(input, associations: associations, promise: promise, finished: finished)
      }
    }
  }

  private func availability() -> [String: Any] {
    guard #available(iOS 18.0, *) else { return ["available": false, "reason": "ios_version"] }
    guard HKHealthStore.isHealthDataAvailable() else { return ["available": false, "reason": "health_data_unavailable"] }
    return ["available": true, "reason": "available"]
  }

  private func writeAuthorization() -> String {
    guard #available(iOS 18.0, *), HKHealthStore.isHealthDataAvailable() else { return "notDetermined" }
    switch healthStore.authorizationStatus(for: HKObjectType.stateOfMindType()) {
    case .notDetermined: return "notDetermined"
    case .sharingDenied: return "denied"
    case .sharingAuthorized: return "authorized"
    @unknown default: return "notDetermined"
    }
  }

  private func hasUsageDescription(_ key: String) -> Bool {
    guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else { return false }
    return !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  private func rejectUnavailable(_ promise: Promise) {
    promise.reject("ERR_MOOD_HEALTH_UNAVAILABLE", "此设备或系统版本暂不支持 Apple 健康情绪记录。")
  }

  private func rejectHealthError(_ error: Error, operation: String, promise: Promise) {
    let code = (error as NSError).code
    if (error as NSError).domain == HKErrorDomain,
       code == HKError.Code.errorAuthorizationDenied.rawValue || code == HKError.Code.errorAuthorizationNotDetermined.rawValue {
      promise.reject("ERR_MOOD_HEALTH_AUTHORIZATION_REQUIRED", "Apple 健康访问权限不足，请在系统健康设置中检查授权。")
    } else {
      // Do not log health data or include samples/metadata in error messages.
      promise.reject("ERR_MOOD_HEALTH_\(operation)", "Apple 健康暂时无法完成此操作，请解锁设备后重试。")
    }
  }

  private func enqueueWrite(_ operation: @escaping (@escaping () -> Void) -> Void) {
    writeQueue.async {
      self.pendingWrites.append(operation)
      self.runNextWrite()
    }
  }

  private func runNextWrite() {
    guard !writeInProgress, !pendingWrites.isEmpty else { return }
    writeInProgress = true
    let operation = pendingWrites.removeFirst()
    operation {
      self.writeQueue.async {
        self.writeInProgress = false
        self.runNextWrite()
      }
    }
  }

  @available(iOS 18.0, *)
  private func association(named name: String) -> HKStateOfMind.Association? {
    switch name {
    case "work": return .work
    case "friends": return .friends
    case "family": return .family
    case "partner": return .partner
    case "fitness": return .fitness
    case "health": return .health
    case "hobbies": return .hobbies
    case "education": return .education
    case "identity": return .identity
    case "community": return .community
    case "currentEvents": return .currentEvents
    case "travel": return .travel
    case "dating": return .dating
    default: return nil
    }
  }

  @available(iOS 18.0, *)
  private func findOwnSample(syncIdentifier: String, completion: @escaping (Result<HKStateOfMind?, Error>) -> Void) {
    let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
      HKQuery.predicateForObjects(withMetadataKey: HKMetadataKeySyncIdentifier, allowedValues: [syncIdentifier]),
      HKQuery.predicateForObjects(from: HKSource.default())
    ])
    let query = HKSampleQuery(sampleType: HKObjectType.stateOfMindType(), predicate: predicate, limit: 1, sortDescriptors: nil) { _, samples, error in
      if let error { completion(.failure(error)); return }
      completion(.success(samples?.first as? HKStateOfMind))
    }
    healthStore.execute(query)
  }

  @available(iOS 18.0, *)
  private func sampleMatches(_ sample: HKStateOfMind, input: StateOfMindInput, associations: [HKStateOfMind.Association]) -> Bool {
    return sample.kind == .momentaryEmotion
      && abs(sample.startDate.timeIntervalSince1970 * 1000 - input.timestamp) < 1
      && sample.valence == input.valence
      && sample.labels.isEmpty
      && Set(sample.associations.map { $0.rawValue }) == Set(associations.map { $0.rawValue })
  }

  @available(iOS 18.0, *)
  private func performSave(_ input: StateOfMindInput, associations: [HKStateOfMind.Association], promise: Promise, finished: @escaping () -> Void) {
    guard writeAuthorization() == "authorized" else {
      promise.reject("ERR_MOOD_HEALTH_AUTHORIZATION_REQUIRED", "尚未获得写入情绪记录的权限，请先明确授权。")
      finished()
      return
    }
    findOwnSample(syncIdentifier: input.syncIdentifier) { result in
      switch result {
      case .failure(let error):
        self.rejectHealthError(error, operation: "SAVE", promise: promise)
        finished()
      case .success(let existing):
        if let existing, let version = (existing.metadata?[HKMetadataKeySyncVersion] as? NSNumber)?.doubleValue,
           version >= input.syncVersion {
          let matches = version == input.syncVersion && self.sampleMatches(existing, input: input, associations: associations)
          if matches {
            promise.resolve(["uuid": existing.uuid.uuidString])
          } else {
            promise.reject("ERR_MOOD_HEALTH_SYNC_CONFLICT", "健康中已有更新版本，或同一版本内容不同。请刷新记录并使用新的递增版本。")
          }
          finished()
          return
        }
        let sample = HKStateOfMind(
          date: Date(timeIntervalSince1970: input.timestamp / 1000),
          kind: .momentaryEmotion,
          valence: input.valence,
          labels: [],
          associations: associations,
          metadata: [
            HKMetadataKeySyncIdentifier: input.syncIdentifier,
            HKMetadataKeySyncVersion: NSNumber(value: Int64(input.syncVersion))
          ]
        )
        self.healthStore.save(sample) { saved, error in
          if let error {
            self.rejectHealthError(error, operation: "SAVE", promise: promise)
            finished()
            return
          }
          guard saved else {
            promise.reject("ERR_MOOD_HEALTH_SAVE", "Apple 健康尚未确认保存成功，请重试。")
            finished()
            return
          }
          // HealthKit can deduplicate a save without persisting this in-memory UUID.
          // Read the persisted object instead of reporting a phantom identifier.
          self.findOwnSample(syncIdentifier: input.syncIdentifier) { confirmed in
            switch confirmed {
            case .success(let persisted):
              if let persisted,
                 let version = (persisted.metadata?[HKMetadataKeySyncVersion] as? NSNumber)?.doubleValue,
                 version == input.syncVersion,
                 self.sampleMatches(persisted, input: input, associations: associations) {
                promise.resolve(["uuid": persisted.uuid.uuidString])
              } else {
                promise.reject("ERR_MOOD_HEALTH_SAVE_UNVERIFIED", "保存结果暂时无法核实。请保留本地记录，稍后使用同一版本重试。")
              }
            case .failure:
              promise.reject("ERR_MOOD_HEALTH_SAVE_UNVERIFIED", "保存结果暂时无法核实。请保留本地记录，稍后使用同一版本重试。")
            }
            finished()
          }
        }
      }
    }
  }
}
