import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, TextInput, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useMoodClock, useMoodActions } from '../context/MoodContext';
import { Page } from '../components/Page';
import {
  Button,
  Card,
  EmptyState,
  Disclosure,
  Icon,
  IconButton,
  Label,
  SectionTitle,
  Segment,
} from '../components/ui';
import { TimelineList } from '../components/TimelineList';
import { HealthTimelineNotice } from '../components/HealthTimelineNotice';
import {
  dayKey,
  formatDate,
  monthDays,
  parseLocalDate,
  selectionInMonth,
  WEEKDAYS,
} from '../lib/dates';
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
  const now = useMoodClock();
  const { openComposer, openDetail } = useMoodActions();
  const { records, health } = useTimeline();
  const theme = useTheme();
  const { desktop, compact } = useLayout();
  const route = useRoute();
  const widgetParams = route.params as
    | { date?: string; source?: 'local'; widgetRequest?: number }
    | undefined;
  const requestedDate = widgetParams?.date;
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(dayKey(now));
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      setView('calendar');
      if (widgetParams?.source === 'local') {
        setSource('local');
        setQuery('');
        setFilter('all');
      }
    }
  }, [requestedDate, widgetParams?.widgetRequest]);
  const monthEntries = useMemo(
    () =>
      timelineInRange(
        sourceRecords,
        mode === 'year' ? new Date(month.getFullYear(), 0, 1) : month,
        mode === 'year'
          ? new Date(month.getFullYear() + 1, 0, 1)
          : new Date(month.getFullYear(), month.getMonth() + 1, 1),
      ),
    [sourceRecords, mode, month],
  );
  const average = useMemo(() => timelineDailyAverage(monthEntries), [monthEntries]);
  const monthGroups = useMemo(() => groupTimelineByDay(monthEntries), [monthEntries]);
  const search = useDeferredValue(query.trim());
  const filtered = useMemo(
    () =>
      filterTimeline(sourceRecords, {
        emotionId: filter,
        query: search || undefined,
        day: view === 'calendar' && !search ? selected : undefined,
      }),
    [sourceRecords, filter, search, view, selected],
  );
  const showingDay = view === 'calendar' && !search;
  const activeFilterCount = Number(source !== 'all') + Number(filter !== 'all') + Number(!!search);
  const clearFilters = () => {
    setQuery('');
    setFilter('all');
    setSource('all');
    Keyboard.dismiss();
  };
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
  const shift = (direction: number) => {
    const target = new Date(
      month.getFullYear() + (mode === 'year' ? direction : 0),
      month.getMonth() + (mode === 'month' ? direction : 0),
      1,
    );
    const next = selectionInMonth(target, parseLocalDate(selected)!, now);
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setSelected(dayKey(next));
    setQuery('');
    Keyboard.dismiss();
  };
  const canNext =
    mode === 'month'
      ? dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)) <= dayKey(now)
      : month.getFullYear() < now.getFullYear();
  const canPrevious =
    mode === 'month'
      ? month.getFullYear() > 1970 || month.getMonth() > 0
      : month.getFullYear() > 1970;
  const choose = (date: Date) => {
    Keyboard.dismiss();
    setSelected(dayKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setMode('month');
    setQuery('');
  };
  return (
    <Page
      title="情绪记录"
      subtitle="那些值得记住的瞬间，都在这里。"
      scrollKey={`${view}:${filtersOpen}`}
    >
      <View
        style={{ width: '100%', maxWidth: desktop ? 780 : undefined, alignSelf: 'center', gap: 20 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Segment
            options={[
              { id: 'timeline', label: '时间线' },
              { id: 'calendar', label: '日历' },
            ]}
            value={view}
            onChange={(next) => {
              setView(next);
              Keyboard.dismiss();
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              filtersOpen
                ? '收起筛选'
                : `展开筛选${activeFilterCount ? `，已应用 ${activeFilterCount} 项` : ''}`
            }
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => {
              setFiltersOpen((value) => !value);
              Keyboard.dismiss();
            }}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon
              name="filter-variant"
              size={20}
              color={activeFilterCount ? theme.accentText : theme.secondary}
            />
            <Label
              style={{
                fontSize: 13,
                color: activeFilterCount ? theme.accentText : theme.secondary,
              }}
            >
              筛选{activeFilterCount ? ` ${activeFilterCount}` : ''}
            </Label>
          </Pressable>
        </View>
        {filtersOpen && (
          <Card style={{ padding: compact ? 16 : 22, gap: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: theme.subtle,
                borderRadius: 12,
                paddingHorizontal: 12,
              }}
            >
              <Icon name="magnify" size={20} />
              <TextInput
                accessibilityLabel="跨日期搜索当前来源的笔记、活动、心情或 Apple 来源"
                placeholder="搜索笔记、活动、心情或来源"
                placeholderTextColor={theme.muted}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
                keyboardAppearance={theme.dark ? 'dark' : 'light'}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: font,
                  fontSize: 16,
                  minHeight: 48,
                  color: theme.text,
                }}
              />
              {query.length > 0 && (
                <IconButton name="close" label="清空搜索" onPress={() => setQuery('')} />
              )}
            </View>
            <View style={{ gap: 8 }}>
              <Label muted style={{ fontSize: 12 }}>
                来源
              </Label>
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
            <View style={{ gap: 8 }}>
              <Label muted style={{ fontSize: 12 }}>
                心情
              </Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {(['all', ...Object.keys(MOOD_APPEARANCE)] as (EmotionId | 'all')[]).map((id) => (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityLabel={
                      id === 'all' ? '全部心情' : `筛选${MOOD_APPEARANCE[id].label}`
                    }
                    accessibilityState={{ selected: filter === id }}
                    onPress={() => setFilter(id)}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      paddingHorizontal: 11,
                      justifyContent: 'center',
                      borderRadius: 11,
                      backgroundColor: filter === id ? theme.accentSoft : theme.subtle,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Label
                      style={{
                        fontSize: 12,
                        color: filter === id ? theme.accentText : theme.secondary,
                      }}
                    >
                      {id === 'all' ? '全部' : MOOD_APPEARANCE[id].label}
                    </Label>
                  </Pressable>
                ))}
              </View>
            </View>
            <Label muted style={{ fontSize: 11, lineHeight: 18 }}>
              搜索会查找所有日期。心情筛选只影响记录列表，来源同时应用于日历。
            </Label>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Button kind="ghost" onPress={clearFilters} disabled={!activeFilterCount}>
                重置筛选
              </Button>
              <Button
                kind="secondary"
                onPress={() => {
                  setFiltersOpen(false);
                  Keyboard.dismiss();
                }}
              >
                查看记录
              </Button>
            </View>
          </Card>
        )}
        {!filtersOpen && activeFilterCount > 0 && (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: 10,
              rowGap: 2,
            }}
          >
            <Label
              muted
              numberOfLines={2}
              style={{ flex: 1, minWidth: 120, fontSize: 12, lineHeight: 19 }}
            >
              {[
                source !== 'all' ? sourceLabel : '',
                filter !== 'all' ? MOOD_APPEARANCE[filter].label : '',
                search ? `“${search}”` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </Label>
            <Button kind="ghost" onPress={clearFilters} style={{ paddingHorizontal: 4 }}>
              清除筛选
            </Button>
          </View>
        )}
        {view === 'calendar' && (
          <Card style={{ padding: compact ? 12 : 22 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Label style={{ fontSize: 18, fontWeight: '600', flex: 1 }}>
                {month.getFullYear()}年{mode === 'month' ? ` ${month.getMonth() + 1}月` : ''}
              </Label>
              <View style={{ flexDirection: 'row', gap: 6 }}>
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
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: 12,
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
              <Button kind="ghost" onPress={() => choose(now)} style={{ paddingHorizontal: 6 }}>
                今天
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
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 }}>
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
                      <View key={key} style={{ width: '14.2857%' }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${formatDate(date)}，${sourceLabel}，${dayRecords.length ? `${dayRecords.length} 条记录，近似心情 ${score!.toFixed(1)} 分${appleCount ? `，其中 ${appleCount} 条来自 Apple 健康` : ''}` : applePending || appleUnavailable ? '尚无已载入的记录，Apple 心境仍待读取' : '当前来源未载入记录'}`}
                          accessibilityState={{ selected: active, disabled: future }}
                          disabled={future}
                          onPress={() => {
                            Keyboard.dismiss();
                            setSelected(key);
                            setQuery('');
                          }}
                          style={({ pressed }) => ({
                            minHeight: compact ? 44 : 54,
                            paddingVertical: 5,
                            borderRadius: 15,
                            borderWidth: active ? 2 : 1,
                            borderColor: active ? theme.accent : 'transparent',
                            backgroundColor: active
                              ? theme.accentSoft
                              : mood
                                ? theme.dark
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
                borderTopWidth: 1,
                borderTopColor: theme.border,
                marginTop: 14,
                paddingTop: 12,
                gap: 2,
              }}
            >
              <Label muted style={{ fontSize: 12, lineHeight: 20 }}>
                {mode === 'year' ? '这一年' : '这个月'} ·{' '}
                {source === 'apple' && !health.hasRead ? '—' : monthGroups.size} 个记录日 ·{' '}
                {source === 'apple' && !health.hasRead ? '—' : monthEntries.length} 条记录
              </Label>
              <Disclosure title="颜色与统计说明">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {(Object.keys(MOOD_APPEARANCE) as EmotionId[]).map((id) => (
                    <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: MOOD_APPEARANCE[id].color,
                        }}
                      />
                      <Label muted style={{ fontSize: 11 }}>
                        {MOOD_APPEARANCE[id].label}
                      </Label>
                    </View>
                  ))}
                </View>
                <Label muted style={{ fontSize: 11, lineHeight: 19 }}>
                  {sourceLabel} · {mode === 'year' ? '年' : '月'}平均心情{' '}
                  {average === null ? '—' : average.toFixed(1)}
                  。仅统计已载入的记录，有记录的日子等权平均。
                </Label>
                <Label muted style={{ fontSize: 11, lineHeight: 19 }}>
                  当天有“一天整体心情”时优先取其均值，否则取“当下情绪”均值。Apple 愉悦度映射到 1–5
                  分，仅作近似回顾；爱心或像素描边表示含 Apple 心境。
                </Label>
              </Disclosure>
            </View>
          </Card>
        )}
        <View style={{ gap: 14 }}>
          <SectionTitle
            style={{ marginBottom: 0 }}
            title={
              search
                ? '搜索结果'
                : showingDay
                  ? formatDate(parseLocalDate(selected)!, true)
                  : '全部记录'
            }
            subtitle={`${filtered.length} 条${source === 'apple' ? '已读取' : ''}记录${showingDay ? '' : ' · 从新到旧'}`}
            action={showingDay && source !== 'apple' ? '补记' : undefined}
            onAction={() => openComposer({ date: parseLocalDate(selected)! })}
          />
          {source !== 'local' && (health.enabled || source === 'apple') && (
            <HealthTimelineNotice compact />
          )}
          {filtered.length ? (
            <TimelineList
              key={`${source}:${showingDay ? selected : 'all'}:${filter}:${search}`}
              records={filtered}
              onPressLocal={openDetail}
              groupByDate={!showingDay}
            />
          ) : (
            <Card style={{ padding: 4 }}>
              <EmptyState
                icon={
                  search || activeFilterCount
                    ? 'text-search'
                    : showingDay
                      ? 'calendar-blank-outline'
                      : 'notebook-outline'
                }
                title={
                  emptyHealthTitle ??
                  (search || filter !== 'all'
                    ? '还没有找到这样的记录'
                    : showingDay
                      ? '这一天，留白也没关系'
                      : '从一个瞬间开始')
                }
                description={
                  appleUnavailable
                    ? health.availability.available
                      ? '在“我的”中连接 Apple 健康后，可读取的心境会出现在这里。'
                      : 'Apple 心境需要 iOS 18 及以上的原生 App；当前仍可查看本地日记。'
                    : applePending
                      ? 'Apple 心境还未完成读取，本地记录不受影响。'
                      : search || filter !== 'all'
                        ? '试试其他关键词，或清除筛选看看。'
                        : source === 'apple'
                          ? '当前读取范围内没有显示心境，可能是无记录、超出范围或未允许读取。'
                          : showingDay
                            ? '可以补记这一天，也可以回到时间线看看其他日子。'
                            : '留下第一条心情记录，以后就能在这里按时间回看。'
                }
                action={
                  source === 'apple'
                    ? '查看本地记录'
                    : search || filter !== 'all'
                      ? '清除筛选'
                      : showingDay
                        ? '补记这一天'
                        : '记录此刻'
                }
                onAction={
                  source === 'apple'
                    ? () => {
                        setSource('local');
                        setQuery('');
                        setFilter('all');
                      }
                    : search || filter !== 'all'
                      ? clearFilters
                      : () =>
                          openComposer(showingDay ? { date: parseLocalDate(selected)! } : undefined)
                }
              />
            </Card>
          )}
          {showingDay && (
            <Button kind="ghost" onPress={() => setView('timeline')} icon="format-list-bulleted">
              查看全部历史记录
            </Button>
          )}
        </View>
      </View>
    </Page>
  );
}
