import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import { useMood } from '../context/MoodContext';
import { useTimeline } from '../health/useTimeline';
import {
  groupTimelineByDay,
  timelineDailyAverage,
  timelineDayScore,
  timelineInRange,
} from '../health/timeline';
import { Card, EmptyState, Icon, Label, MoodIcon, SectionTitle, Button } from '../components/ui';
import { Page } from '../components/Page';
import { TimelineList } from '../components/TimelineList';
import { HealthTimelineNotice } from '../components/HealthTimelineNotice';
import { addDays, dayKey, formatDate, getGreeting, startOfWeek, WEEKDAYS } from '../lib/dates';
import { currentStreak, emotionForScore } from '../lib/insights';
import { MOOD_APPEARANCE, useLayout, useTheme } from '../theme';
import { EmotionId } from '../types';

export default function TodayScreen() {
  const { entries, settings, now, openComposer, openDetail, setBreathing } = useMood();
  const { records, health } = useTimeline();
  const theme = useTheme();
  const { desktop, compact, width } = useLayout();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [selected, setSelected] = useState<string | null>(null);
  const selectedKey = selected ?? dayKey(now);
  const weekStart = startOfWeek(now);
  const weekRecords = timelineInRange(records, weekStart, addDays(weekStart, 7));
  const weekGroups = groupTimelineByDay(weekRecords);
  const selectedRecords = records.filter((record) => dayKey(record.timestamp) === selectedKey);
  const selectedAppleCount = selectedRecords.filter((record) => record.type === 'apple').length;
  const weekAppleCount = weekRecords.filter((record) => record.type === 'apple').length;
  const average = timelineDailyAverage(weekRecords);
  const streak = currentStreak(entries, now);
  const ids = Object.keys(MOOD_APPEARANCE) as EmotionId[];
  return (
    <Page
      eyebrow={formatDate(now, true)}
      title={`${getGreeting()}${settings.name ? `，${settings.name}` : '，给心情一点空间'}`}
      subtitle="不必每一天都很好，但每一天都值得被看见。"
    >
      <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 24, alignItems: 'stretch' }}>
        <View style={{ flex: desktop ? 1.7 : undefined, gap: 24, minWidth: 0 }}>
          <Card style={{ padding: compact ? 22 : 28 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 22,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Icon name="white-balance-sunny" size={17} color={theme.accentText} />
                <Label
                  style={{
                    color: theme.accentText,
                    fontSize: 11,
                    letterSpacing: 1.8,
                    fontWeight: '600',
                  }}
                >
                  A MOMENT FOR YOU
                </Label>
              </View>
              <Label muted style={{ fontSize: 11 }}>
                约 10 秒
              </Label>
            </View>
            <Label
              accessibilityRole="header"
              style={{
                fontSize: width < 360 ? 20 : compact ? 23 : 26,
                lineHeight: 37,
                fontWeight: '600',
                letterSpacing: -0.5,
              }}
            >
              此刻，你的心情怎么样？
            </Label>
            <Label muted style={{ marginTop: 8, fontSize: 13 }}>
              没有标准答案，选一个最接近的感受。
            </Label>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 29,
                marginBottom: 25,
                gap: compact ? 3 : 8,
              }}
            >
              {ids.map((id) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`记录心情：${MOOD_APPEARANCE[id].label}`}
                  onPress={() => openComposer({ emotionId: id })}
                  style={({ pressed, hovered }) => ({
                    flex: 1,
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 9,
                    borderRadius: 16,
                    backgroundColor: hovered ? theme.subtle : 'transparent',
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  })}
                >
                  <MoodIcon id={id} size={compact ? (width < 360 ? 43 : 49) : 60} />
                  <Label style={{ fontSize: compact ? 11 : 13, color: theme.secondary }}>
                    {MOOD_APPEARANCE[id].label}
                  </Label>
                </Pressable>
              ))}
            </View>
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: theme.border,
                paddingTop: 17,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <Icon name="lock-outline" size={13} color={theme.muted} />
              <Label muted style={{ fontSize: 11, flex: 1 }}>
                {health.enabled
                  ? '已连接 Apple 健康，文字笔记仍留在本地。'
                  : '只属于你的心情，留在这台设备。'}
              </Label>
            </View>
          </Card>
          <Card style={{ padding: compact ? 18 : 24 }}>
            <SectionTitle
              title="这一周，和自己在一起"
              action="查看日历"
              onAction={() => navigation.navigate('calendar')}
            />
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {Array.from({ length: 7 }, (_, index) => {
                const date = addDays(weekStart, index);
                const key = dayKey(date);
                const active = key === selectedKey;
                const dayRecords = weekGroups.get(key) ?? [];
                const future = key > dayKey(now);
                const last = [...dayRecords].sort((a, b) => b.timestamp - a.timestamp)[0];
                const dayMood = health.enabled
                  ? emotionForScore(timelineDayScore(dayRecords))
                  : (last?.emotionId ?? null);
                const appleCount = dayRecords.filter((record) => record.type === 'apple').length;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDate(date)}，${dayRecords.length} 条记录${appleCount ? `，含 ${appleCount} 条 Apple 心境` : ''}`}
                    accessibilityState={{ selected: active, disabled: future }}
                    disabled={future}
                    onPress={() => setSelected(key)}
                    style={({ pressed }) => ({
                      flex: 1,
                      alignItems: 'center',
                      borderRadius: 17,
                      paddingVertical: 12,
                      gap: 10,
                      minHeight: 89,
                      opacity: future ? 0.35 : pressed ? 0.7 : 1,
                      backgroundColor: active ? theme.accent : 'transparent',
                    })}
                  >
                    <Label
                      style={{ color: active ? theme.surface : theme.secondary, fontSize: 11 }}
                    >
                      周{WEEKDAYS[index]}
                    </Label>
                    <Label
                      style={{
                        color: active ? theme.surface : theme.text,
                        fontSize: 18,
                        fontWeight: '600',
                      }}
                    >
                      {date.getDate()}
                    </Label>
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: active
                          ? theme.surface
                          : dayMood
                            ? MOOD_APPEARANCE[dayMood].color
                            : theme.border,
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
          </Card>
          <View>
            {health.enabled && <HealthTimelineNotice />}
            <SectionTitle
              title={
                selectedKey === dayKey(now)
                  ? '今天的心情足迹'
                  : `${Number(selectedKey.slice(5, 7))}月${Number(selectedKey.slice(8))}日的心情足迹`
              }
              subtitle={
                health.enabled && !health.hasRead
                  ? `${selectedRecords.length} 条本地记录 · Apple 心境待载入`
                  : selectedAppleCount
                    ? `${selectedRecords.length - selectedAppleCount} 条本地日记 · ${selectedAppleCount} 条 Apple 心境（只读）`
                    : `${selectedRecords.length} 个被好好记住的瞬间`
              }
            />
            {selectedRecords.length ? (
              <TimelineList key={selectedKey} records={selectedRecords} onPressLocal={openDetail} />
            ) : (
              <Card style={{ padding: 8 }}>
                <EmptyState
                  title={health.enabled ? '这一天暂无已载入记录' : '故事，从这一刻开始'}
                  description={
                    health.enabled
                      ? 'Apple 心境是否已读取请以上方连接状态为准。你也可以留下一条本地心情记录。'
                      : '开心、平淡或有点累，都可以留在这里。你的第一条记录，不需要很特别。'
                  }
                  action="记下这一刻"
                  onAction={() => openComposer({ date: new Date(`${selectedKey}T12:00:00`) })}
                />
              </Card>
            )}
          </View>
        </View>
        <View style={{ flex: desktop ? 1 : undefined, gap: 24, minWidth: 0 }}>
          <Card>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 22,
              }}
            >
              <Label style={{ fontSize: 16, fontWeight: '600' }}>本周小回顾</Label>
              <View
                style={{
                  width: 34,
                  height: 34,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: theme.accentSoft,
                }}
              >
                <Icon name="chart-timeline-variant" size={18} color={theme.accentText} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 20, marginBottom: 24 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Label
                  style={{ fontSize: 34, lineHeight: 42, fontWeight: '600', letterSpacing: -1 }}
                >
                  {weekGroups.size}
                  <Label muted style={{ fontSize: 12 }}>
                    {' '}
                    / 7 天
                  </Label>
                </Label>
                <Label muted style={{ fontSize: 12 }}>
                  与自己相处
                </Label>
              </View>
              <View style={{ width: 1, backgroundColor: theme.border }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Label
                  style={{ fontSize: 34, lineHeight: 42, fontWeight: '600', letterSpacing: -1 }}
                >
                  {average === null ? '—' : average.toFixed(1)}
                  <Label muted style={{ fontSize: 12 }}>
                    {' '}
                    / 5
                  </Label>
                </Label>
                <Label muted style={{ fontSize: 12 }}>
                  平均心情
                </Label>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 17 }}>
              {Array.from({ length: 7 }, (_, index) => (
                <View
                  key={index}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: weekGroups.has(dayKey(addDays(weekStart, index)))
                      ? theme.accent
                      : theme.subtle,
                  }}
                />
              ))}
            </View>
            <Label muted style={{ fontSize: 12, lineHeight: 21 }}>
              {weekRecords.length
                ? `已经留下 ${weekRecords.length} 个瞬间${weekAppleCount ? `，含 ${weekAppleCount} 条 Apple 心境` : ''}。记录不必完美，真实就好。`
                : '不赶进度，不追求满分。每一次记录，都在更靠近自己。'}
            </Label>
            {weekAppleCount > 0 && (
              <Label muted style={{ fontSize: 10, lineHeight: 19, marginTop: 9 }}>
                Apple 愉悦度近似映射到 1–5
                档用于展示。一天有“整体心情”时优先采用其均值，否则采用当下情绪均值；各记录日等权。
              </Label>
            )}
            <Button
              kind="ghost"
              onPress={() => navigation.navigate('insights')}
              icon="arrow-top-right"
              style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 8 }}
            >
              探索我的情绪
            </Button>
          </Card>
          <Card
            style={{ backgroundColor: theme.accentSoft, borderColor: 'transparent', padding: 25 }}
          >
            <View style={{ alignItems: 'flex-start', gap: 16 }}>
              <Icon name="weather-windy" size={28} color={theme.accentText} />
              <View style={{ gap: 9 }}>
                <Label style={{ fontSize: 20, fontWeight: '600', lineHeight: 29 }}>
                  让心情，轻一点。
                </Label>
                <Label style={{ color: theme.secondary, fontSize: 13, lineHeight: 23 }}>
                  给自己一分钟。{desktop ? '\n' : ''}放下手边的事，跟着呼吸慢下来。
                </Label>
              </View>
              <Button
                kind="secondary"
                onPress={() => setBreathing(true)}
                icon="play-outline"
                style={{ backgroundColor: theme.surface }}
              >
                开始呼吸 · 1 分钟
              </Button>
            </View>
          </Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              paddingHorizontal: 6,
            }}
          >
            <Icon name="sprout-outline" color={theme.green} size={26} />
            <View style={{ flex: 1, gap: 5 }}>
              <Label style={{ fontSize: 13, fontWeight: '600' }}>
                {streak > 0
                  ? health.enabled
                    ? `已连续记录本地心情 ${streak} 天`
                    : `已连续关照自己 ${streak} 天`
                  : '慢慢来，也在向前'}
              </Label>
              <Label muted style={{ fontSize: 12, lineHeight: 21 }}>
                偶尔忘记也没关系。{desktop ? '\n' : ''}这里一直为你留着一个位置。
              </Label>
            </View>
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'center', paddingTop: 8 }}>
        <Label muted style={{ fontSize: 10, letterSpacing: 1.3 }}>
          A LITTLE MORE AWARE, A LITTLE MORE YOU.
        </Label>
      </View>
    </Page>
  );
}
