import ExpoModulesCore
import HealthKit
import UIKit

public final class MoodHealthAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Register before JavaScript starts, including when HealthKit wakes the app.
    // Merely installing or launching the app never enables health observation.
    if #available(iOS 18.0, *), HKHealthStore.isHealthDataAvailable(), MoodHealthObserver.shouldRestoreAtLaunch {
      MoodHealthObserver.shared.restoreAtLaunch()
    }
    return true
  }

  public func applicationDidBecomeActive(_ application: UIApplication) {
    if #available(iOS 18.0, *), HKHealthStore.isHealthDataAvailable(), MoodHealthObserver.shouldRestoreAtLaunch {
      MoodHealthObserver.shared.appDidBecomeActive()
    }
  }
}
