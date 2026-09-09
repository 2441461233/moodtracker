import XCTest
import UIKit

final class ComposerUITests: XCTestCase {
  let app = XCUIApplication(bundleIdentifier: "com.zhenyu.moodjournal.app")

  override func setUpWithError() throws {
    continueAfterFailure = false
    app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
    app.launch()
    XCTAssertTrue(element("记录一个瞬间").waitForExistence(timeout: 30))
  }

  func element(_ identifier: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: identifier).firstMatch
  }

  func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  // Inspect actual native screenshot pixels, not just the accessibility label.
  // Samples at quarter heights must both be purple, clear of corners and text.
  func assertFullGradient(_ name: String) throws {
    let button = element("composer-next")
    XCTAssertTrue(button.isHittable)
    XCTAssertGreaterThanOrEqual(button.frame.height, 43)
    XCTAssertLessThanOrEqual(button.frame.maxY, app.frame.maxY)
    capture(name)
    let image = try XCTUnwrap(XCUIScreen.main.screenshot().image.cgImage)
    let width = image.width
    let height = image.height
    var rgba = [UInt8](repeating: 0, count: width * height * 4)
    let context = try XCTUnwrap(CGContext(data: &rgba, width: width, height: height,
      bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
    context.draw(image, in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    let scale = CGFloat(width) / app.frame.width
    for fraction in [CGFloat(0.25), CGFloat(0.75)] {
      let x = Int((button.frame.minX + button.frame.width * 0.12) * scale)
      let y = Int((button.frame.minY + button.frame.height * fraction) * scale)
      let offset = (y * width + x) * 4
      let r = Int(rgba[offset]), g = Int(rgba[offset + 1]), b = Int(rgba[offset + 2])
      XCTAssertGreaterThan(b - r, 20, "\(name) missing gradient at y=\(fraction): \(r),\(g),\(b)")
      XCTAssertGreaterThan(b - g, 20, "\(name) missing gradient at y=\(fraction): \(r),\(g),\(b)")
    }
  }

  func flow(theme: String) throws {
    element("我的空间").tap()
    element(theme).tap()
    element("记录一个瞬间").tap()
    let next = element("composer-next")
    XCTAssertTrue(next.waitForExistence(timeout: 10))
    XCTAssertFalse(next.isEnabled)
    capture("\(theme)-01-unselected")
    element("composer-emotion-neutral").tap()
    XCTAssertTrue(next.isEnabled)
    try assertFullGradient("\(theme)-02-continue-selected")
    next.tap()
    XCTAssertTrue(element("composer-activity-work").waitForExistence(timeout: 5))
    element("composer-activity-work").tap()
    try assertFullGradient("\(theme)-03-continue-with-back")
    next.tap()
    XCTAssertTrue(element("voice-start").waitForExistence(timeout: 5))
    XCTAssertFalse(app.keyboards.firstMatch.exists)
    capture("\(theme)-04-voice-default")
    element("composer-mode-text").tap()
    let note = element("composer-note")
    XCTAssertTrue(note.waitForExistence(timeout: 5))
    note.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 2))
    note.typeText("Native UI regression \(theme == "深色" ? "dark" : "light")")
    try assertFullGradient("\(theme)-04-save-with-keyboard")
    element("收起键盘").tap()
    element("composer-back").tap()
    next.tap()
    XCTAssertTrue((note.value as? String)?.contains("Native UI regression") == true)
    try assertFullGradient("\(theme)-05-save-note-retained")
    next.tap()
    XCTAssertTrue(element("记录一个瞬间").waitForExistence(timeout: 10))
    XCTAssertFalse(note.exists)
    element("情绪记录").tap()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Native UI regression")).firstMatch.waitForExistence(timeout: 10))
    capture("\(theme)-06-saved-timeline")
  }

  func testLightRecordFlow() throws { try flow(theme: "浅色") }
  func testDarkRecordFlow() throws { try flow(theme: "深色") }
}
