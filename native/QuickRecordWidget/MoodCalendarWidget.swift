import Foundation
import SwiftUI
import WidgetKit

private struct DayMood: Decodable {
  let emotionId: String
  let count: Int

  var glyph: String {
    switch emotionId {
    case "joyful": return "😄"
    case "good": return "🙂"
    case "neutral": return "😐"
    case "anxious": return "😟"
    case "sad": return "😢"
    default: return "·"
    }
  }

  var label: String {
    switch emotionId {
    case "joyful": return "非常开心"
    case "good": return "心情不错"
    case "neutral": return "平平淡淡"
    case "anxious": return "有点焦虑"
    case "sad": return "很难过"
    default: return "已记录"
    }
  }

  var color: Color {
    switch emotionId {
    case "joyful": return Color(red: 0.91, green: 0.66, blue: 0.27)
    case "good": return Color(red: 0.37, green: 0.68, blue: 0.50)
    case "neutral": return Color(red: 0.40, green: 0.63, blue: 0.82)
    case "anxious": return Color(red: 0.88, green: 0.52, blue: 0.39)
    default: return Color(red: 0.66, green: 0.51, blue: 0.88)
    }
  }
}

private struct CalendarSnapshot: Decodable {
  let version: Int
  let days: [String: DayMood]

  static func read() -> CalendarSnapshot? {
    guard let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: "group.com.zhenyu.moodjournal.app.widgets"
    ), let data = try? Data(contentsOf: container.appendingPathComponent("calendar-v1.json")),
      let snapshot = try? JSONDecoder().decode(CalendarSnapshot.self, from: data),
      snapshot.version == 1 else { return nil }
    return snapshot
  }
}

private struct CalendarEntry: TimelineEntry {
  let date: Date
  let snapshot: CalendarSnapshot?
}

private var monthCalendar: Calendar {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = .current
  calendar.firstWeekday = 2
  return calendar
}

private func dateKey(_ date: Date) -> String {
  let parts = monthCalendar.dateComponents([.year, .month, .day], from: date)
  return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
}

private func calendarURL(_ date: Date) -> URL {
  URL(string: "moodjournal://calendar?date=\(dateKey(date))")!
}

private struct CalendarProvider: TimelineProvider {
  func placeholder(in context: Context) -> CalendarEntry {
    CalendarEntry(date: Date(), snapshot: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (CalendarEntry) -> Void) {
    completion(CalendarEntry(date: Date(), snapshot: CalendarSnapshot.read()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarEntry>) -> Void) {
    let now = Date()
    let snapshot = CalendarSnapshot.read()
    var entries = [CalendarEntry(date: now, snapshot: snapshot)]
    guard snapshot != nil else {
      completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(15 * 60))))
      return
    }
    // Precompute local midnights so today and the displayed month roll over even
    // when the journal stays closed. Data changes request a new timeline from the app.
    for offset in 1...7 {
      if let date = monthCalendar.date(byAdding: .day, value: offset, to: monthCalendar.startOfDay(for: now)) {
        entries.append(CalendarEntry(date: date, snapshot: snapshot))
      }
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

private struct CalendarWidgetView: View {
  let entry: CalendarEntry
  @Environment(\.colorScheme) private var colorScheme
  private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
  private let weekdays = ["一", "二", "三", "四", "五", "六", "日"]

  private var monthStart: Date {
    monthCalendar.date(from: monthCalendar.dateComponents([.year, .month], from: entry.date))!
  }

  private var cells: [Date?] {
    let padding = (monthCalendar.component(.weekday, from: monthStart) + 5) % 7
    let count = monthCalendar.range(of: .day, in: .month, for: monthStart)!.count
    var result = Array<Date?>(repeating: nil, count: padding)
    for offset in 0..<count {
      result.append(monthCalendar.date(byAdding: .day, value: offset, to: monthStart))
    }
    while result.count % 7 != 0 { result.append(nil) }
    return result
  }

  private var recordedDays: Int {
    cells.compactMap { $0 }.filter { entry.snapshot?.days[dateKey($0)] != nil }.count
  }

  private var background: Color {
    colorScheme == .dark
      ? Color(red: 0.10, green: 0.10, blue: 0.15)
      : Color(red: 0.98, green: 0.98, blue: 1)
  }

  private func dayCell(_ date: Date) -> some View {
    let mood = entry.snapshot?.days[dateKey(date)]
    let today = monthCalendar.isDate(date, inSameDayAs: entry.date)
    let future = date > entry.date
    return Link(destination: calendarURL(date)) {
      VStack(spacing: 0) {
        Text("\(monthCalendar.component(.day, from: date))")
          .font(.system(size: 12, weight: today ? .bold : .medium, design: .rounded))
          .foregroundStyle(future ? Color.secondary.opacity(0.5) : Color.primary)
        // A glyph keeps moods distinguishable in tinted / monochrome widget modes.
        Text(mood?.glyph ?? "·")
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
          .opacity(future ? 0 : 1)
      }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
          RoundedRectangle(cornerRadius: 9)
            .fill(mood?.color.opacity(colorScheme == .dark ? 0.45 : 0.18) ?? .clear)
            .padding(1)
        }
        .overlay {
          if today {
            RoundedRectangle(cornerRadius: 9)
              .strokeBorder(Color.accentColor, lineWidth: 1.5).padding(1)
          }
        }
    }
    .accessibilityLabel("\(dateKey(date))，\(today ? "今天，" : "")\(mood.map { "\($0.label)，\($0.count)条记录" } ?? "未记录")")
  }

  private var content: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .firstTextBaseline) {
        Text("\(monthCalendar.component(.month, from: entry.date))月")
          .font(.system(size: 27, weight: .semibold, design: .rounded))
        Text(String(monthCalendar.component(.year, from: entry.date)))
          .font(.system(size: 13, weight: .medium, design: .rounded))
          .foregroundStyle(.secondary)
        Spacer()
        Text("心情日历").font(.system(size: 13, weight: .medium))
      }
      HStack(spacing: 4) {
        ForEach(weekdays, id: \.self) { day in
          Text(day).font(.system(size: 11)).foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
        }
      }
      GeometryReader { geometry in
        let dates = cells
        let rows = dates.count / 7
        let height = max(1, (geometry.size.height - CGFloat(rows - 1) * 4) / CGFloat(rows))
        LazyVGrid(columns: columns, spacing: 4) {
          ForEach(dates.indices, id: \.self) { index in
            if let date = dates[index] {
              dayCell(date).frame(height: height)
            } else {
              Color.clear.frame(height: height).accessibilityHidden(true)
            }
          }
        }
      }
      HStack(spacing: 4) {
        Text(entry.snapshot == nil ? "打开 App，更新日历" : "本月已记录 \(recordedDays) 天")
        Spacer(minLength: 0)
        Text("本地心情")
      }
      .font(.system(size: 11))
      .foregroundStyle(.secondary)
    }
    .widgetURL(calendarURL(entry.date))
    .privacySensitive()
  }

  var body: some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(for: .widget) { background }
    } else {
      content.padding(16).background(background)
    }
  }
}

struct MoodCalendarWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MoodCalendarWidget", provider: CalendarProvider()) { entry in
      CalendarWidgetView(entry: entry)
    }
    .configurationDisplayName("心情日历")
    .description("在桌面回看这个月的本地心情，轻点日期查看记录。")
    .supportedFamilies([.systemLarge])
  }
}
