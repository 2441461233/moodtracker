# iOS 桌面小组件

新增原生 WidgetKit 扩展，包含两张独立卡片，已随 **2.1.4（8）** 发布到原内部 TestFlight 测试组。Expo Go、网页和 JS 热更新不能添加这些小组件。

## 正式发布结果（2026-09-07）

- 2.1.4（8）的生产构建、严格 IPA 验签和上传均已完成；2026-09-07 14:09 UTC，原「个人测试组」已显示「正在测试」，测试员页面显示已安装。
- 主 App 和内嵌 `QuickRecordWidget.appex` 均为 2.1.4（8）；实际签名、内嵌 profiles、Team / Bundle ID / App Group、签名证书及版本全部匹配。主 App 保留 HealthKit / Background Delivery，扩展没有 HealthKit。
- 同一应用源码 `9125c45f101d4c8e29c233c10c8800254cf19cb5` 的原生 CI 和 EAS 生产构建均实际编译成功。完整构建 ID、IPA 摘要与 TestFlight 证据见 [iOS 发布记录](ios-release.md)。
- 小组件在真实 iPhone 上的视觉、深链接和摘要刷新仍待用户验收；后台安装状态不能替代这些测试。

## 开发阶段的模拟器验证（2026-09-07）

- `npm run verify` 通过：TypeScript、195 项业务 / 配置回归、Web 导出与 19 项网页测试，共 214 项测试。
- 全新 prebuild 与重复 prebuild 的实际工程检查通过；两个 Widget Swift 源码、单次扩展嵌入、构建依赖、URL Scheme、App Group 配置和版本匹配均已核对。MoodWidgets 自动链接、Swift 语法解析、Plist 和 shell 检查通过。
- [EAS 模拟器构建 b80a9152](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/b80a9152-fc03-4942-ac26-35dc285f8aef) 于 2026-09-07 09:53:17 UTC 完成，状态 `FINISHED`，使用隔离的当前源码快照，编译了 App、MoodWidgets 模块和 WidgetKit 扩展。
- 已下载并检查实际 `.app`：存在 `PlugIns/QuickRecordWidget.appex` 与可执行文件，二进制含 `QuickRecordWidget` / `MoodCalendarWidget` 和两条链接入口。主 App 与扩展实际均为 **2.1.3（2）**、最低 iOS 15.1；构建页面的远端元数据显示 build 7，不能替代模拟器产物的实际 Info.plist。
- 模拟器压缩包 19,018,075 字节，SHA-256：`7b131d8491018436bd63a7b453b3a8d2560f4ade19c42422e66fbfc006c9a237`。本机严格 codesign 完整性检查通过。该模拟器产物是 ad hoc 签名、签名 entitlement 为空，**不能验证真机 App Group 签名或实际摘要读写**；之后的正式 2.1.4（8）已另行完成双 target profiles 和 IPA 签名核验。
- 以上为发布前模拟器验证，WidgetKit 真机视觉和交互仍待验收；正式发布结果见上方。

## 使用

1. 安装新版后打开「情绪像素」一次，让本地日历摘要写入共享空间。
2. 长按 iPhone 主屏幕空白处，选择添加小组件，搜索「情绪像素」。
3. 添加小号「快速记录」和大号「心情日历」，拖到需要的位置。也可放在最左侧「今天」视图；App 无法替用户自动摆放桌面卡片。

- **快速记录 / 小号**：点击打开「记录这一刻」弹框。冷启动等待本地存储与导航准备完成；后台恢复同样有效。已经在填写或编辑时保留当前输入。
- **心情日历 / 大号**：周一开始的公历月历，展示当天心情的颜色、本月记录天数和今日轮廓。多条记录采用与 App 本地日历相同的日均分与四舍五入方式。点击日期进入该日的本地记录，并清除会隐藏当天记录的旧搜索 / 心情筛选。
- 保存、修改、删除、导入以及回到前台时更新摘要并请求系统刷新。WidgetKit 决定实际刷新时间。月历预先生成未来七天的本地午夜时间线，支持跨月 / 跨年与夏令时。
- 若已有未保存记录，点击日历只切换它背后的页面，继续保留记录弹框；关闭后可查看日历。

## 本地数据

大卡片标明「本地心情」。共享的 `calendar-v1.json` 只含当前月和上个月的日期、每日心情档位和条数；不包含记录 ID、文字、活动、称呼或 Apple 健康样本。Apple 健康保持现有只在前台内存展示的边界。

摘要保存在 App 和扩展专用的 App Group `group.com.zhenyu.moodjournal.app.widgets`，原子替换、排除设备备份，并使用首次解锁后可访问的文件保护。不会传到服务器。读取日记出错时移除摘要，清空记录时用空摘要覆盖旧数据。完整日记仍使用原有 AsyncStorage 存储。

## 构建与签名

- `plugins/with-quick-record-widget.js` 在 Expo prebuild 时复制 `native/QuickRecordWidget`，创建并嵌入 `QuickRecordWidget.appex`。小卡片与日历共用这个扩展 target。
- 主 App 与扩展都需要上述 App Group。扩展 Bundle ID 为 `com.zhenyu.moodjournal.app.QuickRecordWidget`，最低 iOS 15.1；iOS 17+ 使用系统小组件背景与边距。
- `modules/mood-widgets` 是独立的本地 Expo 模块，串行写入摘要并调用 `WidgetCenter.reloadTimelines`，不会访问 HealthKit。
- 插件写入 EAS appExtensions 元数据。生产构建使用本地签名：主 App profile `JHW9QHZK8M` 已重新生成并加入 App Group，扩展使用独立 profile `G4LLTV5L8F`，两者复用原分发证书。本地凭据已按 `app` / `QuickRecordWidget` 多 target 格式配置并加入 Git 忽略范围；旧单 target 配置不能直接签这个版本。
- 扩展的版本号 / build 取自 Expo config，与主 App 的实际 Info.plist 保持一致，避免误用 Xcode 模板的 1.0 / 1。

参考：[Expo 扩展与签名声明](https://docs.expo.dev/build-reference/app-extensions/)、[多 target 本地凭据](https://docs.expo.dev/app-signing/local-credentials/#multi-target-project)、[Apple 小组件内的页面链接](https://developer.apple.com/documentation/widgetkit/linking-to-specific-app-scenes-from-your-widget-or-live-activity)、[WidgetCenter](https://developer.apple.com/documentation/widgetkit/widgetcenter)。

## 验证

业务与网页回归：`npm run verify`。原生工程生成后执行：

```bash
node scripts/verify-widget-project.mjs ios/app.xcodeproj
```

脚本检查实际生成工程的扩展嵌入、两份 Swift 源码、URL Scheme、App Group、版本号和构建依赖。重复 prebuild 后再次运行，可确认没有重复 target / 嵌入。

`scripts/verify-ios.sh` 已加入扩展工程检查、MoodWidgets 自动链接检查，以及编译后 `.appex` 可执行文件检查。必须在有完整 Xcode / iOS SDK 的环境运行。当前工作电脑只有 Command Line Tools，Swift 语法解析与工程生成检查不能替代 Xcode 编译。

真机待验收：添加两种尺寸；浅色 / 深色 / 着色模式与大字体；小卡片的冷启动、后台恢复、已有草稿、关闭其他弹框；日历点击、重复点击同一天、月末与跨年、保存 / 修改日期 / 删除最后一条 / 导入后刷新；首次解锁前后的摘要恢复。主 App / 扩展签名和 TestFlight 分发已独立确认，尚未完成上述真机功能验收。
