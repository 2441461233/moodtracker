import ExpoModulesCore
import Foundation
import WidgetKit

public final class MoodWidgetsModule: Module {
  private let snapshotQueue = DispatchQueue(label: "com.zhenyu.moodjournal.widget-snapshot")

  public func definition() -> ModuleDefinition {
    Name("MoodWidgets")

    AsyncFunction("setCalendarSnapshot") { (json: String?) in
      guard let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.com.zhenyu.moodjournal.app.widgets"
      ) else {
        throw NSError(domain: "MoodWidgets", code: 1, userInfo: [
          NSLocalizedDescriptionKey: "此构建未配置小组件共享空间。"
        ])
      }
      let file = container.appendingPathComponent("calendar-v1.json")
      if let json {
        let data = Data(json.utf8)
        guard data.count <= 32768 else {
          throw NSError(domain: "MoodWidgets", code: 2, userInfo: [
            NSLocalizedDescriptionKey: "小组件日历摘要过大。"
          ])
        }
        if (try? Data(contentsOf: file)) == data {
          // Also recovers a timeline that was read before the first device unlock.
          WidgetCenter.shared.reloadTimelines(ofKind: "MoodCalendarWidget")
          return
        }
        try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        var protectedFile = file
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try protectedFile.setResourceValues(values)
      } else if FileManager.default.fileExists(atPath: file.path) {
        try FileManager.default.removeItem(at: file)
      } else {
        return
      }
      WidgetCenter.shared.reloadTimelines(ofKind: "MoodCalendarWidget")
    }.runOnQueue(snapshotQueue)
  }
}
