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
  MoodIcon,
  SectionTitle,
  Segment,
} from '../components/ui';
import { EntryList } from '../components/EntryList';
import { addDays, dayKey, formatDate, monthDays, parseLocalDate, WEEKDAYS } from '../lib/dates';
import {
  averageMood,
  dailyAverage,
  emotionForScore,
  entriesInRange,
  groupByDay,
} from '../lib/insights';
import { getActivity, getActivityIds } from '../data/activities';
import { font, MOOD_APPEARANCE, useLayout, useTheme } from '../theme';
import { EmotionId } from '../types';

export default function CalendarScreen() {
  const { entries, now, openComposer, openDetail } = useMood();
  const theme = useTheme();
  const { desktop, compact } = useLayout();
  const route = useRoute();
  const requestedDate = (route.params as { date?: string } | undefined)?.date;
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(dayKey(now));
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<EmotionId | 'all'>('all');
  const grouped = useMemo(() => groupByDay(entries), [entries]);
  useEffect(() => {
    if (!requestedDate) return;
    const date = parseLocalDate(requestedDate);
    if (date) {
      setSelected(requestedDate);
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      setMode('month');
    }
  }, [requestedDate]);
  const monthEntries = entriesInRange(
    entries,
    mode === 'year' ? new Date(month.getFullYear(), 0, 1) : month,
    mode === 'year'
      ? new Date(month.getFullYear() + 1, 0, 1)
      : new Date(month.getFullYear(), month.getMonth() + 1, 1),
  );
  const average = dailyAverage(monthEntries);
  const monthGroups = groupByDay(monthEntries);
  const search = query.trim().toLocaleLowerCase();
  const filtered = entries.filter(
    (entry) =>
      (search
        ? `${entry.note ?? ''} ${MOOD_APPEARANCE[entry.emotionId].label} ${getActivityIds(entry)
            .map((id) => getActivity(id)?.label)
            .join(' ')}`
            .toLocaleLowerCase()
            .includes(search)
        : dayKey(entry.timestamp) === selected) &&
      (filter === 'all' || entry.emotionId === filter),
  );
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
                    const records = grouped.get(key) ?? [];
                    const score = averageMood(records);
                    const emotion = emotionForScore(score);
                    const mood = emotion ? MOOD_APPEARANCE[emotion] : null;
                    return (
                      <View key={key} style={{ width: '14.2857%', paddingHorizontal: 2 }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${formatDate(date)}，${records.length ? `${records.length} 条记录，平均心情 ${score!.toFixed(1)} 分` : '没有记录'}`}
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
                  return (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      accessibilityLabel={`查看 ${date.getFullYear()}年${index + 1}月`}
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
                          const id = day
                            ? emotionForScore(averageMood(grouped.get(dayKey(day)) ?? []))
                            : null;
                          return (
                            <View
                              key={i}
                              style={{ width: '14.2857%', aspectRatio: 1, padding: 1.5 }}
                            >
                              <View
                                style={{
                                  flex: 1,
                                  borderRadius: 2,
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
              <Label muted style={{ fontSize: 10, textAlign: 'center' }}>
                颜色代表当天平均心情 · 空白也是生活的一部分
              </Label>
            </View>
          </Card>
          <Card style={{ flexDirection: 'row', padding: 21 }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 7 }}>
              <Label style={{ fontSize: 26, lineHeight: 33, fontWeight: '600' }}>
                {monthGroups.size}
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
                {monthEntries.length}
                <Label muted style={{ fontSize: 11 }}>
                  {' '}
                  次
                </Label>
              </Label>
              <Label muted style={{ fontSize: 11 }}>
                被记住的瞬间
              </Label>
            </View>
            <View style={{ width: 1, backgroundColor: theme.border }} />
            <View style={{ flex: 1, alignItems: 'center', gap: 7 }}>
              <Label style={{ fontSize: 26, lineHeight: 33, fontWeight: '600' }}>
                {average === null ? '—' : average.toFixed(1)}
              </Label>
              <Label muted style={{ fontSize: 11 }}>
                {mode === 'year' ? '年平均心情' : '月平均心情'}
              </Label>
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
              accessibilityLabel="搜索全部笔记和活动"
              placeholder="搜索笔记、活动或心情"
              placeholderTextColor={theme.muted}
              value={query}
              onChangeText={setQuery}
              style={{ flex: 1, fontFamily: font, fontSize: 13, minHeight: 48, color: theme.text }}
            />
            {query.length > 0 && (
              <IconButton name="close" label="清空搜索" onPress={() => setQuery('')} />
            )}
          </View>
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
          <SectionTitle
            title={search ? '搜索结果' : formatDate(parseLocalDate(selected)!)}
            subtitle={`${filtered.length} 条记录${filter !== 'all' ? ' · 已筛选心情' : ''}`}
            action={!search ? '补记' : undefined}
            onAction={() => openComposer({ date: parseLocalDate(selected)! })}
          />
          {filtered.length ? (
            <EntryList entries={filtered} onPress={openDetail} showDate={!!search} />
          ) : (
            <Card style={{ padding: 4 }}>
              <EmptyState
                icon={search ? 'text-search' : 'calendar-blank-outline'}
                title={search || filter !== 'all' ? '还没有找到这样的记录' : '这一天，留白也没关系'}
                description={
                  search || filter !== 'all'
                    ? '试试其他关键词，或切换为全部心情。'
                    : '如果愿意，也可以补记一个你还记得的瞬间。'
                }
                action={search || filter !== 'all' ? '清除筛选' : '补记这一天'}
                onAction={
                  search || filter !== 'all'
                    ? () => {
                        setQuery('');
                        setFilter('all');
                      }
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
