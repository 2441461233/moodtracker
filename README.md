# 心情日记 · MoodTracker 2.1.1

一个温柔、私密、无需注册的心情空间。保留 Expo / React Native 原生项目，支持 iOS、Android 和响应式网页。

[打开在线版](https://2441461233.github.io/moodtracker/) · [设计与交互验收](design-qa.md) · [依赖安全说明](docs/security.md) · [iOS 发布与验收](docs/ios-release.md)

**当前发布状态**：2.1.1（5）已在既有内部 TestFlight「个人测试组」可用，2026-09-03 07:30 UTC 核实状态为「正在测试」。[签名构建](https://expo.dev/accounts/zhen2yu/projects/moodtracker/builds/6e853857-c58e-41f9-89e0-ec9a3c1c10e4) 已验签，实际签名包含 HealthKit 与 Background Delivery；[上传任务](https://expo.dev/accounts/zhen2yu/projects/moodtracker/submissions/aa6fe5fe-ce47-4e17-9b1d-cc713a160266) 已完成。`npm run verify` 已通过：TypeScript、145 项日记 / 健康 / 原生相关回归、Web 导出和 19 项网页测试。此版将 Apple 心境连接改为一次开启后的自动同步；真实 iPhone 的授权、健康读写及升级数据保留仍待验收。

## 这一版有什么

- **今日心情**：五档感受、七日回看、时间线、本周小结；记录无需完成一长串表单。
- **三步记录**：选择心情 → 可选的 24 项活动 → 可选笔记。支持跳过选填、补记、编辑、删除确认和未保存提示。
- **心情日历**：月历、十二个月的年像素、按日回看、跨日期搜索、心情筛选。
- **情绪洞察**：周 / 月 / 90 天趋势、心情分布、活动关联。数据不足时留白，不生成虚构结论。
- **我的空间**：本地称呼、浅色 / 深色 / 跟随系统、原生触感反馈。
- **Apple 健康心境（2.1.1）**：iOS 18+ 原生包在一次明确开启并授权后，自动写入近一年本地记录及之后的新增、心情 / 时间 / 对应活动修改；Apple 心境变化会刷新只读展示，回到前台会补齐。首页显示最近三条外部来源心境，区分当下情绪与一天整体心情，不混入本地统计、不写文字日记。后台通知由系统调度，不承诺秒级实时。网页版与 Expo Go 不支持。见 [接入边界](docs/apple-health.md)。
- **备份**：JSON 导出 / 合并导入，支持旧版数组格式；CSV 适合自行整理。
- **一分钟呼吸**：可暂停、继续、随时退出；进入后台自动暂停，尊重减少动态效果设置。
- **网页版**：手机浮动导航与快捷记录、桌面侧栏、安装图标、分享预览和离线应用资源缓存。

## 本地运行

使用 Node.js 22 LTS 和 npm。

```bash
npm ci
npm run web
```

原生开发：

```bash
npm start
npm run ios
npm run android
```

普通日记可在与 SDK 54 兼容的 Expo Go 中预览；Apple 健康需要包含本地 Swift 模块的完整原生包，不能通过 Expo Go 或 JS 更新获得。项目已配置现有 iOS App 的 Bundle ID、HealthKit 用途说明与 EAS 构建 / 提交 profile，并完成 [@zhen2yu/moodtracker 项目绑定](https://expo.dev/accounts/zhen2yu/projects/moodtracker)。

**2.1.1（5）已发布到既有内部 TestFlight 测试组**。Apple 已处理完成；2026-09-03 07:30 UTC 在原「个人测试组」核实新构建状态为「正在测试」，原测试员仍在组内，测试说明已保存。手机通过 **TestFlight → 情绪记录 → 更新** 安装；建议先备份，**不要卸载旧 App**。更新后在 **我的 → 连接 Apple 健康 → 开启自动同步** 完成一次启用与授权，旧版的手动授权不会自动开启新版连接。之后无需每次手动同步；前台响应变化、回到 App 自动补齐，后台时效由 iOS 调度。此版沿用现有证书与 profile，没有新建另一款 App。原生编译、签名和分发均不能替代真实 iPhone 上的健康授权与同步验收；历史 2.1.0（4）的发布记录见 [iOS 发布说明](docs/ios-release.md)。内部 TestFlight 发布不等于 App Store 正式上架，网页版部署也不等于 iOS 发布。

生产构建及本地验收：

```bash
npm run verify
npm run preview
```

生产预览地址为 `http://localhost:8097/moodtracker/`。如果端口已被占用，可设置 `MOODTRACKER_PREVIEW_PORT`。开发服务器不带子路径；生产资源使用 GitHub Pages 的 `/moodtracker/` 子路径。

## 数据与隐私

记录使用原有 AsyncStorage 键 `mood_entries`，旧版 emotionId / categoryId / note / timestamp 保持兼容。旧分类自动显示为对应活动，不会在启动时重写旧记录。新记录最多 1,000 字；导入支持旧有的较长笔记，编辑时不会悄悄截断。

- 不要求账户，不接入 AI 情绪分析、广告、追踪统计或自建云同步。用户明确开启 Apple 心境自动同步后，App 才持续响应本地保存和健康变化；可随时关闭。文字笔记不传入健康，系统健康数据的跨设备同步由 Apple 设置管理。
- 网页保存在当前浏览器的当前站点存储，原生保存在应用内；记录不会随代码推送到 GitHub。
- 首次联网完整加载并缓存后，可以离线打开和记录。无痕模式、浏览器清理、存储配额和操作系统回收仍可能影响保存。
- 数据**未单独加密**。请保护设备访问权限，定期导出备份并妥善保管文件。
- 本地日记本体不在不同浏览器 / 设备间自动同步；移动完整日记请导出 JSON 后导入。Apple 健康中的心情由系统管理跨设备同步，不等同于迁移本地文字笔记。
- JSON 备份只包含本地心情记录，不包含称呼、主题、健康读取结果或写入账本。CSV 用于查看，不是恢复格式。
- Apple 心境读取结果只用于前台运行内存展示，进入后台或关闭连接时清除，不创建本地日记、不参与日记统计或导出。在一侧删除不会自动删除另一侧记录。
- 导入只添加新编号，相同编号始终保留本地版本；不会用旧备份覆盖近期编辑。
- 备份最大 10 MB、10,000 条；导出保留恢复所需的完整字段。接近配额或写入失败时，显示错误并保留输入。
- 多次保存进入串行队列；支持 Web Locks 的浏览器还会协调跨标签写入。编辑和删除会检查旧快照冲突。
- 本地格式损坏时进入恢复界面，保留原始内容，提供原始备份导出，不自动清空记录。

网页的 HTML / JS / 图标由 GitHub Pages 提供，因此托管服务仍能看到正常的网页请求元数据；“不上传心情”不意味着所有网络层元数据都不可见。

## 数字如何计算

五档感受依次映射为 5、4、3、2、1，只作为自我回顾的整理工具，不是诊断量表。

1. 使用设备当前时区，先计算每个记录日的平均分。
2. 周 / 月 / 90 天平均值对**有记录的日子等权平均**；缺失日不算零分，曲线不跨缺失日连线。
3. 分布显示记录次数，因此同一天多条记录会分别计数；它与“记录天数”不是同一个指标。
4. 活动关联比较“有该活动的记录日”和“无该活动的记录日”。两组各至少 3 天才显示差值，按差值绝对值排序，可展开查看全部。
5. 前后周期比较也要求两边各至少 3 个记录日。相关不等于因果，不提供医疗建议。
6. 年像素 / 月历颜色代表当天平均心情；连续记录允许今天尚未记录而昨天已经记录，不用“断签”惩罚用户。

## 部署

`.github/workflows/deploy.yml` 在 main 更新时依次执行：

`npm ci → TypeScript 检查 → 日记 / 健康写入 / 原生桥接回归 → Expo Web 导出 → 发布回归 → GitHub Pages`

Pull Request 只检查构建，不发布。Pages 使用 GitHub Actions 工作流模式；无服务器、数据库、支付服务或额外部署账户。

另一个 `verify-ios.yml` 工作流使用 macOS / Xcode 构建未签名的模拟器 App，检查真正的 Swift 编译与自动链接。[2.1.1 已通过的构建](https://github.com/2441461233/moodtracker/actions/runs/33726763418) 实际编译了 App、MoodHealth 模块、自动同步观察器和 AppDelegate subscriber。该 CI 产物不是手机安装包，也不验证后台 HealthKit 通知。历史及当前版本的签名、分发证据与待完成的真机验收见 [iOS 发布说明](docs/ios-release.md)。

`scripts/prepare-web.mjs` 为 Expo 的静态输出添加中文元信息、Open Graph、manifest 和 Service Worker。离线缓存仅包含公开应用资源；版本由资源内容 hash 生成，不强制刷新正在填写的草稿。已有页面可能继续使用当前缓存版本，关闭所有该站点页面再重新打开即可激活已下载的新版本。

更改仓库名、域名或托管子路径时，同步调整 `app.config.js`、构建脚本中的 base URL 与 `scripts/prepare-web.mjs`。不要把私密日记或导出备份提交到仓库。

## 代码结构

```text
App.tsx                   主题、导航、全局弹层
src/components/           可复用组件与记录 / 详情 / 呼吸弹层
src/screens/              今日、日历、洞察、设置
src/context/              应用状态与异步操作
src/storage/              兼容旧版的校验、队列、冲突检查
src/health/               全局自动同步、健康写入映射、独立账本、串行和有界重试
modules/mood-health/      本地 Swift HealthKit 模块与安全降级桥接
src/lib/                  日期、统计、备份、跨平台文件传输
src/data/                 心情、活动与旧分类
tests/                    内存存储、日期、统计、备份回归
scripts/                  生产输出与本地静态预览
```

## 设计来源与资产

本次以 [MoodKit 官方网站](https://moodkit.co/) 展示的现代心情日记产品为交互参考：五档语义颜色、三步记录、四个主导航、日历与活动关联。它不是 Thriveport 的同名 CBT 产品，也不是 MoodKit 官方客户端。

采用中文内容和原项目的五档语义，独立绘制品牌方向；未复制 MoodKit 名称、Logo、付费流程或专有截图作为产品资产。移动端保留轻量弹层，桌面增加侧栏与双栏布局；不制造演示记录、打卡冻结券或未经数据支持的结论。

应用图标与分享图由 ImageGen 生成；`assets/app-icon.png` 为主图标，`brand-icon.png` 为界面内优化尺寸，`pwa-icon.png` 用于安装，`og.png` 用于分享预览。界面图标来自 MaterialCommunityIcons；趋势线是实际数据图表，不是装饰插画。
