# iOS 2.1.1 发布与真机验收

## 当前修订：2.1.1（5）已签名，尚未上传 TestFlight

针对 2.1.0（4）需要反复手动同步及用户反馈同步失败的问题，2.1.1 已改为一次开启后的自动同步，并生成验签通过的 2.1.1（5）安装包。`npm run verify` 已通过：TypeScript、145 项日记 / 健康 / 原生相关回归、Expo Web 导出及 19 项网页测试。**当前尚未上传 TestFlight，真实 iPhone 的健康读写也尚未验收**；下方 2.1.0（4）的发布证据仅作为历史保留。旧版丢失了具体错误，因此不能把本轮改动描述为已确认修复了用户手机上某个特定 HealthKit 错误。

本次 `app.json` 新增 `com.apple.developer.healthkit.background-delivery=true`。现有 App Store profile `JHW9QHZK8M` 已通过 `security cms` 解码核验允许后台通知，因此无需重新生成证书或 profile。本次完整原生签名包已重新构建，不能以 JS 更新代替。

- [EAS 构建 6e853857](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/6e853857-c58e-41f9-89e0-ec9a3c1c10e4)：2.1.1（5），源码 `3c25541e7c87dbe936299e39016ae74871609c36`，状态 `FINISHED`，完成于 2026-09-03 07:15:21 UTC。
- 已下载该确切构建的 IPA，并于 2026-09-03 07:16 UTC 核验：`codesign --verify --deep --strict` 通过；Team / Bundle ID / 版本 / build 全部匹配；实际签名与内嵌 profile 的 HealthKit、HealthKit Background Delivery 均为 `true`；`get-task-allow=false`，`ITSAppUsesNonExemptEncryption=false`。
- IPA 为 13,292,267 字节；SHA-256：`daa3965896165c0a6d428420f2cbaeba7e36f2124412be335d119e24b0e9cb30`。
- [原生 iOS CI 33726763418](https://github.com/2441461233/moodtracker/actions/runs/33726763418) 已在同一源码提交上成功，2026-09-03 07:20:17 UTC 完成，耗时 9 分 40 秒；实际编译 App、HealthKit 模块、观察器与 AppDelegate subscriber。[网页发布 33726763106](https://github.com/2441461233/moodtracker/actions/runs/33726763106) 同样成功。模拟器编译和签名通过仍不等于真机健康功能验收。
- 等待账号所有者通过本机一次性输入页提供上传用 App 专用密码。密码不保存在仓库、聊天或本地文件。尚无本轮 submission ID / Apple TestFlight 可用状态，不得提示手机已可更新。

## 现有应用，不新建另一个 App

- Bundle ID：`com.zhenyu.moodjournal.app`
- App Store Connect App ID：`6776595613`（现有“情绪记录”）
- Apple Developer Team：`9PB9F396XQ`
- 本次已签名、待上传修订：2.1.1（build 5），build 由 EAS production 远端版本号自动递增。历史已发布内部 TestFlight 版本为 2.1.0（build 4）。
- 保留日记存储键 `mood_entries` 与原有数据结构。请用户先导出备份；不要让用户卸载旧 App 来更新。

Apple Developer 会员与网页登录不等于命令行签名凭据；GitHub Pages 的发布也不是 iOS 发布。

## 2.1.1 已添加的代码与配置

- 本地 Expo 模块 `modules/mood-health`，真实 Swift HealthKit State of Mind 查询与写入接口。
- 设置中的 Apple 健康面板：一次开启确认后请求两方向权限，显示自动同步状态、上次读写时间、后台通知状态及权限异常；正常使用不再需要每次手动读取或写入。
- 全局自动同步协调器：本地日记成功持久化后触发近 365 天记录的新增 / 心情、时间、对应活动修改写入，笔记不进入同步队列；串行合并事件，瞬时故障按 5 / 15 / 45 秒有界重试，权限拒绝不反复弹窗。
- 原生 `HKObserverQuery` 与 Background Delivery：仅发无健康样本的变更通知，前台收到变化或回到 App 时补齐；后台只确认通知，不查询或保存健康样本，不承诺系统后台秒级实时。
- 前台最多读取近 365 天的 5,000 条 Apple 心境；首页只读显示最近三条外部来源，保留原始愉悦度、来源及当下情绪 / 一天整体心情区别，不混本地统计和备份。
- `com.apple.developer.healthkit` 与新增 `com.apple.developer.healthkit.background-delivery` entitlement，以及自动同步用途的中文读写说明；关闭连接 / 进入后台清空读取内存，不做跨方向自动删除。
- iOS 最低系统 15.1；心境接入在运行时要求 iOS 18+，旧系统仍能使用日记。
- `eas.json` 的 simulator / production 构建和现有 App 的提交配置；已绑定真实 EAS 项目，没有向仓库提交密码、证书或 API key。
- `.github/workflows/verify-ios.yml` 验证实际 Swift 与模拟器链接，**不签名、不上传 TestFlight**。

## 历史发布证据：2.1.0（4）

以下是 2.1.0 的已核验证据，不是 2.1.1 自动同步的发布或真机测试报告。

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

production 使用 `credentialsSource=local`，由本地提供签名材料，仍由 EAS 云端构建机完成构建与签名，不是本机 Xcode 构建。`credentials.json` 已加入忽略规则；签名材料和密码不进入 Git 仓库。

历史 2.1.0（4）的上传已经完成，不要重新提交该构建。2.1.1（5）也已构建并验签，不要为了上传而重复构建。以下构建步骤仅供后续新版本使用：先安装并核实 EAS CLI 23.2.0，核对账号与签名凭据，再在项目目录执行：

```sh
eas --version
eas whoami
eas build --platform ios --profile production --non-interactive --freeze-credentials
# 确认新构建成功后，将其精确 ID 设为 VERIFIED_EAS_BUILD_ID 再提交。
eas submit --platform ios --profile production --id "$VERIFIED_EAS_BUILD_ID" --non-interactive --wait --no-auto-testflight-setup
```

提交时明确选择已核对的新构建，不凭 `--latest` 猜测是否为正确包。应用专用密码仅通过受控上传进程的环境传入，不放入命令行参数、日志、`eas.json` 或仓库。本次已核验现有 profile 与最终签名 IPA 的 HealthKit、HealthKit Background Delivery 两项权限，以及 Team / Bundle ID / 分发证书匹配。以后仍必须分别检查 profile 和实际签名 entitlement。

simulator / production 均固定 Node.js `22.23.1` 与 EAS 镜像 `macos-sequoia-15.6-xcode-26.2`，不使用 `latest` 镜像别名。上传前仍须核实符合 Apple 当时的 SDK 最低要求。EAS 设置 `MOODTRACKER_BUILD_TARGET=native`，`app.config.js` 仅在原生构建时强制空 base URL，避免携带 GitHub Pages 的 `/moodtracker/` 子路径；不向 EAS 传入空环境变量值。

EAS Submit 只负责上传二进制。每次上传后都需等待 Apple 处理，在 App Store Connect 核对版本 / build / 状态，并确认既有内部 TestFlight 组的可用性。2.1.1 尚未完成这些步骤；不得把构建队列、上传完成、Apple 处理完毕、TestFlight 可安装、App Store 正式审核通过混称为“已上线”。

已设置 `ios.config.usesNonExemptEncryption=false`，历史 2.1.0 包和当前 2.1.1（5）最终签名 IPA 均已核实 Info.plist 中 `ITSAppUsesNonExemptEncryption` 为布尔 `false`。[Expo 官方配置说明](https://docs.expo.dev/versions/latest/config/app/#usesnonexemptencryption)

当前代码与锁定依赖未发现自定义加密、VPN 或非系统加密实现。Expo 的摘要计算使用 Apple CryptoKit，网络使用系统 URLSession；MoodHealth 使用系统 HealthKit。Apple 明确说明，仅使用 Apple 操作系统提供的加密时，无需向 App Store Connect 上传加密文档；无加密或仅使用豁免加密可将该键设为 `NO`。这不是“完全没有加密”或免除所有出口合规义务的声明；依赖、加密功能或分发要求变化时必须重新核对。[Apple 文档要求](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption)、[Apple 声明规则](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)

App Store 正式发布还需要元数据、截图、隐私信息、审核和分发状态；当前配置不会自动替所有者提交未准备好的商店版本。

## 2.1.1 真机必须验收的项目

下面不是已经完成的测试报告，需在签名的 iPhone 包上逐项验收：

1. 覆盖安装旧版，检查原有日记、笔记、日期和活动；导出一份可恢复的 JSON 备份。
2. iOS 15.1–17 不调用 State of Mind，日记功能仍可用；iOS 18+ 显示健康连接入口。
3. 第一次打开设置不弹健康授权；用户读完范围 / 隐私说明并点“开启自动同步”后才申请两方向权限。重启、保存或重试计时不重复弹授权。
4. 在独立测试设备或测试安装上验收全新安装：不授予读取权限，只允许写入，确认第一次开启能把范围内记录写入健康；新增记录成功保存后自动写入，不必再次点同步。不要为此卸载用户保有日记的旧 App。
5. 分别允许、拒绝、撤回读取与写入权限；读取为空不能显示成“已授权 / 没有任何记录”。写入被拒绝时显示安全提示，并可在系统重新允许后恢复；已有本地日记不受影响。
6. 从健康 App 或 Apple Watch 正念保存当下情绪和一天整体心情，验证前台事件刷新 / 回到 App 自动补齐；来源、时间、类型、原始愉悦度正确，首页最多三条且排除本 App 自身来源，不混入本地统计。
7. 将带笔记的本地记录写入健康，核对时间、五档近似映射与关联；笔记不能出现在样本、metadata、同步队列或日志中。近 365 天范围和 5,000 条读取上限的显示与实际一致。
8. 新增、补记、心情 / 时间 / 对应活动修改成功持久化后自动更新；重复事件、失败重试、写入产生的自身通知不制造重复样本或无限循环。笔记单独变化不触发健康写入，未保存草稿不发送。
9. 系统锁屏 / App 进入非活动或后台时清空读取内存，不在后台查询或持久化样本；回到前台重新读取，无需手动。关闭设置面板不影响首页的前台只读近况；关闭连接后两处读取结果均清空。
10. 在真实 iPhone 验证 `HKObserverQuery` 及 Background Delivery 注册和恢复、系统延迟与后台不可用降级。后台唤醒仅确认无数据变更通知，样本在前台再读取；彻底关闭 App 后不承诺持续秒级实时。模拟器成功不能代替这一项。
11. 模拟可恢复故障，核验 5 / 15 / 45 秒有界自动重试及上限后停止计时；拒绝权限不反复申请。错误显示为安全码对应的固定说明，不暴露健康样本或原始系统描述。
12. 同步期间关闭连接取消后续排队任务、停用观察和后台通知；已完成的单次系统写入不会被反向删除。重新连接再次明确启用，重启后恢复已开启的连接状态。
13. 本地删除不删除健康副本；健康删除不自动补回；Apple 侧编辑只更新只读显示，不改写本地日记。
14. HealthKit 不可用、写入中断、空间不足、损坏导出账本均不清空日记，不伪报全部成功。
15. JSON / CSV 不包含健康读取样本、来源、UUID 或同步账本；不做用户健康数据联网分析。最终签名包的两个 HealthKit entitlement 和用途说明均正确。

当前只能确认历史 2.1.0（4）已在原内部测试组可用；**2.1.1 不应在实际核实前提示用户已可更新**。新版本完成分发后，更新方式仍为 **TestFlight → 情绪记录 → 更新**；不要卸载旧 App。安装新构建不会使旧的过期 build 自行续期。

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
