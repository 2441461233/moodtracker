# 2.1.9 原生按钮验收截图

源自提交 `9d5f828cd412bfcdf919196a1ad1a409a0f95b7e` 的 [iOS 原生 UI 流水线 34342120308](https://github.com/2441461233/moodtracker/actions/runs/34342120308)。iPhone 17 Pro / iOS 26.2 模拟器运行实际 Release App。图片为 XCTest 原始截图，1206×2622，未裁切或修改；记录均为测试生成的合成文字。

- [浅色：选中心情后的完整继续按钮](light-continue.png)
- [深色：系统键盘打开后的完整保存按钮](dark-keyboard-save.png)
- [XCTest 结果摘要](native-ui-summary.json)：2 项通过，0 项失败或跳过。

完整步骤截图保存在原流水线附件（7 天保留期）。原生截图与像素断言都验证通过；相关修复、发布门槛和真机验证边界见 [验收记录](../../docs/native-button-regression-2026-09-09.md)。
