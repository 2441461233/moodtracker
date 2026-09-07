# MoodWidgets

可选的 iOS Expo 模块。`setCalendarSnapshot(json: string | null)` 将本地每日心情汇总原子写入 App Group，或在传入 `null` 时删除摘要，然后请求 WidgetKit 刷新大号日历。

主 App 和 `QuickRecordWidget` 扩展必须同时签入 `group.com.zhenyu.moodjournal.app.widgets`。小组件只接收 `src/lib/widget-calendar.ts` 生成的版本化汇总，不读取主日记库或 Apple 健康。

Expo Go、Web 和 Android 使用空操作降级。详见 [小组件说明](../../docs/ios-widgets.md)。
