# iOS 2.1 发布与真机验收

## 现有应用，不新建另一个 App

- Bundle ID：`com.zhenyu.moodjournal.app`
- App Store Connect App ID：`6776595613`（现有“情绪记录”）
- Apple Developer Team：`9PB9F396XQ`
- 本轮版本：2.1.0；本地 buildNumber 起点 2，EAS production 通过远端版本号自动递增。
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
- App Store provisioning profile `JHW9QHZK8M`（MoodTracker AppStore HealthKit 20260903）已生成，并通过本地校验：现有 Team / Bundle ID、HealthKit entitlement、App Store 分发类型和发布证书匹配。**尚未生成签名真机包或上传 TestFlight**。模拟器编译成功不等于真实 HealthKit 读写、签名或手机更新已经验收。

## 构建与上传

当前工作机只有 Command Line Tools，没有完整 Xcode。EAS 登录和项目绑定已经完成，后续签名构建使用云端环境。

登录必须由所有者在官方页面或受控终端中完成。不要把 Apple / Expo 密码、验证码、应用专用密码贴入聊天或提交仓库。生成或授权长期密钥前，确认具体权限与保管方式，不自动扩大账号访问范围。

production 使用 `credentialsSource=local`，由本地提供签名材料，仍由 EAS 云端构建机完成构建与签名，不是本机 Xcode 构建。`credentials.json` 已加入忽略规则；签名材料和密码不进入 Git 仓库。

核对现有账号与签名凭据后，在项目目录执行：

```sh
npx eas-cli@latest whoami
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```

提交时明确选择本轮已核对的构建，不凭 `--latest` 猜测是否为正确包。首次签名配置必须核实 HealthKit capability 已存在于 provisioning profile 中；旧 profile 可能需要重新生成。

simulator / production 均固定 Node.js `22.23.1` 与 EAS 镜像 `macos-sequoia-15.6-xcode-26.2`，不使用 `latest` 镜像别名。上传前仍须核实符合 Apple 当时的 SDK 最低要求。EAS 设置 `MOODTRACKER_BUILD_TARGET=native`，`app.config.js` 仅在原生构建时强制空 base URL，避免携带 GitHub Pages 的 `/moodtracker/` 子路径；不向 EAS 传入空环境变量值。

EAS Submit 只负责上传二进制。仍需等待 Apple 处理，在 App Store Connect 核对版本 / build / 状态，再分配到现有内部 TestFlight 组“个人测试组”。不得把构建队列、上传完成、Apple 处理完毕、TestFlight 可安装、App Store 正式审核通过混称为“已上线”。

已设置 `ios.config.usesNonExemptEncryption=false`，并用 `expo config --type introspect` 核实生成的 Info.plist 中 `ITSAppUsesNonExemptEncryption` 为布尔 `false`；最终签名 IPA 仍需复核实际值。[Expo 官方配置说明](https://docs.expo.dev/versions/latest/config/app/#usesnonexemptencryption)

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

首次签名包通过后，手机更新方式为 **TestFlight → 情绪记录 → 更新**。直到新构建实际可用，旧的过期 build 不会自行续期。

## 官方参考

- [Expo 本地模块与原生重建](https://docs.expo.dev/modules/get-started/)
- [Expo iOS 上传与 TestFlight 流程](https://docs.expo.dev/submit/ios/)
- [EAS 构建与提交配置](https://docs.expo.dev/eas/json/)
- [Apple HKStateOfMind](https://developer.apple.com/documentation/healthkit/hkstateofmind)
- [Apple 健康授权](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [TestFlight](https://testflight.apple.com/)
