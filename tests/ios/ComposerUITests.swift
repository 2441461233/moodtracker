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
    var inputGeometry = "Geometry was not sampled"
    let inputVisible = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      let viewport = self.element("sheet-scroll").frame
      // Each frame getter requests a native accessibility snapshot. Re-reading
      // the same element made one sample exceed the old five-second deadline
      // on a loaded runner, even with the input already fully visible.
      let noteFrame = note.frame
      let footerFrame = next.frame
      let hittable = note.isHittable
      inputGeometry = "note=\(noteFrame), viewport=\(viewport), footer=\(footerFrame), hittable=\(hittable)"
      return hittable && noteFrame.minY >= viewport.minY &&
        noteFrame.maxY <= viewport.maxY && noteFrame.maxY < footerFrame.minY
    }, object: nil)
    let visibilityResult = XCTWaiter.wait(for: [inputVisible], timeout: 15)
    capture("\(theme)-04-focused-input-geometry")
    XCTAssertEqual(visibilityResult, .completed,
      "The focused note must stay visible above the footer when the keyboard opens: \(inputGeometry)")
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

  // Exercise the actual ExpoAudio recorder and local files. No provider key or
  // transcription server is configured on this fresh CI simulator.
  func testRecordStopPlaybackAndSaveWithoutTranscriptionService() throws {
    element("记录一个瞬间").tap()
    element("composer-emotion-neutral").tap()
    element("composer-next").tap()
    element("composer-next").tap()
    let start = element("voice-start")
    XCTAssertTrue(start.waitForExistence(timeout: 5))
    start.tap()
    let permission = app.alerts.firstMatch
    if permission.waitForExistence(timeout: 3) {
      let allow = permission.buttons.matching(NSPredicate(format:
        "label == %@ OR label == %@ OR label == %@", "允许", "Allow", "OK")).firstMatch
      XCTAssertTrue(allow.exists, "Unexpected recording permission dialog: \(permission)")
      allow.tap()
    }
    let stop = element("voice-stop")
    XCTAssertTrue(stop.waitForExistence(timeout: 10), "Recorder did not start")
    // Permission/element waits can finish after 00:02 has already passed. The
    // native hierarchy must show at least two seconds, not one exact instant.
    let advancedClock = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@",
      "^(00:(0[2-9]|[1-5][0-9])|0[1-4]:[0-5][0-9]|05:00)$")).firstMatch
    XCTAssertTrue(advancedClock.waitForExistence(timeout: 8), "Native recorder clock did not advance")
    element("voice-pause").tap()
    XCTAssertTrue(element("已暂停，可以继续说").waitForExistence(timeout: 3))
    element("voice-pause").tap()
    XCTAssertTrue(element("正在聆听…").waitForExistence(timeout: 3))
    capture("voice-01-before-stop")
    stop.tap()
    let play = element("voice-play")
    XCTAssertTrue(play.waitForExistence(timeout: 10), "App must survive stop and retain the native recording")
    let playable = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      play.isEnabled && play.isHittable
    }, object: nil)
    XCTAssertEqual(XCTWaiter.wait(for: [playable], timeout: 10), .completed)
    XCTAssertTrue(element("voice-retry").waitForExistence(timeout: 10), "Missing service must be a recoverable error")
    capture("voice-02-retained-without-server")
    play.tap()
    let playing = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      play.label.contains("暂停")
    }, object: nil)
    XCTAssertEqual(XCTWaiter.wait(for: [playing], timeout: 5), .completed)
    play.tap()
    // Switching away unmounts the player. Keep the voice attachment and save.
    element("composer-mode-text").tap()
    let note = element("composer-note")
    note.tap()
    note.typeText("Native voice stop regression")
    element("收起键盘").tap()
    element("composer-mode-voice").tap()
    XCTAssertTrue(element("voice-play").waitForExistence(timeout: 5))
    element("composer-next").tap()
    XCTAssertTrue(element("记录一个瞬间").waitForExistence(timeout: 10))
    element("情绪记录").tap()
    let saved = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Native voice stop regression")).firstMatch
    XCTAssertTrue(saved.waitForExistence(timeout: 10))
    saved.tap()
    XCTAssertTrue(element("voice-play").waitForExistence(timeout: 5))
    capture("voice-03-saved-recording")
  }
}
