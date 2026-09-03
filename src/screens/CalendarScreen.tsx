import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useMood } from '../context/MoodContext';
import { Page } from '../components/Page';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  Label,
  SectionTitle,
  Segment,
} from '../components/ui';
import { TimelineList } from '../components/TimelineList';
import { HealthTimelineNotice } from '../components/HealthTimelineNotice';
import { dayKey, formatDate, monthDays, parseLocalDate, WEEKDAYS } from '../lib/dates';
import {
  filterTimeline,
  groupTimelineByDay,
  timelineDailyAverage,
  timelineDayScore,
  timelineInRange,
  type TimelineSource,
} from '../health/timeline';
import { useTimeline } from '../health/useTimeline';
import { emotionForScore } from '../lib/insights';
import { font, MOOD_APPEARANCE, useLayout, useTheme } from '../theme';
import { EmotionId } from '../types';

export default function CalendarScreen() {
  const { now, openComposer, openDetail } = useMood();
  const { records, health } = useTimeline();
  const theme = useTheme();
  const { desktop, compact } = useLayout();
  const route = useRoute();
  const requestedDate = (route.params as { date?: string } | undefined)?.date;
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(dayKey(now));
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<EmotionId | 'all'>('all');
  const [source, setSource] = useState<TimelineSource>('all');
  const sourceRecords = useMemo(() => filterTimeline(records, { source }), [records, source]);
  const grouped = useMemo(() => groupTimelineByDay(sourceRecords), [sourceRecords]);
  useEffect(() => {
    if (!requestedDate) return;
    const date = parseLocalDate(requestedDate);
    if (date) {
      setSelected(requestedDate);
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      setMode('month');
    }
  }, [requestedDate]);
  const monthEntries = timelineInRange(
    sourceRecords,
    mode === 'year' ? new Date(month.getFullYear(), 0, 1) : month,
    mode === 'year'
      ? new Date(month.getFullYear() + 1, 0, 1)
      : new Date(month.getFullYear(), month.getMonth() + 1, 1),
  );
  const average = timelineDailyAverage(monthEntries);
  const monthGroups = groupTimelineByDay(monthEntries);
  const search = query.trim();
  const filtered = filterTimeline(sourceRecords, {
    emotionId: filter,
    query: search || undefined,
    day: search ? undefined : selected,
  });
  const sourceLabel =
    source === 'local' ? '本地日记' : source === 'apple' ? 'Apple 健康' : '全部来源';
  const applePending = source !== 'local' && health.enabled && !health.hasRead;
  const appleUnavailable =
    source === 'apple' && (!health.availability.available || !health.enabled);
  const emptyHealthTitle = appleUnavailable
    ? 'Apple 心境尚未连接'
    : applePending
      ? health.error
        ? 'Apple 心境暂时无法读取'
        : '正在等待 Apple 心境'
      : null;
  const shift = (direction: number) =>
    setMonth(
      new Date(
        month.getFullYear() + (mode === 'year' ? direction : 0),
        month.getMonth() + (mode === 'month' ? direction : 0),
        1,
      ),
    );
  const canNext =
    mode === 'month'
      ? dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)) <= dayKey(now)
      : month.getFullYear() < now.getFullYear();
  const canPrevious =
    mode === 'month'
      ? month.getFullYear() > 1970 || month.getMonth() > 0
      : month.getFullYear() > 1970;
  const choose = (date: Date) => {
    setSelected(dayKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setMode('month');
    setQuery('');
  };
  return (
    <Page
      eyebrow="YOUR DAYS, IN COLOR"
      title="每一天，都有自己的颜色"
      subtitle="把零散的瞬间连起来，慢慢看见真实的自己。"
    >
      <View style={{ gap: 12, marginBottom: 20 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <View style={{ gap: 4 }}>
            <Label style={{ fontSize: 13, fontWeight: '600' }}>记录来源</Label>
            <Label muted style={{ fontSize: 11 }}>
              月历、年像素和期间回顾使用同一来源范围
            </Label>
          </View>
          <Segment<TimelineSource>
            options={[
              { id: 'all', label: '全部' },
              { id: 'local', label: '本地' },
              { id: 'apple', label: 'Apple 健康' },
            ]}
            value={source}
            onChange={setSource}
          />
        </View>
        {source !== 'local' && <HealthTimelineNotice />}
      </View>
      <View
        style={{ flexDirection: desktop ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}
      >
        <View
          style={{
            flex: desktop ? 1.35 : undefined,
            width: desktop ? undefined : '100%',
            gap: 20,
            minWidth: 0,
          }}
        >
          <Card style={{ padding: compact ? 16 : 25 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 23,
                gap: 8,
              }}
            >
              <Label style={{ fontSize: 19, fontWeight: '600' }}>
                {month.getFullYear()}年{mode === 'month' ? ` ${month.getMonth() + 1}月` : ''}
              </Label>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                <IconButton
                  label={mode === 'month' ? '上一个月' : '上一年'}
                  name="chevron-left"
                  onPress={() => shift(-1)}
                  disabled={!canPrevious}
                />
                <IconButton
                  label={mode === 'month' ? '下一个月' : '下一年'}
                  name="chevron-right"
                  onPress={() => shift(1)}
                  disabled={!canNext}
                />
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 22,
              }}
            >
              <Segment
                options={[
                  { id: 'month', label: '月历' },
                  { id: 'year', label: '年像素' },
                ]}
                value={mode}
                onChange={setMode}
              />
              <Button kind="ghost" onPress={() => choose(now)} style={{ paddingHorizontal: 9 }}>
                回到今天
              </Button>
            </View>
            {mode === 'month' ? (
              <>
                <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                  {WEEKDAYS.map((day) => (
                    <Label key={day} muted style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
                      {day}
                    </Label>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
                  {monthDays(month).map((date, index) => {
                    if (!date) return <View key={`empty-${index}`} style={{ width: '14.2857%' }} />;
                    const key = dayKey(date);
                    const active = key === selected;
                    const future = key > dayKey(now);
                    const dayRecords = grouped.get(key) ?? [];
                    const score = timelineDayScore(dayRecords);
                    const appleCount = dayRecords.filter(
                      (record) => record.type === 'apple',
                    ).length;
                    const emotion = emotionForScore(score);
                    const mood = emotion ? MOOD_APPEARANCE[emotion] : null;
                    return (
                      <View key={key} style={{ width: '14.2857%', paddingHorizontal: 2 }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${formatDate(date)}，${sourceLabel}，${dayRecords.length ? `${dayRecords.length} 条记录，近似心情 ${score!.toFixed(1)} 分${appleCount ? `，其中 ${appleCount} 条来自 Apple 健康` : ''}` : applePending || appleUnavailable ? '尚无已载入的记录，Apple 心境仍待读取' : '当前来源未载入记录'}`}
                          accessibilityState={{ selected: active, disabled: future }}
                          disabled={future}
                          onPress={() => {
                            setSelected(key);
                            setQuery('');
                          }}
                          style={({ pressed }) => ({
                            minHeight: compact ? 56 : 66,
                            paddingVertical: 8,
                            borderRadius: 15,
                            borderWidth: active ? 2 : 1,
                            borderColor: active ? theme.accent : 'transparent',
                            backgroundColor: active
                              ? theme.accentSoft
                              : mood
                                ? theme.background === '#171821'
                                  ? mood.dark
                                  : mood.soft
                                : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                            opacity: future ? 0.28 : pressed ? 0.6 : 1,
                          })}
                        >
                          {appleCount > 0 && (
                            <View style={{ position: 'absolute', top: 4, right: 4 }}>
                              <Icon name="heart" size={9} color={theme.danger} />
                            </View>
                          )}
                          <Label
                            style={{
                              fontSize: 14,
                              fontWeight: active || key === dayKey(now) ? '700' : '400',
                              color: active ? theme.accentText : theme.text,
                            }}
                          >
                            {date.getDate()}
                          </Label>
                          {emotion ? (
                            <Icon
                              name={MOOD_APPEARANCE[emotion].icon}
                              size={18}
                              color={active ? theme.accentText : MOOD_APPEARANCE[emotion].color}
                            />
                          ) : (
                            <View
                              style={{
                                height: 5,
                                width: 5,
                                borderRadius: 3,
                                marginVertical: 6,
                                backgroundColor: key === dayKey(now) ? theme.accent : 'transparent',
                              }}
                            />
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 22, columnGap: 12 }}>
                {Array.from({ length: 12 }, (_, index) => {
                  const date = new Date(month.getFullYear(), index, 1);
                  const days = monthDays(date);
                  const appleMonthCount = days.reduce(
                    (count, day) =>
                      count +
                      (day
                        ? (grouped.get(dayKey(day)) ?? []).filter(
                            (record) => record.type === 'apple',
                          ).length
                        : 0),
                    0,
                  );
                  return (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      accessibilityLabel={`查看 ${date.getFullYear()}年${index + 1}月，${sourceLabel}${appleMonthCount ? `，包含 ${appleMonthCount} 条 Apple 心境` : ''}`}
                      disabled={dayKey(date) > dayKey(now)}
                      onPress={() =>
                        choose(dayKey(date).slice(0, 7) === dayKey(now).slice(0, 7) ? now : date)
                      }
                      style={{
                        width: '30%',
                        flexGrow: 1,
                        minWidth: 80,
                        opacity: dayKey(date) > dayKey(now) ? 0.35 : 1,
                        gap: 8,
                        paddingBottom: 4,
                      }}
                    >
                      <Label style={{ fontSize: 12, fontWeight: '600' }}>{index + 1}月</Label>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {days.map((day, i) => {
                          const dayRecords = day ? (grouped.get(dayKey(day)) ?? []) : [];
                          const id = day ? emotionForScore(timelineDayScore(dayRecords)) : null;
                          const hasApple = dayRecords.some((record) => record.type === 'apple');
                          return (
                            <View
                              key={i}
                              style={{ width: '14.2857%', aspectRatio: 1, padding: 1.5 }}
                            >
                              <View
                                style={{
                                  flex: 1,
                                  borderRadius: 2,
                                  borderWidth: hasApple ? 1 : 0,
                                  borderColor: theme.danger,
                                  backgroundColor: !day
                                    ? 'transparent'
                                    : id
                                      ? MOOD_APPEARANCE[id].color
                                      : theme.subtle,
                                }}
                              />
                            </View>
                          );
                        })}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View
              style={{
                paddingTop: 22,
                marginTop: 20,
                borderTopWidth: 1,
                borderTopColor: theme.border,
                gap: 11,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: 13,
                }}
              >
                {(Object.keys(MOOD_APPEARANCE) as EmotionId[]).map((id) => (
                  <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 3,
                        backgroundColor: MOOD_APPEARANCE[id].color,
                      }}
                    />
                    <Label muted style={{ fontSize: 10 }}>
                      {MOOD_APPEARANCE[id].label}
                    </Label>
                  </View>
                ))}
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                <Icon name="heart" size={11} color={theme.danger} />
                <Label muted style={{ fontSize: 10 }}>
                  爱心 / 像素描边表示含 Apple 心境
                </Label>
              </View>
              <Label muted style={{ fontSize: 10, lineHeight: 18, textAlign: 'center' }}>
                当前来源中若有“一天整体心情”，当天颜色优先取其均值；否则取“当下情绪”均值。Apple
                愉悦度映射到 1–5 分，仅作近似回顾。
              </Label>
            </View>
          </Card>
          <Card style={{ padding: 21, gap: 15 }}>
            <View style={{ gap: 5 }}>
              <Label style={{ fontSize: 12, fontWeight: '600' }}>
                {mode === 'year' ? '年度回顾' : '本月回顾'} · {sourceLabel}
              </Label>
              <Label muted style={{ fontSize: 10, lineHeight: 18 }}>
                仅统计当前来源已载入的记录；有记录的日子等权平均。
                {source !== 'local' ? 'Apple 心境范围以当前读取状态为准。' : ''}
              </Label>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, alignItems: 'center', gap: 7 }}>
                <Label style={{ fontSize: 26, lineHeight: 33, fontWeight: '600' }}>
                  {source === 'apple' && !health.hasRead ? '—' : monthGroups.size}
                  <Label muted style={{ fontSize: 11 }}>
                    {' '}
                    天
                  </Label>
                </Label>
                <Label muted style={{ fontSize: 11 }}>
                  {mode === 'year' ? '这一年的陪伴' : '这个月的陪伴'}
                </Label>
              </View>
              <View style={{ width: 1, backgroundColor: theme.border }} />
              <View style={{ flex: 1, alignItems: 'center', gap: 7 }}>
                <Label style={{ fontSize: 26, lineHeight: 33, fontWeight: '600' }}>
                  {source === 'apple' && !health.hasRead ? '—' : monthEntries.length}
                  <Label muted style={{ fontSize: 11 }}>
                    {' '}
                    条
                  </Label>
                </Label>
                <Label muted style={{ fontSize: 11 }}>
                  心境记录
                </Label>
              </View>
              <View style={{ width: 1, backgroundColor: theme.border }} />
              <View style={{ flex: 1, alignItems: 'center', gap: 7 }}>
                <Label style={{ fontSize: 26, lineHeight: 33, fontWeight: '600' }}>
                  {average === null ? '—' : average.toFixed(1)}
                </Label>
                <Label muted style={{ fontSize: 11 }}>
                  {source !== 'local' ? '近似' : ''}
                  {mode === 'year' ? '年平均心情' : '月平均心情'}
                </Label>
              </View>
            </View>
          </Card>
        </View>
        <View
          style={{
            flex: desktop ? 1 : undefined,
            width: desktop ? undefined : '100%',
            minWidth: 0,
            gap: 18,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 15,
              paddingHorizontal: 14,
            }}
          >
            <Icon name="magnify" size={21} />
            <TextInput
              accessibilityLabel="跨日期搜索当前来源的笔记、活动、心情或 Apple 来源"
              placeholder="搜索笔记、活动、心情或来源"
              placeholderTextColor={theme.muted}
              value={query}
              onChangeText={setQuery}
              style={{ flex: 1, fontFamily: font, fontSize: 13, minHeight: 48, color: theme.text }}
            />
            {query.length > 0 && (
              <IconButton name="close" label="清空搜索" onPress={() => setQuery('')} />
            )}
          </View>
          <View style={{ gap: 8 }}>
            <Label muted style={{ fontSize: 11 }}>
              列表筛选 · 不改变日历和期间回顾
            </Label>
            {source !== 'local' && health.enabled && (
              <Label muted style={{ fontSize: 10, lineHeight: 18 }}>
                Apple 心境可按近似心情、类型与来源查找；笔记和活动关键词仅匹配本地日记。
              </Label>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {(['all', ...Object.keys(MOOD_APPEARANCE)] as const).map((id) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    id === 'all' ? '全部心情' : `筛选${MOOD_APPEARANCE[id as EmotionId].label}`
                  }
                  accessibilityState={{ selected: filter === id }}
                  onPress={() => setFilter(id as EmotionId | 'all')}
                  style={{
                    minHeight: 36,
                    paddingHorizontal: 11,
                    justifyContent: 'center',
                    borderRadius: 11,
                    backgroundColor: filter === id ? theme.accentSoft : theme.surface,
                    borderWidth: 1,
                    borderColor: filter === id ? theme.accent : theme.border,
                  }}
                >
                  <Label
                    style={{
                      fontSize: 11,
                      color: filter === id ? theme.accentText : theme.secondary,
                    }}
                  >
                    {id === 'all' ? '全部' : MOOD_APPEARANCE[id as EmotionId].label}
                  </Label>
                </Pressable>
              ))}
            </View>
          </View>
          <SectionTitle
            title={search ? '搜索结果' : formatDate(parseLocalDate(selected)!)}
            subtitle={`${filtered.length} 条已载入记录 · ${sourceLabel}${search ? ' · 跨日期' : ''}${filter !== 'all' ? ' · 已筛选心情' : ''}`}
            action={!search && source !== 'apple' ? '补记' : undefined}
            onAction={() => openComposer({ date: parseLocalDate(selected)! })}
          />
          {filtered.length ? (
            <TimelineList
              key={`${source}:${selected}:${filter}:${search}`}
              records={filtered}
              onPressLocal={openDetail}
              showDate={!!search}
            />
          ) : (
            <Card style={{ padding: 4 }}>
              <EmptyState
                icon={search ? 'text-search' : 'calendar-blank-outline'}
                title={
                  emptyHealthTitle ??
                  (search || filter !== 'all'
                    ? '还没有找到这样的记录'
                    : source === 'local'
                      ? '这一天，留白也没关系'
                      : '这一天暂无已载入记录')
                }
                description={
                  appleUnavailable
                    ? health.availability.available
                      ? '在“我的”中开启 Apple 健康连接后，心境会自动出现在这里。本地日记仍可正常使用。'
                      : 'Apple 心境需要 iOS 18 及以上的原生 App；当前仍可查看和记录本地日记。'
                    : applePending
                      ? 'Apple 心境尚未完成读取，不能据此判断这一天没有记录。请查看上方的连接状态；本地记录不受影响。'
                      : search || filter !== 'all'
                        ? '试试其他关键词、全部心情或其他来源；列表筛选不会改变日历颜色。'
                        : source === 'apple'
                          ? '本次没有读取到这一天的心境，可能是无记录、超出读取范围或未允许读取。请查看上方的连接状态。'
                          : source !== 'local' && health.availability.available
                            ? '如果愿意，也可以补记一个你还记得的瞬间。Apple 心境是否完整请以上方读取状态为准。'
                            : '如果愿意，也可以补记一个你还记得的瞬间。'
                }
                action={
                  source === 'apple' && emptyHealthTitle
                    ? '查看本地记录'
                    : search || filter !== 'all'
                      ? '清除列表筛选'
                      : source === 'apple'
                        ? '查看本地记录'
                        : '补记这一天'
                }
                onAction={
                  source === 'apple' && emptyHealthTitle
                    ? () => {
                        setSource('local');
                        setQuery('');
                        setFilter('all');
                      }
                    : search || filter !== 'all'
                      ? () => {
                          setQuery('');
                          setFilter('all');
                        }
                      : source === 'apple'
                        ? () => setSource('local')
                        : () => openComposer({ date: parseLocalDate(selected)! })
                }
              />
            </Card>
          )}
        </View>
      </View>
    </Page>
  );
}
