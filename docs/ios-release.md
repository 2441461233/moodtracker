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
- `eas.json` 的 simulator / production 构建和现有 App 的提交配置。没有编造 EAS projectId，没有提交密码、证书或 API key。
- `.github/workflows/verify-ios.yml` 验证实际 Swift 与模拟器链接，**不签名、不上传 TestFlight**。

## 构建与上传

当前工作机只有 Command Line Tools，没有完整 Xcode。可用云端编译，但 EAS 需要项目所有者的 Expo 登录和真实项目绑定；这些步骤未完成前，不会有签名安装包自动排队。

登录必须由所有者在官方页面或受控终端中完成。不要把 Apple / Expo 密码、验证码、应用专用密码贴入聊天或提交仓库。生成或授权长期密钥前，确认具体权限与保管方式，不自动扩大账号访问范围。

完成所需登录及项目绑定后，在项目目录执行：

```sh
npx eas-cli@latest whoami
npx eas-cli@latest init
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```

提交时明确选择本轮已核对的构建，不凭 `--latest` 猜测是否为正确包。首次签名配置必须核实 HealthKit capability 已存在于 provisioning profile 中；旧 profile 可能需要重新生成。production 使用当前 EAS 最新稳定 Xcode 镜像，上传前核实符合 Apple 当时的 SDK 最低要求。

EAS Submit 只负责上传二进制。仍需等待 Apple 处理，在 App Store Connect 核对版本 / build / 状态，再分配到现有内部 TestFlight 组“个人测试组”。不得把构建队列、上传完成、Apple 处理完毕、TestFlight 可安装、App Store 正式审核通过混称为“已上线”。

App Store 正式发布还需要元数据、截图、隐私信息、审核和分发状态；当前配置不会自动替所有者提交未准备好的商店版本。

## 真机必须验收的项目

下面不是已经完成的测试报告，需在签名的 iPhone 包上逐项验收：

1. 覆盖安装旧版，检查原有日记、笔记、日期和活动；导出一份可恢复的 JSON 备份。
2. iOS 15.1–17 不调用 State of Mind，日记功能仍可用；iOS 18+ 显示健康连接入口。
3. 第一次打开设置不弹健康授权；只有点读取 / 确认写入后才申请对应权限。
4. 分别允许、拒绝、撤回读取与写入权限；读取为空不能显示成“已授权 / 没有任何记录”。
5. 从健康 App 或 Apple Watch 正念保存一条当下情绪和一天整体心情，确认来源、时间、类型、原始愉悦度在本页正确显示。
6. 将带笔记的本地记录写入健康；核对时间、五档近似映射与关联。笔记不能出现在样本或 metadata 中。
7. 重复写入、失败重试、修改后再写入：同一编号只保留正确版本。笔记单独变化不触发健康写入。
8. 系统锁屏 / App 进入后台 / 关闭面板时清除读取结果；再次读取由用户主动触发。
9. 本地删除不删除健康副本；健康删除不触发自动恢复；确认提示与实际行为一致。
10. 拒绝权限、HealthKit 不可用、写入中断、空间不足、损坏导出账本均不清空日记，不伪报全部成功。
11. JSON / CSV 不包含从健康读取的样本、来源、UUID、同步账本；不做用户健康数据联网分析。

首次签名包通过后，手机更新方式为 **TestFlight → 情绪记录 → 更新**。直到新构建实际可用，旧的过期 build 不会自行续期。

## 官方参考

- [Expo 本地模块与原生重建](https://docs.expo.dev/modules/get-started/)
- [Expo iOS 上传与 TestFlight 流程](https://docs.expo.dev/submit/ios/)
- [EAS 构建与提交配置](https://docs.expo.dev/eas/json/)
- [Apple HKStateOfMind](https://developer.apple.com/documentation/healthkit/hkstateofmind)
- [Apple 健康授权](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [TestFlight](https://testflight.apple.com/)
