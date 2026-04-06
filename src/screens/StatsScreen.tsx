import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { EMOTIONS, getEmotionById } from '../data/emotions';
import {
  getAllEntries,
  getCurrentWeekStart,
} from '../storage';
import { MoodEntry, EmotionId } from '../types';

const { width } = Dimensions.get('window');

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const m1 = weekStart.getMonth() + 1;
  const d1 = weekStart.getDate();
  const m2 = end.getMonth() + 1;
  const d2 = end.getDate();
  if (m1 === m2) return `${m1}月${d1}日 - ${d2}日`;
  return `${m1}月${d1}日 - ${m2}月${d2}日`;
}

interface DaySummary {
  date: Date;
  entries: MoodEntry[];
  dominant: EmotionId | null;
}

export default function StatsScreen() {
  const [weekStart, setWeekStart] = useState<Date>(getCurrentWeekStart());
  const [entries, setEntries] = useState<MoodEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      getAllEntries().then(setEntries);
    }, [])
  );

  const weekDays = getWeekDays(weekStart);

  const weekEntries = entries.filter((e) => {
    const d = new Date(e.timestamp);
    return d >= weekStart && d < new Date(weekStart.getTime() + 7 * 86400000);
  });

  const daySummaries: DaySummary[] = weekDays.map((day) => {
    const dayEntries = entries.filter((e) =>
      sameDay(new Date(e.timestamp), day)
    );
    // dominant = most recent entry of the day
    const dominant =
      dayEntries.length > 0
        ? (dayEntries.sort((a, b) => b.timestamp - a.timestamp)[0]
            .emotionId as EmotionId)
        : null;
    return { date: day, entries: dayEntries, dominant };
  });

  // Count by emotion for this week
  const emotionCounts: Record<string, number> = {};
  weekEntries.forEach((e) => {
    emotionCounts[e.emotionId] = (emotionCounts[e.emotionId] || 0) + 1;
  });

  const maxCount = Math.max(...Object.values(emotionCounts), 1);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    if (next <= new Date()) setWeekStart(next);
  };

  const isCurrentWeek =
    weekStart.getTime() === getCurrentWeekStart().getTime();

  const today = new Date();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>情绪回顾</Text>
        <Text style={styles.subtitle}>了解自己的情绪规律</Text>
      </View>

      {/* Week Navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={prevWeek} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{formatWeekRange(weekStart)}</Text>
        <TouchableOpacity
          onPress={nextWeek}
          style={[styles.navBtn, isCurrentWeek && styles.navBtnDisabled]}
          disabled={isCurrentWeek}
        >
          <Text
            style={[styles.navBtnText, isCurrentWeek && styles.navBtnTextDisabled]}
          >
            ›
          </Text>
        </TouchableOpacity>
      </View>

      {/* Day Pills */}
      <View style={styles.dayRow}>
        {daySummaries.map((s, i) => {
          const isToday = sameDay(s.date, today);
          const emotion = s.dominant ? getEmotionById(s.dominant) : null;
          return (
            <View key={i} style={styles.dayCell}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {DAY_LABELS[i]}
              </Text>
              <View
                style={[
                  styles.dayDot,
                  isToday && styles.dayDotToday,
                  emotion && { backgroundColor: emotion.color + '33' },
                ]}
              >
                {emotion ? (
                  <Text style={styles.dayEmoji}>{emotion.emoji}</Text>
                ) : (
                  <Text style={styles.dayEmpty}>·</Text>
                )}
              </View>
              {isToday && <View style={styles.todayIndicator} />}
            </View>
          );
        })}
      </View>

      {/* Bar Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>本周情绪分布</Text>
        {weekEntries.length === 0 ? (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyEmoji}>🌿</Text>
            <Text style={styles.emptyText}>这周还没有记录</Text>
            <Text style={styles.emptyHint}>回到主页记录第一条吧</Text>
          </View>
        ) : (
          <View style={styles.barsContainer}>
            {EMOTIONS.map((emotion) => {
              const count = emotionCounts[emotion.id] || 0;
              const barHeight = count > 0 ? (count / maxCount) * 100 : 0;
              return (
                <View key={emotion.id} style={styles.barGroup}>
                  <Text style={styles.barCount}>{count > 0 ? count : ''}</Text>
                  <View style={styles.barTrack}>
                    {count > 0 && (
                      <LinearGradient
                        colors={emotion.gradientColors}
                        style={[styles.barFill, { height: `${barHeight}%` }]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                      />
                    )}
                  </View>
                  <Text style={styles.barEmoji}>{emotion.emoji}</Text>
                  <Text style={styles.barLabel}>{emotion.label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Recent entries */}
      {weekEntries.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>本周记录</Text>
          {weekEntries
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10)
            .map((entry) => {
              const emotion = getEmotionById(entry.emotionId);
              if (!emotion) return null;
              const d = new Date(entry.timestamp);
              const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(
                d.getHours()
              ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              return (
                <View key={entry.id} style={styles.entryRow}>
                  <View
                    style={[
                      styles.entryDot,
                      { backgroundColor: emotion.color + '33' },
                    ]}
                  >
                    <Text style={styles.entryEmoji}>{emotion.emoji}</Text>
                  </View>
                  <View style={styles.entryContent}>
                    <Text style={styles.entryEmotion}>{emotion.label}</Text>
                    {entry.note ? (
                      <Text style={styles.entryNote}>{entry.note}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.entryTime}>{timeStr}</Text>
                </View>
              );
            })}
        </View>
      )}

      {/* Mood summary sentence */}
      {weekEntries.length > 0 && (
        <MoodSummary counts={emotionCounts} total={weekEntries.length} />
      )}
    </ScrollView>
  );
}

function MoodSummary({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  const positiveCount =
    (counts['joyful'] || 0) + (counts['good'] || 0);
  const negativeCount =
    (counts['anxious'] || 0) + (counts['sad'] || 0);
  const ratio = positiveCount / total;

  let message = '';
  if (ratio >= 0.7) message = '这周状态不错，继续保持 ☀️';
  else if (ratio >= 0.4) message = '这周有起有落，很正常 🌤';
  else if (negativeCount > positiveCount)
    message = '这周有些低落，给自己多一些关爱 🌿';
  else message = '这周整体还好，照顾好自己 🙂';

  return (
    <LinearGradient
      colors={['#667eea22', '#764ba222']}
      style={styles.summaryCard}
    >
      <Text style={styles.summaryText}>{message}</Text>
      <Text style={styles.summarySubtext}>本周共 {total} 条记录</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#9A9AA8',
    marginTop: 4,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navBtnText: {
    fontSize: 22,
    color: '#3A3A52',
    fontWeight: '600',
    lineHeight: 26,
  },
  navBtnTextDisabled: {
    color: '#C2C2C8',
  },
  weekLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3A3A52',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dayCell: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    fontSize: 12,
    color: '#9A9AA8',
    fontWeight: '500',
    marginBottom: 8,
  },
  dayLabelToday: {
    color: '#667eea',
    fontWeight: '700',
  },
  dayDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotToday: {
    borderWidth: 2,
    borderColor: '#667eea',
  },
  dayEmoji: {
    fontSize: 20,
  },
  dayEmpty: {
    fontSize: 20,
    color: '#C2C2C8',
  },
  todayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#667eea',
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 20,
  },
  emptyChart: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B6B7B',
  },
  emptyHint: {
    fontSize: 13,
    color: '#C2C2C8',
    marginTop: 4,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B7B',
    marginBottom: 4,
    minHeight: 16,
  },
  barTrack: {
    width: 28,
    height: 80,
    backgroundColor: '#F5F5F7',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 10,
  },
  barEmoji: {
    fontSize: 18,
    marginTop: 8,
  },
  barLabel: {
    fontSize: 11,
    color: '#9A9AA8',
    marginTop: 3,
    textAlign: 'center',
  },
  recentSection: {
    marginBottom: 16,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  entryDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  entryEmoji: {
    fontSize: 20,
  },
  entryContent: {
    flex: 1,
  },
  entryEmotion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  entryNote: {
    fontSize: 13,
    color: '#9A9AA8',
    marginTop: 2,
  },
  entryTime: {
    fontSize: 12,
    color: '#C2C2C8',
  },
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 8,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A3A52',
    textAlign: 'center',
  },
  summarySubtext: {
    fontSize: 13,
    color: '#9A9AA8',
    marginTop: 6,
  },
});
