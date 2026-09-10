# iOS 2.1.11 发布与原生验收

## 本次发布：2.1.11（17），录音回听生命周期修复

2026-09-10：针对第三步结束录音后退出 App 的反馈，修复播放器释放后仍执行暂停，以及录音到回听的音频模式切换竞态。改为原声保留完成、播放模式切换结束后再展示回听；播放器创建失败可恢复，仍可保存与导出原声。详细证据及真机日志的限制见 [闪退排查](voice-stop-crash-2026-09-10.md)。

- 正式应用源码 `9d2d5e4c95dc1391e2ec022701d64b00a6ed92b8`，版本 **2.1.11（17）**。[EAS 构建 45f6eae1](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/45f6eae1-adbb-4b9d-99d0-179dcf36158d) 于 **06:31:49.096 UTC** 完成为 `FINISHED`。后续主分支仅更改测试、服务和文档，未改变该包的生产应用代码。
- 主 App / 小组件严格验签、描述文件证书匹配、应用组、版本与麦克风说明均通过校验；保留已确认的宫格微笑图标。SDK `iphoneos26.2`、最低 iOS 15.1、未开启后台音频。安装包 **11,975,856 字节**，SHA-256 `a300a73e9695546c5418ecbf46b0ba83d65591f75cbf25db67e8d48c61754ed4`。见 [包内校验](../artifacts/native-voice-2.1.11/ipa-validation.json)。
- TypeScript、224 项应用测试、7 项服务测试、19 项网页检查与生产 Web 导出通过，共 250 项测试。播放器六项生命周期回归在旧版全部失败，在修复版全部通过。
- [最终原生回归 34449531455](https://github.com/2441461233/moodtracker/actions/runs/34449531455) 于 **07:40:20 UTC** 成功：iPhone 17 Pro / iOS 26.2 模拟器的浅色、深色、实际录音暂停续录 / 结束 / 播放 / 切换文字 / 保存 / 再打开三条流程全部通过，0 失败、0 跳过。原生截图已人工复核输入框与保存按钮完整可见，见 [XCTest 摘要](../artifacts/native-voice-2.1.11/native-ui-summary.json)、[浅色键盘](../artifacts/native-voice-2.1.11/light-keyboard.png)、[深色键盘](../artifacts/native-voice-2.1.11/dark-keyboard.png)和 [保存后回听](../artifacts/native-voice-2.1.11/native-saved-recording.png)。
- [网页部署 34449531412](https://github.com/2441461233/moodtracker/actions/runs/34449531412) 等待同一提交 `e3d03972eb70f71dad99b25e8675b99a5e7d07be` 的原生检查成功后，于 **07:40:42 UTC** 完成。线上版本 2.1.11，脚本 `index-361f4544358eb2a0f3794705f64fa9ef.js` 与本地导出逐字节一致，SHA-256 `b6790fb2514dc185780721784d017e0c01fd211a9be8813605bbf9b6a7b9703a`。
- [EAS 上传 137819d0](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/137819d0-8cd5-440c-ad44-4b9a8fa07117) 于 **07:43:03.104 UTC** 为 `FINISHED`；独立读取确认关联版本、构建和源码精确匹配。复用 EAS 托管 API 密钥，无需用户填写专用密码。
- **07:46 UTC，Apple 官方 API 确认 2.1.11（17）为 `VALID`、`IN_BETA_TESTING`、未过期，并已关联原「个人测试组」，自动通知保持开启。** ASC build `f8757e73-8801-4c12-b9d6-f00fe9119fe6`，见 [分发核验](../artifacts/native-voice-2.1.11/apple-distribution.json)。通过 **TestFlight → 情绪像素 → 更新** 覆盖安装，保留原 App / 组 / 测试员。
- 中文测试说明已通过 Apple 官方 API 保存并回读核对一致，包含录音、暂停续录、结束、回听、切换文字、保存与重新打开的复测步骤；见 [测试说明](../artifacts/native-voice-2.1.11/testflight-notes.txt)。无需浏览器重新登录或重建凭据。
- 真机反馈的 2.1.10（16）/ iOS 26.6.1 日志为 React 原生模块异常传播中的 `SIGABRT`，没有具体异常文本。旧版模拟器则复现了释放后调用暂停并退出；触发时机与最终崩溃签名不同，不能把它直接认定为用户那次闪退的唯一原因。新包仍需在用户 iPhone 上复测结束录音。
- 云端转写部署文件与生产启动验证已完成，尚未取得线上主机 / HTTPS 地址及原开发机供应商 key；本次 App 更新不代表云端转写已接通。无签名模拟器的 SecureStore 读取失败路径已覆盖，真实签名包钥匙串和云端供应商调用仍待验收。

## 上一版本：2.1.10（16），语音记录与键盘修复已在原内部 TestFlight 可更新

2026-09-10：拉取用户的远端语音实现 `0f821a65b94f6f80cfd253f2e3ee0d6543f58cfb`，升级到 2.1.10，并修复人工截图复核发现的键盘遮挡正文问题。最终应用源码为 `aa004ea003c5d805254e0fb841f4123832a564b8`，继续发布到原 TestFlight「个人测试组」。

- 第三步默认语音，支持录音、暂停续录、本机保存、回听、单独导出和文字补充；配置独立服务后支持云端转写、AI 整理、识别原文保留与手动修改。
- 键盘出现或弹层可视区改变后，以实际滚动视口定位正在编辑的输入框，避免被固定保存栏遮住；定位只操作滚动和 ref，不随键盘重绘整张表单。收键盘使用固定尺寸图标，修复原按钮截字。原生测试新增输入框完整位于滚动视口及保存按钮上方的断言。
- 修复后 `npm run verify` 通过：TypeScript、216 项应用测试、5 项服务测试、19 项网页测试和 Web 导出，共 240 项。
- [EAS 构建 9693a73a](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/9693a73a-d09a-42af-9abe-5c0e70b5ee21)于 **2026-09-10 02:59:07.564 UTC** 为 `FINISHED`，版本 **2.1.10（16）**、源码精确匹配上述提交。
- 02:59:43 UTC 已核验此确切 IPA：主 App 与 `QuickRecordWidget.appex` 均通过严格验签，名称、版本 / build、Bundle ID / Team / App Group、profile 证书匹配；App Store 分发、`get-task-allow=false`。HealthKit / Background Delivery、URL scheme、加密声明保留；最低 iOS 15.1，SDK `iphoneos26.2`。
- 已确认中文麦克风用途说明，主二进制包含 ExpoAudio / AudioModule、ExpoSecureStore / SecureStoreModule；没有后台音频模式。品牌图逐字节匹配已确认素材，桌面图标已解码查看。
- 正式 IPA 为 **11,974,913 字节**，SHA-256：`cb14b5f9a7e6682fadf739656d581f2bb617429a712c0b75c0abd1b38dc63f41`。
- 最终[原生验收 34431244763](https://github.com/2441461233/moodtracker/actions/runs/34431244763)于 **03:12:44 UTC** 成功：iPhone 17 Pro / iOS 26.2 模拟器运行 Release App，浅色和深色两条录入测试通过，0 失败、0 跳过。新增输入框处于实际视口和保存按钮上方的断言通过；原始截图已人工确认正文、保存按钮和收键盘按钮完整可见。见 [深色截图](../artifacts/native-voice-2.1.10/dark-keyboard-fixed.png)、[浅色截图](../artifacts/native-voice-2.1.10/light-keyboard-fixed.png)和 [XCTest 摘要](../artifacts/native-voice-2.1.10/native-ui-summary.json)。
- [网页部署 34431244735](https://github.com/2441461233/moodtracker/actions/runs/34431244735)等待上述同一提交原生门槛后，于 **03:12:59 UTC** 成功。线上版本 2.1.10，脚本 `index-576bba0df5b4aed1d4af2cb134a428ab.js` 的 SHA-256 为 `0d03ab28e6074bfb6f04af7e1a38f4ae0a4d74114f2220c687d073f475f641ec`。
- [EAS 上传 eb806f12](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/eb806f12-2d53-4551-87c2-846b395d8bf3)于 **03:16:12.353 UTC** 为 `FINISHED`；独立读取确认关联构建、版本 / build 和源码均精确匹配。复用现有 EAS 托管 API 密钥，无需专用密码。
- **03:19 UTC，Apple 官方 API 确认 2.1.10（16）为 `VALID`、`IN_BETA_TESTING`，未过期，并关联原「个人测试组」，自动通知保持开启。** ASC build ID：`a8eff28a-7aa5-41a4-a962-74c3d0eda9af`。可通过 **TestFlight → 情绪像素 → 更新** 覆盖安装；未新增测试组或测试员。
- 中文测试说明已整理为 [测试说明文件](../artifacts/native-voice-2.1.10/testflight-notes.txt)，**未保存到 Apple 后台**：官方 API 写入返回 HTTP 405，浏览器登录已过期。构建分发已经通过官方 API 独立核实，测试说明保存失败不影响现有内部组安装；没有重复上传或要求重新创建凭据。
- **云端转写后端尚未接通确认。** 原开发电脑的 `server/.env` 没有同步到这台发布电脑，当前也未取得已部署 HTTPS 地址；录音功能发布不代表云端转写已可用。服务配置入口及边界见 [语音说明](voice-recording.md)。
- 真实麦克风采集、真机回听、云端转写及 iPhone 实际键盘流畅度尚待测试；不以模拟器文字流程或包内模块存在代替这些验收。

### 候选 2.1.10（15）记录：未上传 TestFlight

2026-09-10：按用户要求拉取远端语音实现 `0f821a65b94f6f80cfd253f2e3ee0d6543f58cfb`，将版本更新为 2.1.10，继续发布到原 TestFlight「个人测试组」。

- **候选 2.1.10（15）未上传。** 自动保存流程虽通过，但人工复核原生截图发现键盘打开后正文输入框被上方内容挤出可视区。已增加键盘显示 / 可视区变化后的焦点输入框滚动定位，避免额外表单重绘；收键盘使用固定尺寸图标，修复文字截断。原生回归新增输入框完整处于滚动视口及保存按钮上方的断言。以下候选（15）的验签和 CI 证据不能代替修复后构建的验证。
- 第三步默认语音，支持录音、暂停续录、原声本机保存、回听、单独导出和文字补充；配置服务后可上传转写、AI 整理、保留识别原文并手动修改。加入 ExpoAudio / ExpoSecureStore 和麦克风用途说明，需要完整原生包。
- `npm ci` 和 `npm run verify` 已通过：216 项应用测试、5 项服务测试、19 项网页测试，共 240 项，以及 TypeScript 与 Web 导出。
- 候选（15）的源码为 `88c6a91e75255d81dbb00fbf47c1fe37de4a5aa0`，版本号由 app.json 统一显示。原语音实现的[原生检查 34364619184](https://github.com/2441461233/moodtracker/actions/runs/34364619184)已成功；候选提交的原生运行门槛已通过，但因人工截图发现问题未上传。
- [EAS 构建 81ba84ac](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/81ba84ac-c1ec-4a24-953a-9f7294607871)为 `FINISHED`，于 **2026-09-10 02:33:50.040 UTC** 完成，版本 **2.1.10（15）**，源码精确匹配上述提交。
- 02:35:22 UTC 已核验实际 IPA：主 App 和 `QuickRecordWidget.appex` 均通过严格验签；版本、名称、Bundle ID / Team / App Group、证书与 profile 匹配，App Store 分发、`get-task-allow=false`；HealthKit / Background Delivery、URL scheme、加密声明保留。最低 iOS 15.1，SDK `iphoneos26.2`，满足本轮核对的 [Apple SDK 26 最低要求](https://developer.apple.com/news/upcoming-requirements/?id=02032026a)。
- 包内具有中文 `NSMicrophoneUsageDescription`，主二进制包含 ExpoAudio / AudioModule 及 ExpoSecureStore / SecureStoreModule；未开启后台音频模式。品牌图与已确认素材逐字节一致，桌面图标已解码查看。
- IPA 为 **11,974,396 字节**，SHA-256：`5473ce92b3035c2ed33366b51fb2595a1b4bb4429e7408cb58757cd5b08e4ef6`。
- [发布提交原生检查 34429611522](https://github.com/2441461233/moodtracker/actions/runs/34429611522)于 **02:47:13 UTC** 成功，编译并运行 iOS 模拟器 Release App。报告为两条流程通过，但人工截图复核发现正文不可见，见 [候选截图](../artifacts/native-voice-2.1.10/candidate-15-keyboard.png)。
- [网页部署 34429611501](https://github.com/2441461233/moodtracker/actions/runs/34429611501)等待同一提交的原生门槛后，于 **02:47:41 UTC** 成功。线上脚本确认为 2.1.10，PWA 图标和 favicon 与本地导出逐字节一致。
- **转写后端尚未完成本次线上配置确认。** 文档中的开发机 `server/.env` 不在当前机器，GitHub Secrets 也没有这份配置；尚未取得已部署的 HTTPS 服务地址。录音 / 回听与独立后端分开验证，不能把 App 发布称为云端转写已经接通。详情见 [语音记录说明](voice-recording.md)。
- iOS 模拟器流程覆盖默认语音入口、文字输入、键盘与保存，不等于已验证真实麦克风、真机回听或云端转写。

## 上一版本：2.1.9（14），原生按钮修复已在原内部 TestFlight 可更新

2026-09-09：修复用户截图中的「继续」按钮下半部发白、文字被遮挡问题。共享渐变组件改用独立背景层和原生实际宽高，首帧保留底色，尺寸不变时不重复更新。覆盖继续、保存及保存修改按钮；保留笔记输入、状态订阅、切步与后台动画的性能优化。设置页版本号直接读取配置，避免再显示旧版本。

- 应用源码：`9d5f828cd412bfcdf919196a1ad1a409a0f95b7e`。`npm run verify` 和云端相同提交检查均通过：207 项应用 / 原生配置 / 存储 / 组件测试及 19 项网页测试，共 226 项。
- [最终原生验收 34342120308](https://github.com/2441461233/moodtracker/actions/runs/34342120308)于 **11:06:43 UTC** 成功：iPhone 17 Pro / iOS 26.2 模拟器实际运行 Release App，浅色、深色两条完整录入流程通过，0 失败、0 跳过。包括未选心情禁用、继续、活动、系统键盘上的保存、笔记往返保留和最终保存入列表。按钮上下两处像素断言及人工截图复核通过，见 [原生修复与验收](native-button-regression-2026-09-09.md)。
- [网页流水线 34342120345](https://github.com/2441461233/moodtracker/actions/runs/34342120345)等待上述原生门槛后，于 **11:06:55 UTC** 完成部署。线上设置页已核实 2.1.9，无浏览器运行错误。原生失败或超时会阻止网页部署。
- [EAS 构建 75ccded4](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/75ccded4-9bb1-41f2-a377-1e64ae8d2c92)于 **10:44:30.877 UTC** 完成，为 **2.1.9（14）**，源码与上述提交精确一致。
- 正式 IPA 已严格验签：主 App 与小组件均为 2.1.9（14），Bundle ID / Team / App Group、App Store 分发和 profile 证书匹配；保留原 HealthKit / Background Delivery、URL scheme 与加密声明。最低 iOS 15.1，SDK `iphoneos26.2`。包内已确认的中央笑脸与橙色圆点图标已查看，品牌图逐字节一致。
- IPA 为 **11,775,143 字节**，SHA-256：`cec0ebf58529c1d367ea18e90ee64e28c2da2c7a62ba019ca82b2cffbb787077`。
- 仅在上述两套同一提交检查成功后提交。[EAS 上传 0761694b](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/0761694b-4ddf-487c-bbfd-61efb95032fb)于 **11:20:30.629 UTC** 为 `FINISHED`；App ID、构建、版本和源码均精确匹配，复用现有 EAS 托管的发布密钥。
- **11:24:28 UTC，Apple 官方 API 已核实 2.1.9（14）为 `VALID`、`IN_BETA_TESTING`，未过期，关联原[「个人测试组」](https://appstoreconnect.apple.com/teams/93dd1b91-a79c-4c54-8ba3-0dd5bf8bc33a/apps/6776595613/testflight/groups/c3a1a107-7438-48ac-802c-e9634d77ba5a/builds)。** ASC build ID：`11d16384-daa2-4bff-956a-c5bfcf13f961`。保留原内部组与自动通知设置，未新增测试组、测试员或 App。
- **11:31 UTC**，该构建的中文测试说明已在 App Store Connect 显示「已保存」，包含按钮修复、原生录入与键盘回归结果；页面同时确认原「个人测试组」仍为内部组、1 个测试员。
- 原始 [浅色继续截图](../artifacts/native-button-2.1.9/light-continue.png)、[深色键盘保存截图](../artifacts/native-button-2.1.9/dark-keyboard-save.png)及 [XCTest 摘要](../artifacts/native-button-2.1.9/native-ui-summary.json)已归档。截图来自最终发布提交，未裁切或编辑，使用合成测试数据。
- 边界：无签名模拟器覆盖真实原生布局、键盘和本地保存，但没有签名 App Group，不能验收小组件实际同步；正式包权限与签名已另行验证。真实 iPhone 帧率、触感、健康授权及小组件实际同步仍需签名真机环境，未冒充已经完成。

## 上一版本：2.1.8（12），交互性能优化与随后发现的按钮回归

2026-09-09：按用户要求合入「优化心情记录交互流畅度」任务的改动，继续发布到原内部 TestFlight「个人测试组」。沿用已确认的中央笑脸与右上橙色圆点图标、现有签名身份和可复用 EAS 发布密钥。

- 笔记输入与字数独立更新，切步使用稳定的弹窗高度；拆分全局状态订阅，减少无关页面刷新、后台动画和重复统计 / 读取。
- 未改变日记格式，保留完整草稿、立即保存、失败重试、重复提交与存储冲突保护。细节与浏览器渲染对照见 [交互性能验证](interaction-performance-2026-09-09.md)。
- 发布前 `npm run verify` 已通过：TypeScript、204 项应用 / 原生配置 / 存储测试、Web 导出和 19 项网页测试，共 223 项。
- 应用源码提交 `105056c29c98bc1d5ed9972854aaaf45fd1d1f4b` 的[网页部署 34336769802](https://github.com/2441461233/moodtracker/actions/runs/34336769802)已成功，2026-09-09 09:49 UTC 完成；线上脚本已确认版本 2.1.8，PWA 图标和 favicon 与本地导出逐字节一致。
- [EAS 正式构建 ef0b6942](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/ef0b6942-6734-4796-be70-153e949c25f1)为 `FINISHED`，2026-09-09 **09:53:11.312 UTC** 完成，版本 **2.1.8（12）**，源码精确匹配上述提交。
- 09:53:47 UTC 已核验该确切 IPA：主 App 和 `QuickRecordWidget.appex` 均通过严格验签，版本 / build、名称、Team / Bundle ID / App Group 正确；签名证书与各自 profile 匹配，App Store 分发、`get-task-allow=false`。主 App 保留 HealthKit / Background Delivery、原 URL scheme 和加密声明，扩展无 HealthKit；SDK `iphoneos26.2`，最低 iOS 15.1。
- 实际包内桌面图标已解码查看，确认为已确认的中央笑脸与橙色圆点，品牌图与生产资产逐字节一致。IPA 为 **11,773,148 字节**，SHA-256：`3591d4007cad6caf5450b5df3f6aa2e445bc71c381b5721ba2d3fbf24ff9697a`。
- 独立[原生 CI 34336769759](https://github.com/2441461233/moodtracker/actions/runs/34336769759)已成功，2026-09-09 09:58 UTC 完成，实际编译主 App、HealthKit 模块与小组件。
- [EAS 上传任务 ed88abff](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/ed88abff-3c5a-4188-81fe-0e9de4eb47dd)已独立核实为 `FINISHED`，2026-09-09 **09:59:56.909 UTC** 完成；关联 App ID、构建 ID、版本 / build 和源码提交精确匹配。直接复用 EAS 托管密钥，无需再输入专用密码。
- **2026-09-09 10:03 UTC，已在[原「个人测试组」](https://appstoreconnect.apple.com/teams/93dd1b91-a79c-4c54-8ba3-0dd5bf8bc33a/apps/6776595613/testflight/groups/c3a1a107-7438-48ac-802c-e9634d77ba5a/builds)核实 2.1.8（12）「正在测试」、90 天后过期。** ASC build ID `85aeaec8-5d13-40b8-bcc1-c722cecfacd8`，详情页保留原内部组及 1 个测试员，已完成 Apple 处理与分发。
- 10:04 UTC，[该构建的测试说明](https://appstoreconnect.apple.com/teams/93dd1b91-a79c-4c54-8ba3-0dd5bf8bc33a/apps/6776595613/testflight/ios/85aeaec8-5d13-40b8-bcc1-c722cecfacd8)已显示「已保存」，覆盖中文 / emoji 输入、切步、键盘、立即保存 / 失败重试，以及升级后记录、健康连接和小组件检查。
- iPhone 的中文输入法、键盘升降、原生标签冻结恢复与实际帧率仍待真机试用；浏览器渲染计数不能替代真机性能验收。

## 上一版本：2.1.7（11），正确图标已在原内部 TestFlight 可更新

2026-09-09：用户截图明确要求「中间米黄色格子内有小笑脸，右上角为橙色圆点」的款式。已找到匹配原图 `artifacts/icon-concepts-2026-09-09/grid-smile-refined/a-center-light.png`，源图 SHA-256 为 `40fb3b69d669a15d01579f17d6b7265e0655952a68ddb8fb4346c3e169a6b70e`。参考截图归档为 `approved-reference.png`，最终选择和生产资产哈希记录在同目录的 `selection.json`。

- 直接从原图导出 App 1024 px、品牌 128 px、PWA 512 px 资源，无重新设计；图案位置、橙色圆点、中心表情和配色以截图为准。
- 本轮纠正 2.1.6 的素材选择错误，其他应用逻辑不变；沿用现有 App、签名、原「个人测试组」及已配置的 EAS 发布密钥。
- `npm run verify` 已通过：类型检查、201 项应用 / 原生配置测试、Web 导出及 19 项网页测试，共 220 项。
- 应用源码提交 `d9f279c1b09a529a6cf85a214296c45e9cf15249` 的[网页部署 34322658619](https://github.com/2441461233/moodtracker/actions/runs/34322658619)已成功，完成于 2026-09-09 07:13 UTC。线上 PWA 图标、favicon 和品牌图标的 SHA-256 与本地导出完全一致，浏览器已确认运行版本 2.1.7。
- [EAS 正式构建 075beda4](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/075beda4-d4ad-40e8-9be5-61b00f811622)为 `FINISHED`，完成于 **2026-09-09 07:16:48.747 UTC**，版本 **2.1.7（11）**，源码精确匹配上述提交。
- 07:18:49 UTC 已核验该确切 IPA：主 App 和 `QuickRecordWidget.appex` 均通过严格验签，版本 / build、显示名称、Team / Bundle ID / App Group 正确；签名证书与各自 profile 匹配，App Store 分发、`get-task-allow=false`。主 App 保留 HealthKit / Background Delivery、原 URL scheme 和加密声明，扩展无 HealthKit。最低 iOS 15.1，SDK `iphoneos26.2`。
- 安装包内桌面图标已解码查看，确认为用户截图对应的中央笑脸与橙色圆点；包内品牌图与正确生产资产逐字节一致。IPA 为 **11,770,012 字节**，SHA-256：`29fe4f5827b778ead80ee79e8547d733c98eaf7bc942e731e52031bcd8a13e89`。
- 独立[原生 CI 34322658637](https://github.com/2441461233/moodtracker/actions/runs/34322658637)已成功，完成于 2026-09-09 07:22 UTC，实际编译主 App、HealthKit 和小组件。
- [EAS 上传任务 8dbb5279](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/8dbb5279-fb2e-4685-bb50-418faf3596f6)已独立核实为 `FINISHED`，完成于 **2026-09-09 07:19:36.968 UTC**；关联版本 / build、App ID、构建 ID 和源码提交精确匹配。直接复用 EAS 托管密钥成功上传，无需再次输入专用密码。
- **2026-09-09 07:22 UTC，已在[原「个人测试组」](https://appstoreconnect.apple.com/teams/93dd1b91-a79c-4c54-8ba3-0dd5bf8bc33a/apps/6776595613/testflight/groups/c3a1a107-7438-48ac-802c-e9634d77ba5a/builds)核实 2.1.7（11）「正在测试」、90 天后过期。** ASC build ID `75d117e0-1e23-4ac7-a25d-59d7132172ce`，已完成 Apple 处理与内部组分发。版本 2.1.6 的错误图标由本次 2.1.7 修正，用户应更新到 2.1.7（11）。
- 实际 iPhone 的升级、桌面图标刷新、记录 / 设置保留以及小组件交互仍待用户验收。
- 07:23 UTC，[该构建的测试说明](https://appstoreconnect.apple.com/teams/93dd1b91-a79c-4c54-8ba3-0dd5bf8bc33a/apps/6776595613/testflight/ios/75d117e0-1e23-4ac7-a25d-59d7132172ce)已显示「已保存」，明确标注正确图标款式、目标版本和升级验收内容。

## 上一版本：2.1.6（10），已分发，但用户指出图标选错

2026-09-09：此版本将用户的方案编号误解为 C「弯眼微笑」，完成分发后，用户提供截图指出应使用中央笑脸与右上橙色圆点款式；纠正版本见上方 2.1.7。以下保留 2.1.6 的真实构建与分发记录。

- 生产图标已更新为等大九宫格与弯眼微笑，主 App 图标 1024 px、网页标识 128 px、PWA 图标 512 px；均为 RGB PNG，无透明通道。
- 上一个图标提交 `44f992182f2d967e10061e2d88988622addcd44b` 的[网页 CI 与部署](https://github.com/2441461233/moodtracker/actions/runs/34320145442)成功，线上三类图标的 SHA-256 已与本地发布文件核对一致。
- 本次安装包将继续包含 2.1.5 的产品名称、启动画面修复与两种小组件；日记存储键、已有权限和签名身份保持兼容。
- 发布前 `npm run verify` 已通过：类型检查、201 项应用 / 原生配置测试、Web 导出及 19 项网页测试，共 220 项。
- 应用源码提交为 `2f16240ae0e8f983948927e18bec07376ec7c6f5`。[EAS 正式构建 f27c8a44](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/f27c8a44-266d-461f-85ea-d07adc88c0c3)为 `FINISHED`，完成于 2026-09-09 06:55:08.243 UTC，版本 **2.1.6（10）**，源码与此提交精确匹配。
- 06:55:41 UTC 已下载并核验确切 IPA：主 App 和 `QuickRecordWidget.appex` 均通过 `codesign --verify --deep --strict`，名称、Bundle ID、Team、App Group、版本与 build 正确；实际签名证书存在于各自 profile。两份 profile 均为 App Store 分发、`get-task-allow=false`、2027-09-03 到期；主 App 保留 HealthKit / Background Delivery，扩展无 HealthKit。SDK `iphoneos26.2`，最低 iOS 15.1。
- 实际安装包的桌面图标已解码查看，确认为 C「弯眼微笑」；包内品牌图与本地发布资产逐字节一致。IPA 为 **11,807,830 字节**，SHA-256：`e8b0e158b00f8d1da83b7a0cba70e27961ac4c98c535ca507c2d68648996cf20`。
- 首次网页 CI 因旧观察器重试测试的固定 45 ms 等待竞态失败；提交 `7440c27c61f118737d6b1ba99bd4195dc02817f4` 仅修正该测试为逐次推进模拟定时器，明确检查三次恢复及重试上限。本地 201 项应用测试通过，[网页回归与部署 34321286339](https://github.com/2441461233/moodtracker/actions/runs/34321286339)也已成功；安装包应用源码不受这条测试修订影响。
- [EAS 上传任务 8b66d040](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/8b66d040-426c-464c-a594-07603b35e678)已独立核实为 `FINISHED`，完成于 **2026-09-09 07:04:05.353 UTC**。关联 App ID、构建 ID、版本 / build 和源码提交均精确匹配；本次使用 EAS 已托管的 API 密钥，无需专用密码。
- **2026-09-09 07:07 UTC，已在[原「个人测试组」](https://appstoreconnect.apple.com/teams/93dd1b91-a79c-4c54-8ba3-0dd5bf8bc33a/apps/6776595613/testflight/groups/c3a1a107-7438-48ac-802c-e9634d77ba5a/builds)核实 2.1.6（10）「正在测试」、90 天后过期。** ASC build ID `8df1ba31-95f8-455e-99db-0c9cece31751`，上传时间 15:04（北京时间）。原组仍为 1 个测试员、自动分发开启，未新增 App、测试组或测试员。
- 该构建的测试说明包含新图标、启动背景衔接、升级后记录 / 设置保留及两种小组件的真机验收。TestFlight 分发已完成；真实 iPhone 升级和交互仍待用户验收。
- 独立[模拟器原生 CI 34321286357](https://github.com/2441461233/moodtracker/actions/runs/34321286357)已成功，完成于 2026-09-09 07:09 UTC；实际编译主 App、HealthKit 和小组件。测试修订仅改变测试文件，未改变已上传的应用源码。

## 上一安装包：2.1.5（9），正式构建、安装包核验与上传完成

2026-09-08：用户确认采用第三款彩色像素图标，产品名称统一为「情绪像素」，并要求重新打包发布。主 App、界面、PWA 图标及小组件显示名称已同步；启动页改为与首页匹配的浅深色纯色背景，等本地记录、设置及首屏布局完成后再进入界面。

- 发布前 `npm run verify` 已通过：TypeScript、201 项应用 / 原生配置测试、Web 导出及 19 项网页测试，共 220 项。
- 主 App 与小组件沿用原 Bundle ID / Team / App Group，日记存储键与备份标识不变。
- 已检查生成的 iOS 图标为 1024 px RGB PNG，无 alpha 通道；与获选素材导出逐像素一致。启动 storyboard 使用匹配浅深色资产的命名颜色，不含残留图片或悬空图片约束。
- 应用源码已推送到 `main`，提交 `90b9d7f782a67143df0038be3f8440159f1dfd87`；[网页回归与部署](https://github.com/2441461233/moodtracker/actions/runs/34182662458)和同一提交的[独立原生编译](https://github.com/2441461233/moodtracker/actions/runs/34182662460)均成功。
- [2.1.5（9）正式 EAS 构建](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/7a344efe-8af7-486d-a672-acf8904c65db)状态 `FINISHED`，完成于 2026-09-08 03:16:25 UTC，源码精确匹配上述提交。
- 已下载该确切 IPA，主 App 和 `QuickRecordWidget.appex` 均通过 `codesign --verify --deep --strict`。实际显示名称为「情绪像素」和「情绪像素小组件」，均为 **2.1.5（9）**、最低 iOS 15.1、SDK `iphoneos26.2`；签名证书存在于各自内嵌 profile 中，Team / Bundle ID / App Group 一致，均为 App Store 分发且 `get-task-allow=false`。主 App 保留 HealthKit / Background Delivery、原 URL scheme 和加密声明，扩展不含 HealthKit。
- 实际 IPA 中的图标已解码查看，确认为选定的第三款像素图标。IPA 为 11,779,670 字节，SHA-256：`a37e59b264c5167f249ccfe52e99f5f87916d99160b5ec92422b93bb198d04ee`。
- Apple 后台已重新登录，原 App `6776595613` 的简体中文名称已保存为「情绪像素」。用户确认只发布到原内部「个人测试组」，未提交 App Store 公开审核。
- 2026-09-09 补充核实：[EAS 上传任务 71cc3b6f](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/71cc3b6f-7cbc-4252-9fad-eb1bb7c4aaec)为 `FINISHED`，完成于 2026-09-08 03:42:55.688 UTC；本机上传日志同样确认 App Store Connect 已接收。账号所有者已完成一次性上传验证，凭据未保存。同日重新登录后，已在原「个人测试组」确认 **2.1.5（9）「正在测试」**、89 天后过期；ASC build ID `8e329727-a1ad-4e51-b5ef-f2cb1fb2baf6`。

## 上一版本：2.1.4（8），内部 TestFlight 已可更新

2026-09-07：合并记录页与 iOS 桌面小组件。记录页默认展示按日期倒序的全部历史时间线，筛选折叠；底部名称改为「记录」并保留原日历图标。共享弹框移除了未对齐的顶部装饰线。小号「快速记录」打开记录弹框，大号「心情日历」显示本地月历并链接到对应日期。

- 最终组合版本 `npm run verify` 已通过：TypeScript、195 项业务 / 原生配置测试、Web 导出与 19 项网页测试，共 214 项。
- 已从组合版本创建隔离目录并重新 prebuild，实际工程核验通过：两份 Widget Swift 源码、唯一扩展嵌入、主 App 依赖、URL Scheme、App Group 及主 App / 扩展 2.1.4 版本匹配。
- 应用源码已推送到 `main`，提交 `9125c45f101d4c8e29c233c10c8800254cf19cb5`；[网页回归与部署](https://github.com/2441461233/moodtracker/actions/runs/34113819475)成功。同一提交的[原生 CI 34113819494](https://github.com/2441461233/moodtracker/actions/runs/34113819494)也已成功，实际编译主 App、HealthKit、MoodWidgets 模块及嵌入的 WidgetKit 扩展。
- GitHub 通过手机设备授权恢复登录，Apple Developer 使用 Chrome 中仍有效的原团队会话。已注册 App Group `group.com.zhenyu.moodjournal.app.widgets`（`38DNMWS632`）和扩展标识 `com.zhenyu.moodjournal.app.QuickRecordWidget`（`57DMQVSBPY`），主 App 与扩展均已关联该组。
- 主 App profile `JHW9QHZK8M` 已重新生成，名称 `MoodTracker AppStore HealthKit Widgets 20260907`，页面状态 Active，保留 HealthKit；扩展 App Store profile `G4LLTV5L8F` 已生成，名称 `MoodTracker QuickRecordWidget AppStore 20260907`。两份均使用原分发证书 `N46K339LNH`，未生成或撤销分发证书。
- 两份 `.mobileprovision` 已通过页面的标准下载操作取回，并完成本地校验：Team / Bundle ID、App Group、App Store 分发类型、有效期和原分发证书匹配；主 App 保留 HealthKit 与 Background Delivery，扩展没有 HealthKit。主 App profile UUID `199418ad-b04b-4acc-8939-d9b042da730e`，扩展 UUID `92763582-7213-44a8-ba5a-a1c2c3a1df7c`。本地凭据已配置为 `app` / `QuickRecordWidget` 双 target，文件在 Git 忽略范围内。
- [2.1.4（8）正式 EAS 构建](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/362bcf87-a378-4316-af25-1a20b167f23f)已于 2026-09-07 13:58:16 UTC 完成，状态 `FINISHED`，源码精确匹配 `9125c45f101d4c8e29c233c10c8800254cf19cb5`。
- 已下载上述精确 IPA，于 14:00:04 UTC 通过 `codesign --verify --deep --strict`。实际主 App 与 `QuickRecordWidget.appex` 均为 **2.1.4（8）**、最低 iOS 15.1、SDK `iphoneos26.2`；两个签名及内嵌 profiles 的 Team / Bundle ID / App Group 一致，签名叶证书存在于对应 profile。主 App 保留 HealthKit / Background Delivery，扩展不含 HealthKit；均为 App Store 分发，`get-task-allow=false`，主 App 的加密声明为 `false`，`moodjournal` URL scheme 存在。
- IPA 为 13,509,382 字节，SHA-256：`ebeeebd179ca06d3f86563dbd05737faf776780f8876a61f1487ab161146a65e`。
- [EAS 上传任务 41bf5573](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/41bf5573-0e57-4c9e-9895-9b26d124f1e8)已独立核实为 `FINISHED`，于 14:02:25 UTC 完成；App ID、构建 ID、2.1.4（8）与源码提交均精确匹配。2026-09-07 14:08 UTC，App Store Connect 上传表已显示新构建 `a750718b-a4e2-4e87-a3ac-a8ef37e98914`「完成」，上传时间 22:02（北京时间）。
- **2026-09-07 14:09 UTC，已在[原「个人测试组」](https://appstoreconnect.apple.com/teams/93dd1b91-a79c-4c54-8ba3-0dd5bf8bc33a/apps/6776595613/testflight/groups/c3a1a107-7438-48ac-802c-e9634d77ba5a/builds)核实 2.1.4（8）显示「正在测试」、90 天后过期。** 原组仍为 1 个测试员，自动分发开启，未创建其他 App 或测试组；测试员页面还显示「已安装 2.1.4 (8)」。安装状态不代表交互验收通过。
- 同日 14:08 UTC，[本构建的测试说明](https://appstoreconnect.apple.com/teams/93dd1b91-a79c-4c54-8ba3-0dd5bf8bc33a/apps/6776595613/testflight/ios/a750718b-a4e2-4e87-a3ac-a8ef37e98914)已显示「已保存」，包含记录页改动、两种小组件的添加方法及真机待测试内容。
- 目标仍为原 App `6776595613`、Team `9PB9F396XQ`、原「个人测试组」。真实 iPhone 小组件与升级交互仍待用户验收；后台安装状态与功能验收分别记录。

小组件实现与验证详见 [iOS 桌面小组件](ios-widgets.md)，记录页截图见 [记录页检查](calendar-records-audit-2026-09-07.md)。

## 历史发布：2.1.3（7），已在原内部测试组可用

2026-09-07：本次包含原生日期与时间选择器、记录表单与键盘交互修复、选项排序和文案精简、视觉更新，以及透明页面切换时旧页叠加的修复。沿用原 App、Team、签名材料及内部「个人测试组」，不扩大健康权限或变更本地存储键。

发布前完整 `npm run verify` 通过：TypeScript、179 项业务 / 原生配置测试、Web 导出与 19 项 Web 测试。此前已验证手机尺寸和宽屏下标签往返切换不叠页，日历月份状态保留。签名构建、IPA 核验与上传均已完成；2026-09-07 本次发布期间，已补充核实原测试组的分发状态为「正在测试」。

- 应用源码已推送到 `main`，提交 `f8588fce54ae6fd706eccf2396e95600cd65ad1e`。[网页 CI 与部署](https://github.com/2441461233/moodtracker/actions/runs/34102894043)成功；同一提交的[独立 iOS CI](https://github.com/2441461233/moodtracker/actions/runs/34102893976)成功，实际编译 App 与 HealthKit 模块。
- [EAS 构建 7d085be1](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/7d085be1-1e6a-4e4b-99ad-bc06473b80fb)状态 `FINISHED`，版本 2.1.3（7），源码精确匹配上述提交。该历史构建已上传，无需重复创建或提交。
- 已下载该确切构建的 IPA，于 2026-09-07 08:59 UTC 通过 `codesign --verify --deep --strict`；Bundle ID / Team / 版本 / build 匹配，实际签名与内嵌 profile 匹配，HealthKit 与 HealthKit Background Delivery 均为 `true`，`get-task-allow=false`，`ITSAppUsesNonExemptEncryption=false`。最低 iOS 15.1，实际 SDK 为 `iphoneos26.2`。
- IPA 为 13,386,189 字节；SHA-256：`a5152988fc827ac0f15baf426b610e4c418bec77bce41288b3efca1470b5cbf3`。
- [EAS 上传任务 bee97cf3](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/bee97cf3-06c9-4116-8466-123fe4f76f54)已独立核实为 `FINISHED`，完成于 2026-09-07 09:13:17.274 UTC；关联构建、2.1.3（7）、应用源码提交和 ASC App ID `6776595613` 均精确匹配。账号所有者已在本机一次性输入页完成上传身份验证，密码未写入仓库、聊天或本地文件，无需再次上传。
- 2026-09-07 已在原「个人测试组」确认 2.1.3（7）显示「正在测试」，ASC build ID `127ecbc1-91d3-41eb-b6ea-e539195b7ae3`。真实 iPhone 升级、系统选择器、键盘与健康交互仍待验收。
- 本次登录 App Store Connect 后，已实际确认历史 2.1.2（6）在原「个人测试组」显示「正在测试」，上传日期为 2026-09-03 16:43（北京时间），ASC build ID 为 `3378cba6-44e4-4baa-8c4a-5b7f7aef6f96`；原组仍为 1 个测试员。下方 2.1.2 的旧记录是 2026-09-03 08:31 UTC 的阶段快照，后来已完成分发，不代表最新状态。

使用已有 Xcode 26.2 构建镜像，满足截至本次发布核对的 [Apple SDK 最低要求](https://developer.apple.com/news/upcoming-requirements/)（Xcode / iOS SDK 26 或以上）。以下为更早版本的历史记录，各版本证据独立保留。

## 历史修订：2.1.2（6）统一健康时间线（08:31 UTC 阶段快照）

2.1.2 将 Apple 心境从单独近况卡接入今日每日记录、月历 / 年像素、来源与列表筛选，以及独立 Apple 健康回顾。提交前本地 `npm run verify` 已退出 0：TypeScript、172 项回归、Web 导出及 19 项网页测试通过，共 191 项。320px / 390px 隔离合成夹具已实际点验日历来源与分页、每日记录、按 kind 的独立均值，以及待读取 / 权限未知 / 断开状态；这不是真实 HealthKit，尚未测试大字体、真实 VoiceOver 或真机。详细样本结果见 [设计与交互验收](../design-qa.md)。

截至 2026-09-03 08:31 UTC，2.1.2（6）已完成 EAS 构建和下载 IPA 验签，**尚未上传，也没有 Apple 处理或测试组可用证据**。等待账号所有者在本机一次性输入页完成上传身份验证；不在仓库记录输入页地址、账号或密码。不能将下方 2.1.1（5）的成功发布记录当作 2.1.2 已上线或真机已通过的证明。

- [EAS 构建 06a06295](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/06a06295-3709-4e30-8a5e-275386a6d07d)：2.1.2（6），源码 `d09d6b3085e4333f104269745a8caf370d649681`，状态 `FINISHED`，完成于 2026-09-03 08:20:20.381 UTC。
- 已下载该确切构建的 IPA，于 2026-09-03 08:22:22.731 UTC 通过 `codesign --verify --deep --strict`；Bundle ID / Team / 2.1.2 / build 6 一致，实际签名与内嵌 profile 匹配，HealthKit 与 HealthKit Background Delivery 均为 `true`，`get-task-allow=false`，`ITSAppUsesNonExemptEncryption=false`。
- IPA 为 13,306,619 字节；SHA-256：`5db9b9bb8cc27e8035367fe8a70963e96fc0a2ec32bba943edcbcd95fcb10bf2`。
- [独立原生 CI 33732450917](https://github.com/2441461233/moodtracker/actions/runs/33732450917) 已在同一应用源码上成功，完成于 2026-09-03 08:29:17 UTC；实际编译 App、HealthKit 模块及自动链接。它与已完成的 EAS 签名构建是两条不同验证链路，均不能替代真机验收。
- [首次网页 CI 33732450914](https://github.com/2441461233/moodtracker/actions/runs/33732450914) 因既有重试测试的固定 20 ms 等待竞态失败：172 项中 171 项通过，类型检查通过，Web 导出及部署被跳过。该测试已改为逐次推进模拟定时器，并验证重试上限和取消待执行重试；修正后完整 `npm run verify` 再次退出 0，172 项回归、19 项网页测试、类型检查及 Web 导出通过，Prettier 通过。仅修改测试，不改变上述 IPA 的应用源码；后续 [网页复跑与部署 33733731447](https://github.com/2441461233/moodtracker/actions/runs/33733731447) 已在仅测试 / 文档修正的提交 `fec55cc6d440448005ab7341e0fddc4a6c13e4cb` 上成功，类型、全部回归、Web 导出、网页产物检查和 Pages 部署均通过，部署完成于 2026-09-03 08:31:42 UTC。上述 IPA 的应用源码未改变。

本次保留已开启的连接偏好与系统权限，不要求 2.1.1 用户无故再次开启或授权；读取类型、最近 365 天及 5,000 条上限不变。新增展示仍在前台内存中，不复制成日记、不导出或写回外部样本。原生查询会返回可核验的本 App 自写身份与稳定本地 ID，仅供精确隐藏对应健康副本；本地不存在的自写样本和外部来源仍保留展示。`NSHealthShareUsageDescription` 已按日历、每日记录与独立健康回顾用途修订，写入用途仍只针对本地心情 / 时间 / 对应活动。

该版本的全新原生构建及最终 IPA 验签已完成；仍需上传、等待 Apple 处理，并核对原测试组分发。签名成功不等于 TestFlight 已可安装，也不能替代真机健康验收。

## 历史发布证据：2.1.1（5）

针对 2.1.0（4）需要反复手动同步及用户反馈同步失败的问题，2.1.1 改为一次开启后的自动同步。2.1.1（5）安装包已验签、上传并由 Apple 处理完成；2026-09-03 07:30 UTC 在原内部「个人测试组」核实状态为「正在测试」。该版本 `npm run verify` 通过：TypeScript、145 项日记 / 健康 / 原生相关回归、Expo Web 导出及 19 项网页测试。**该历史版本已可通过 TestFlight 更新，但真实 iPhone 的健康授权、读写及升级数据保留仍待验收**。旧版丢失了具体错误，因此不能把该轮改动描述为已确认修复了用户手机上某个特定 HealthKit 错误。

该版 `app.json` 新增 `com.apple.developer.healthkit.background-delivery=true`。现有 App Store profile `JHW9QHZK8M` 已通过 `security cms` 解码核验允许后台通知，因此当时无需重新生成证书或 profile。该版完整原生签名包已重新构建，不能以 JS 更新代替。

- [EAS 构建 6e853857](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/6e853857-c58e-41f9-89e0-ec9a3c1c10e4)：2.1.1（5），源码 `3c25541e7c87dbe936299e39016ae74871609c36`，状态 `FINISHED`，完成于 2026-09-03 07:15:21 UTC。
- 已下载该确切构建的 IPA，并于 2026-09-03 07:16 UTC 核验：`codesign --verify --deep --strict` 通过；Team / Bundle ID / 版本 / build 全部匹配；实际签名与内嵌 profile 的 HealthKit、HealthKit Background Delivery 均为 `true`；`get-task-allow=false`，`ITSAppUsesNonExemptEncryption=false`。
- IPA 为 13,292,267 字节；SHA-256：`daa3965896165c0a6d428420f2cbaeba7e36f2124412be335d119e24b0e9cb30`。
- [原生 iOS CI 33726763418](https://github.com/2441461233/moodtracker/actions/runs/33726763418) 已在同一源码提交上成功，2026-09-03 07:20:17 UTC 完成，耗时 9 分 40 秒；实际编译 App、HealthKit 模块、观察器与 AppDelegate subscriber。[网页发布 33726763106](https://github.com/2441461233/moodtracker/actions/runs/33726763106) 同样成功。模拟器编译和签名通过仍不等于真机健康功能验收。
- [EAS 上传任务 aa6fe5fe](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/aa6fe5fe-ce47-4e17-9b1d-cc713a160266) 已完成。EAS CLI 23.2.0 独立核实 `status=FINISHED`，完成于 2026-09-03 07:24:58.071 UTC，关联构建精确匹配 `6e853857-c58e-41f9-89e0-ec9a3c1c10e4`、2.1.1（5）及上述源码提交，没有重复上传。
- **内部 TestFlight 已可用**。2026-09-03 07:30 UTC，App Store Connect 上传表显示 2.1.1（5）「完成」；[既有个人测试组](https://appstoreconnect.apple.com/teams/93dd1b91-a79c-4c54-8ba3-0dd5bf8bc33a/apps/6776595613/testflight/groups/c3a1a107-7438-48ac-802c-e9634d77ba5a/builds) 显示该版本「正在测试」、90 天后过期，原测试员仍在组内。新 App Store Connect build ID 为 `02154aa1-2df6-4030-a980-7b5e6155fa11`；没有新建 App、测试组或测试员。
- 2026-09-03 07:31 UTC，[该构建的测试说明](https://appstoreconnect.apple.com/teams/93dd1b91-a79c-4c54-8ba3-0dd5bf8bc33a/apps/6776595613/testflight/ios/02154aa1-2df6-4030-a980-7b5e6155fa11) 已显示「已保存」，包含一次开启的入口、自动读写范围、iOS 后台限制、不要卸载旧 App 及待完成的真机验收项。
- 上传身份验证由账号所有者在本机一次性输入页完成，App 专用密码不保存在仓库、聊天或本地文件。此次上传已结束，更新无需再次提交或输入该密码。

## 现有应用，不新建另一个 App

- Bundle ID：`com.zhenyu.moodjournal.app`
- App Store Connect App ID：`6776595613`（现有「情绪像素」）
- Apple Developer Team：`9PB9F396XQ`
- 当前内部 TestFlight 可更新版本：2.1.8（build 12），EAS production 已完成远端版本号递增。历史内部 TestFlight 版本为 2.1.0（build 4）至 2.1.7（build 11）。
- 保留日记存储键 `mood_entries` 与原有数据结构。请用户先导出备份；不要让用户卸载旧 App 来更新。

Apple Developer 会员与网页登录不等于命令行签名凭据；GitHub Pages 的发布也不是 iOS 发布。

## 当前代码继承的健康功能与配置

- 本地 Expo 模块 `modules/mood-health`，真实 Swift HealthKit State of Mind 查询与写入接口。
- 设置中的 Apple 健康面板：一次开启确认后请求两方向权限，显示自动同步状态、上次读写时间、后台通知状态及权限异常；正常使用不再需要每次手动读取或写入。
- 全局自动同步协调器：本地日记成功持久化后触发近 365 天记录的新增 / 心情、时间、对应活动修改写入，笔记不进入同步队列；串行合并事件，瞬时故障按 5 / 15 / 45 秒有界重试，权限拒绝不反复弹窗。
- 原生 `HKObserverQuery` 与 Background Delivery：仅发无健康样本的变更通知，前台收到变化或回到 App 时补齐；后台只确认通知，不查询或保存健康样本，不承诺系统后台秒级实时。
- 前台最多读取近 365 天的 5,000 条 Apple 心境，范围未扩大；统一时间线用于今日每日列表、月历 / 年像素、选中日、来源切换及跨日期列表搜索，Apple 行只读并保留原始愉悦度、来源和类型，本地行仍可编辑。
- 只按真实本 App 自写来源、bundle identifier 与精确稳定本地 ID 隐藏存在对应日记的健康副本；孤立自写样本 / 外部来源 / 无同步 ID 的旧样本仍展示，不以相近时间或心情猜测去重，不删除原数据。
- 日历按当前来源计算每日代表分：有 `dailyMood` 时优先其均值，否则取当下情绪均值；Apple 的 `valence × 2 + 3` 仅作近似色彩与回顾，期间日均对有记录日等权。关键词 / 心情仅筛选列表，不改变日期色彩及期间统计。
- Apple 健康回顾按两种 kind 分别汇总原始愉悦度；本地趋势、分布、活动关联和连续天数保持本地口径。外部样本不进入 `mood_entries`、备份、导出或反向健康写入路径。
- 沿用 `com.apple.developer.healthkit` 与 `com.apple.developer.healthkit.background-delivery` entitlement；中文读取用途新增按日期展示和独立回顾，写入用途不变。关闭连接 / 进入后台清空读取内存，不做跨方向自动删除。
- iOS 最低系统 15.1；心境接入在运行时要求 iOS 18+，旧系统仍能使用日记。
- `eas.json` 的 simulator / production 构建和现有 App 的提交配置；已绑定真实 EAS 项目，没有向仓库提交密码、证书或 API key。
- `.github/workflows/verify-ios.yml` 验证实际 Swift 与模拟器链接，**不签名、不上传 TestFlight**。

## 历史发布证据：2.1.0（4）

以下是 2.1.0 的已核验证据，不是后续修订的发布或真机测试报告。

- EAS 已登录个人账号 `zhen2yu`，项目为 [@zhen2yu/moodtracker](https://expo.dev/accounts/zhen2yu/projects/moodtracker)，ID：`427558a5-13db-42e4-a992-8a5167b5bffe`。
- 已核对 Free 计划，该次构建前 iOS 包含额度为 15 次、已用 0 次；未开启付费订阅。这是当时用量快照，不代表后续剩余额度。
- [GitHub iOS 验证 33711974366](https://github.com/2441461233/moodtracker/actions/runs/33711974366) 在提交 `145cf01032f49516e3ab9d9a4d1753f2d912868b` 上成功，耗时 9 分 55 秒。Xcode 26.3 / 模拟器 SDK 26.2 已完成 MoodHealth 的 arm64、x86_64 真实 Swift 编译和模拟器链接。
- 所有者已明确同意继续签名托管，并要求直接发布到 TestFlight。
- Apple Distribution 证书已签发：Team `9PB9F396XQ`，证书 ID `N46K339LNH`，有效至 2027-09-03；未撤销旧证书。现有 MoodJournal App ID 已启用 HealthKit。
- App Store provisioning profile `JHW9QHZK8M`（MoodTracker AppStore HealthKit 20260903）已生成，并通过本地校验：现有 Team / Bundle ID、HealthKit entitlement、App Store 分发类型和发布证书匹配。
- [EAS 正式 iOS 构建 a6c29f04](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/a6c29f04-396d-47ae-9ee8-c35adc40b92b) 已成功：版本 2.1.0 / build 4，源码提交 `ff6cfffaa60afd6a63e9c0e961272563f3c29670`，完成时间 2026-09-03 06:07:27 UTC，已生成签名 IPA。
- 已下载并核验该 IPA：`codesign --verify --deep --strict` 通过，Bundle ID / Team / 版本 / build 精确匹配，签名 HealthKit 为 `true`，`get-task-allow=false`，实际 Info.plist 的 `ITSAppUsesNonExemptEncryption=false`。IPA SHA-256：`4f536c49600d8678a7f0f6cfd6b8c4d0e2139348b89242eebc0c24820e61966a`。
- [EAS 上传任务 4fde6ff8](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/4fde6ff8-1c27-47f0-8d95-f44fe5c0629b) 已完成。已用 EAS CLI 23.2.0 独立读取此确切任务：`status=FINISHED`，完成时间 2026-09-03 06:38:23.320 UTC，关联构建为 `a6c29f04-396d-47ae-9ee8-c35adc40b92b`、版本 2.1.0 / build 4；没有重复提交。
- **内部 TestFlight 已可用**。2026-09-03 06:42 UTC 在 App Store Connect 的既有“个人测试组”核实，唯一新构建为 2.1.0（4）、状态“正在测试”，原测试员仍在组内；当时页面显示 90 天后过期。App Store Connect build ID 为 `fe227497-c4ec-470b-ab62-1bb5d620cbbb`。
- 构建详情页已保存测试说明，涵盖新交互、iOS 18+ 手动健康连接、不要卸载旧 App 的提醒及仍待完成的真机验收项。
- 发布收尾后重新运行 `npm run verify`，TypeScript 检查、日记 / 健康写入 / 原生桥接回归、Expo Web 导出及 19 项网页发布测试均通过（退出码 0）；这不替代真实 iPhone 的健康读写验收。
- 手机可通过 **TestFlight → 情绪记录 → 更新** 安装此版本；建议先导出日记备份，**不要卸载旧 App**。TestFlight 分发成功不等于 App Store 正式上架，也不等于真实 iPhone 的 HealthKit 授权、读写与升级数据保留已验收。

## 构建与上传

当前工作机只有 Command Line Tools，没有完整 Xcode。EAS 登录和项目绑定已经完成，后续签名构建使用云端环境。

登录必须由所有者在官方页面或受控终端中完成。不要把 Apple / Expo 密码、验证码、应用专用密码贴入聊天或提交仓库。生成或授权长期密钥前，确认具体权限与保管方式，不自动扩大账号访问范围。

**2026-09-09 起，后续上传直接复用已有发布密钥，不再默认要求用户填写 App 专用密码。** 用户已本人同意 Apple API 开通条款，并要求解决每次重新填密码的问题。现有 `MoodPixels EAS Submit` 团队密钥使用 `App 管理` 权限，已绑定 `@zhen2yu/moodtracker` 的主 App `com.zhenyu.moodjournal.app` 用于 EAS Submit。本次 2.1.6（10）非交互上传已实际验证输出 `API Key already set up`、`Key Source: EAS servers` 并上传成功。密钥由现有 EAS 账号加密托管，临时下载的私钥文件已删除，仓库中没有私钥；保管与复用机制见 [Expo 官方说明](https://docs.expo.dev/app-signing/security/#apple-app-store-connect-asc-api-key)。若后续认证失败，先检查现有密钥和 EAS 登录状态，再判断是否真的需要用户操作，不要重新走一次性密码输入页。

production 使用 `credentialsSource=local`，由本地提供签名材料，仍由 EAS 云端构建机完成构建与签名，不是本机 Xcode 构建。`credentials.json` 已加入忽略规则；签名材料和密码不进入 Git 仓库。

历史安装包不重复提交。以下为后续新原生版本的通用步骤：先安装并核实 EAS CLI 23.2.0，核对账号与签名凭据，再在项目目录执行：

```sh
eas --version
eas whoami
eas build --platform ios --profile production --non-interactive --freeze-credentials
# 确认新构建成功后，将其精确 ID 设为 VERIFIED_EAS_BUILD_ID 再提交。
eas submit --platform ios --profile production --id "$VERIFIED_EAS_BUILD_ID" --non-interactive --wait --no-auto-testflight-setup
```

提交时明确选择已核对的新构建，不凭 `--latest` 猜测是否为正确包；使用现有 EAS 托管 API 密钥即可，无需设置 `EXPO_APPLE_APP_SPECIFIC_PASSWORD`。以后每个新包仍需独立核验主 App 和扩展的签名、内嵌 profile、HealthKit、App Group、Team / Bundle ID 及版本。

simulator / production 均固定 Node.js `22.23.1` 与 EAS 镜像 `macos-sequoia-15.6-xcode-26.2`，不使用 `latest` 镜像别名。上传前仍须核实符合 Apple 当时的 SDK 最低要求。EAS 设置 `MOODTRACKER_BUILD_TARGET=native`，`app.config.js` 仅在原生构建时强制空 base URL，避免携带 GitHub Pages 的 `/moodtracker/` 子路径；不向 EAS 传入空环境变量值。

EAS Submit 只负责上传二进制。每次上传后都需等待 Apple 处理，在 App Store Connect 核对版本 / build / 状态，并确认既有内部 TestFlight 组的可用性。当前 2.1.10（16）及历史版本均已分别核实内部 TestFlight 可用；不得把构建队列、上传完成、Apple 处理完毕、TestFlight 可安装、App Store 正式审核通过混称为“已上线”。

已设置 `ios.config.usesNonExemptEncryption=false`，2.1.0（4）至当前 2.1.10（16）的已发布签名 IPA 均已核实 Info.plist 中 `ITSAppUsesNonExemptEncryption` 为布尔 `false`。[Expo 官方配置说明](https://docs.expo.dev/versions/latest/config/app/#usesnonexemptencryption)

当前代码与锁定依赖未发现自定义加密、VPN 或非系统加密实现。Expo 的摘要计算使用 Apple CryptoKit，网络使用系统 URLSession；MoodHealth 使用系统 HealthKit。Apple 明确说明，仅使用 Apple 操作系统提供的加密时，无需向 App Store Connect 上传加密文档；无加密或仅使用豁免加密可将该键设为 `NO`。这不是“完全没有加密”或免除所有出口合规义务的声明；依赖、加密功能或分发要求变化时必须重新核对。[Apple 文档要求](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption)、[Apple 声明规则](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)

App Store 正式发布还需要元数据、截图、隐私信息、审核和分发状态；当前配置不会自动替所有者提交未准备好的商店版本。

## 真机必须验收的项目（含继承的健康功能）

下面不是已经完成的测试报告，需在签名的 iPhone 包上逐项验收：

1. 覆盖安装旧版，检查原有日记、笔记、日期和活动；导出一份可恢复的 JSON 备份。
2. iOS 15.1–17 不调用 State of Mind，日记功能仍可用；iOS 18+ 显示健康连接入口。
3. 已在 2.1.1 开启自动同步者覆盖升级后保留 enabled 与系统权限，自动恢复读取，无需无故再次开启。尚未连接者只有读完范围 / 隐私说明并点“开启自动同步”后才申请两方向权限；普通启动、保存或计时重试不弹授权。
4. 在独立测试设备或测试安装上验收全新安装：不授予读取权限，只允许写入，确认第一次开启能把范围内记录写入健康；新增记录成功保存后自动写入，不必再次点同步。不要为此卸载用户保有日记的旧 App。
5. 分别允许、拒绝、撤回读取与写入权限；读取为空不能显示成“已授权 / 没有任何记录”。写入被拒绝时显示安全提示，并可在系统重新允许后恢复；已有本地日记不受影响。
6. 从健康 App 或 Apple Watch 正念保存当下情绪和一天整体心情，验证前台事件刷新 / 回到 App 自动补齐；在今日每日列表、月历、年像素及选中日期均可看到，来源、时间、类型、原始愉悦度正确，Apple 记录无本地编辑入口。
7. 将带笔记的本地记录写入健康，核对时间、五档近似映射与关联；笔记不能出现在样本、metadata、同步队列或日志中。近 365 天范围和 5,000 条读取上限的显示与实际一致。
8. 新增、补记、心情 / 时间 / 对应活动修改成功持久化后自动更新；重复事件、失败重试、写入产生的自身通知不制造重复样本或无限循环。笔记单独变化不触发健康写入，未保存草稿不发送。
9. 系统锁屏 / App 进入非活动或后台时清空读取内存，不在后台查询或持久化样本；回到前台重新读取，无需手动。关闭设置面板不影响其他前台页面；关闭连接后今日、日历、健康回顾等所有派生视图的 Apple 样本均清空，本地日记仍可用。
10. 在真实 iPhone 验证 `HKObserverQuery` 及 Background Delivery 注册和恢复、系统延迟与后台不可用降级。后台唤醒仅确认无数据变更通知，样本在前台再读取；彻底关闭 App 后不承诺持续秒级实时。模拟器成功不能代替这一项。
11. 模拟可恢复故障，核验 5 / 15 / 45 秒有界自动重试及上限后停止计时；拒绝权限不反复申请。错误显示为安全码对应的固定说明，不暴露健康样本或原始系统描述。
12. 同步期间关闭连接取消后续排队任务、停用观察和后台通知；已完成的单次系统写入不会被反向删除。重新连接再次明确启用，重启后恢复已开启的连接状态。
13. 本地删除不删除健康副本；健康删除不自动补回；Apple 侧编辑只更新只读显示，不改写本地日记。
14. HealthKit 不可用、写入中断、空间不足、损坏导出账本均不清空日记，不伪报全部成功。
15. JSON / CSV 不包含健康读取样本、来源、UUID 或同步账本；不做用户健康数据联网分析。最终签名包的两个 HealthKit entitlement 和用途说明均正确。
16. 精确自写 source / bundle / 稳定本地 ID 去重只隐藏存在对应日记的健康副本；本地记录已删除时的自写样本仍展示。外部同时间同愉悦度样本、无同步 ID 旧样本不被错误隐藏，原数据未删除。
17. “全部 / 本地 / Apple 健康”同步控制日历、年像素及期间统计；关键词跨日期搜索与心情筛选只改变列表。大字体、长来源名称和 320px 小屏不得造成来源切换或原始数值横向溢出。
18. 验证每日整体心情优先规则、当下情绪回退规则、`valence × 2 + 3` 的近似色彩与期间日等权；Apple 原始愉悦度不可被该映射覆盖或回写。
19. Apple 健康回顾的两种 kind 分别计算原始样本均值；本地趋势、分布和活动关联不因 Apple 样本加入而变化。365 天 / 5,000 条边界、读取中、权限未知和读取失败均不谎报全量或确定空白。

当前 2.1.10（16）已核实在原内部测试组「正在测试」；真实设备安装状态未验证。更新通过 **TestFlight → 情绪像素 → 更新**，不要卸载旧 App。已开启自动同步者继续沿用连接；从未开启者才需要一次明确开启和系统授权。之后前台响应变化、回到 App 自动补齐，后台和彻底关闭后的时效仍受 iOS 限制。安装新构建不会使旧的过期 build 自行续期。

## 官方参考

- [Expo 本地模块与原生重建](https://docs.expo.dev/modules/get-started/)
- [Expo iOS 上传与 TestFlight 流程](https://docs.expo.dev/submit/ios/)
- [EAS 构建与提交配置](https://docs.expo.dev/eas/json/)
- [Apple HKStateOfMind](https://developer.apple.com/documentation/healthkit/hkstateofmind)
- [Apple 健康授权](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [Apple HKObserverQuery](https://developer.apple.com/documentation/healthkit/hkobserverquery)
- [Apple HealthKit Background Delivery](<https://developer.apple.com/documentation/healthkit/hkhealthstore/enablebackgrounddelivery(for:frequency:withcompletion:)>)
- [Apple Background Delivery entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.healthkit.background-delivery)
- [TestFlight](https://testflight.apple.com/)
