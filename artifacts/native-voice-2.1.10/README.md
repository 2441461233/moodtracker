# 2.1.10 原生键盘验收

所有截图均来自 iPhone 17 Pro / iOS 26.2 模拟器的 Release App，使用合成测试文字，原图未编辑。

- `candidate-15-keyboard.png`：候选构建（15），源码 `88c6a91`。原自动保存流程通过，但人工截图发现正文输入框被遮挡；此包未上传 TestFlight。
- `dark-keyboard-fixed.png`、`light-keyboard-fixed.png`：正式构建（16），源码 `aa004ea003c5d805254e0fb841f4123832a564b8`。[原生运行 34431244763](https://github.com/2441461233/moodtracker/actions/runs/34431244763)通过新增位置断言，人工确认正文、保存与收键盘按钮完整可见。
- `native-ui-summary.json`：最终运行的 XCTest 摘要，两条流程通过、0 失败、0 跳过。

模拟器文字流程不验证真实麦克风、真机回听、云端转写、签名 App Group 的实际小组件同步或真机帧率。完整分发与验证边界见 [发布记录](../../docs/ios-release.md)。
