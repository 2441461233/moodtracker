# 心情日记 · MoodTracker

一款极简的 iOS 情绪记录 App，用最少的操作记录当下的心情。

## 功能

- **情绪记录** — 5 种情绪选项（很开心 / 还不错 / 还好 / 有点烦 / 很难过）
- **分类标签** — 记录影响情绪的来源（工作 / 生活 / 亲密关系 / 其他）
- **可选备注** — 一句话描述原因，最多 80 字
- **每周统计** — 柱状图展示本周情绪分布，可翻阅历史周
- **本地存储** — 所有数据保存在设备本地，无需账号

## 技术栈

- [Expo](https://expo.dev) (SDK 54) + React Native + TypeScript
- `expo-haptics` — 触感反馈
- `expo-linear-gradient` — 渐变样式
- `@react-navigation/bottom-tabs` — 底部导航
- `@react-native-async-storage/async-storage` — 本地持久化

## 本地开发

**环境要求**：Node.js 18+，手机安装 [Expo Go](https://expo.dev/go)

```bash
# 安装依赖
npm install

# 启动开发服务器（局域网模式）
npx expo start --lan --clear
```

启动后用手机 Expo Go 扫描终端二维码即可预览。

## 版本记录

### v0.0.1
- 初始版本
- 情绪记录 + 分类标签 + 可选备注
- 每周情绪统计与柱状图
- 触感反馈与动画效果
