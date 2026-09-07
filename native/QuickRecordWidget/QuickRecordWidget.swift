import SwiftUI
import WidgetKit

private let recordURL = URL(string: "moodjournal://record")!

private struct RecordEntry: TimelineEntry {
  let date: Date
}

private struct RecordProvider: TimelineProvider {
  func placeholder(in context: Context) -> RecordEntry {
    RecordEntry(date: Date())
  }

  func getSnapshot(in context: Context, completion: @escaping (RecordEntry) -> Void) {
    completion(RecordEntry(date: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<RecordEntry>) -> Void) {
    // This is an entry point; no diary or health data is read or shown on the Home Screen.
    completion(Timeline(entries: [RecordEntry(date: Date())], policy: .never))
  }
}

private struct RecordView: View {
  @Environment(\.colorScheme) private var colorScheme

  private var accent: Color {
    colorScheme == .dark
      ? Color(red: 0.73, green: 0.68, blue: 1)
      : Color(red: 0.36, green: 0.30, blue: 0.76)
  }

  private var background: Color {
    colorScheme == .dark
      ? Color(red: 0.12, green: 0.10, blue: 0.19)
      : Color(red: 0.96, green: 0.95, blue: 1)
  }

  private var composeIcon: some View {
    Image(systemName: "square.and.pencil")
      .font(.system(size: 25, weight: .medium))
      .foregroundStyle(accent)
      .frame(width: 50, height: 50)
      .background(accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 17))
      .accessibilityHidden(true)
  }

  private var copy: some View {
    VStack(alignment: .leading, spacing: 5) {
      Text("记录这一刻")
        .font(.system(size: 20, weight: .semibold))
        .foregroundStyle(.primary)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
      Text("此刻，你感觉怎么样？")
        .font(.system(size: 12))
        .foregroundStyle(.secondary)
        .lineLimit(2)
    }
  }

  private var content: some View {
    VStack(alignment: .leading, spacing: 10) {
      composeIcon
      Spacer(minLength: 0)
      copy
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("记录这一刻")
    .accessibilityHint("打开新的心情记录")
    .accessibilityAddTraits(.isButton)
    .widgetURL(recordURL)
  }

  var body: some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(for: .widget) { background }
    } else {
      content.padding(16).background(background)
    }
  }
}

struct QuickRecordWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "QuickRecordWidget", provider: RecordProvider()) { _ in
      RecordView()
    }
    .configurationDisplayName("快速记录")
    .description("轻点一下，记录此刻的心情。")
    .supportedFamilies([.systemSmall])
  }
}

@main
struct MoodWidgets: WidgetBundle {
  var body: some Widget {
    QuickRecordWidget()
    MoodCalendarWidget()
  }
}
