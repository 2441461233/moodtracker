# iOS 2.1 发布与真机验收

## 现有应用，不新建另一个 App

- Bundle ID：`com.zhenyu.moodjournal.app`
- App Store Connect App ID：`6776595613`（现有“情绪记录”）
- Apple Developer Team：`9PB9F396XQ`
- 本轮已发布到内部 TestFlight 的版本：2.1.0（build 4）；本地 buildNumber 起点 2，EAS production 通过远端版本号自动递增。
- 保留日记存储键 `mood_entries` 与原有数据结构。请用户先导出备份；不要让用户卸载旧 App 来更新。

Apple Developer 会员与网页登录不等于命令行签名凭据；GitHub Pages 的发布也不是 iOS 发布。

## 本轮已添加的代码与配置

- 本地 Expo 模块 `modules/mood-health`，真实 Swift HealthKit State of Mind 查询与写入接口。
- 设置中的 Apple 健康面板：明确授权、手动读取、批量写入前确认、来源 / 当下情绪 / 一天整体心情区分、权限不足和失败状态。
- `com.apple.developer.healthkit` entitlement 与中文读写用途说明。
- iOS 最低系统 15.1；心境接入在运行时要求 iOS 18+，旧系统仍能使用日记。
- `eas.json` 的 simulator / production 构建和现有 App 的提交配置；已绑定真实 EAS 项目，没有向仓库提交密码、证书或 API key。
- `.github/workflows/verify-ios.yml` 验证实际 Swift 与模拟器链接，**不签名、不上传 TestFlight**。

## 已核验的发布进度

- EAS 已登录个人账号 `zhen2yu`，项目为 [@zhen2yu/moodtracker](https://expo.dev/accounts/zhen2yu/projects/moodtracker)，ID：`427558a5-13db-42e4-a992-8a5167b5bffe`。
- 已核对 Free 计划，本轮构建前 iOS 包含额度为 15 次、已用 0 次；未开启付费订阅。这是当时用量快照，不代表后续剩余额度。
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

本轮上传已经完成，不要重新提交同一构建。以下步骤仅供后续新版本使用：先安装并核实 EAS CLI 23.2.0，核对账号与签名凭据，再在项目目录执行：

```sh
eas --version
eas whoami
eas build --platform ios --profile production --non-interactive --freeze-credentials
# 确认新构建成功后，将其精确 ID 设为 VERIFIED_EAS_BUILD_ID 再提交。
eas submit --platform ios --profile production --id "$VERIFIED_EAS_BUILD_ID" --non-interactive --wait --no-auto-testflight-setup
```

提交时明确选择已核对的新构建，不凭 `--latest` 猜测是否为正确包。应用专用密码仅通过受控上传进程的环境传入，不放入命令行参数、日志、`eas.json` 或仓库。首次签名配置必须核实 HealthKit capability 已存在于 provisioning profile 中；旧 profile 可能需要重新生成。

simulator / production 均固定 Node.js `22.23.1` 与 EAS 镜像 `macos-sequoia-15.6-xcode-26.2`，不使用 `latest` 镜像别名。上传前仍须核实符合 Apple 当时的 SDK 最低要求。EAS 设置 `MOODTRACKER_BUILD_TARGET=native`，`app.config.js` 仅在原生构建时强制空 base URL，避免携带 GitHub Pages 的 `/moodtracker/` 子路径；不向 EAS 传入空环境变量值。

EAS Submit 只负责上传二进制。每次上传后都需等待 Apple 处理，在 App Store Connect 核对版本 / build / 状态，并确认既有内部 TestFlight 组的可用性。本轮上述步骤已核实完成；仍不得把构建队列、上传完成、Apple 处理完毕、TestFlight 可安装、App Store 正式审核通过混称为“已上线”。

已设置 `ios.config.usesNonExemptEncryption=false`，并用 `expo config --type introspect` 及最终签名 IPA 核实 Info.plist 中 `ITSAppUsesNonExemptEncryption` 为布尔 `false`。[Expo 官方配置说明](https://docs.expo.dev/versions/latest/config/app/#usesnonexemptencryption)

当前代码与锁定依赖未发现自定义加密、VPN 或非系统加密实现。Expo 的摘要计算使用 Apple CryptoKit，网络使用系统 URLSession；MoodHealth 使用系统 HealthKit。Apple 明确说明，仅使用 Apple 操作系统提供的加密时，无需向 App Store Connect 上传加密文档；无加密或仅使用豁免加密可将该键设为 `NO`。这不是“完全没有加密”或免除所有出口合规义务的声明；依赖、加密功能或分发要求变化时必须重新核对。[Apple 文档要求](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption)、[Apple 声明规则](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)

App Store 正式发布还需要元数据、截图、隐私信息、审核和分发状态；当前配置不会自动替所有者提交未准备好的商店版本。

## 真机必须验收的项目

下面不是已经完成的测试报告，需在签名的 iPhone 包上逐项验收：

1. 覆盖安装旧版，检查原有日记、笔记、日期和活动；导出一份可恢复的 JSON 备份。
2. iOS 15.1–17 不调用 State of Mind，日记功能仍可用；iOS 18+ 显示健康连接入口。
3. 第一次打开设置不弹健康授权；只有点读取 / 确认写入后才申请对应权限。
4. 在独立测试设备或测试安装上验收全新安装：不授予读取权限，只允许写入，确认第一条记录能够保存到健康；再次写入同一条不能生成重复样本。不要为此卸载用户保有日记的旧 App。
5. 分别允许、拒绝、撤回读取与写入权限；读取为空不能显示成“已授权 / 没有任何记录”。
6. 从健康 App 或 Apple Watch 正念保存一条当下情绪和一天整体心情，确认来源、时间、类型、原始愉悦度在本页正确显示。
7. 将带笔记的本地记录写入健康；核对时间、五档近似映射与关联。笔记不能出现在样本或 metadata 中。
8. 重复写入、失败重试、修改后再写入：同一编号只保留正确版本。笔记单独变化不触发健康写入。
9. 系统锁屏 / App 进入后台 / 关闭面板时清除读取结果；再次读取由用户主动触发。
10. 本地删除不删除健康副本；健康删除不触发自动恢复；确认提示与实际行为一致。
11. 拒绝权限、HealthKit 不可用、写入中断、空间不足、损坏导出账本均不清空日记，不伪报全部成功。
12. JSON / CSV 不包含从健康读取的样本、来源、UUID、同步账本；不做用户健康数据联网分析。

本轮 2.1.0（4）已在原内部测试组可用，手机更新方式为 **TestFlight → 情绪记录 → 更新**。若列表尚未刷新，重新打开 TestFlight 查看；不要卸载旧 App。安装新构建并不会使旧的过期 build 自行续期。

## 官方参考

- [Expo 本地模块与原生重建](https://docs.expo.dev/modules/get-started/)
- [Expo iOS 上传与 TestFlight 流程](https://docs.expo.dev/submit/ios/)
- [EAS 构建与提交配置](https://docs.expo.dev/eas/json/)
- [Apple HKStateOfMind](https://developer.apple.com/documentation/healthkit/hkstateofmind)
- [Apple 健康授权](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [TestFlight](https://testflight.apple.com/)
