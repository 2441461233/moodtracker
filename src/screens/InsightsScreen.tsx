import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
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
import { TrendChart } from '../components/TrendChart';
import { AppleHealthReview } from '../components/AppleHealthReview';
import { useTimeline } from '../health/useTimeline';
import { timelineInRange } from '../health/timeline';
import { addDays, formatDate, startOfDay, startOfWeek } from '../lib/dates';
import { activityInsights, dailyAverage, entriesInRange, groupByDay } from '../lib/insights';
import { MOOD_APPEARANCE, useLayout, useTheme } from '../theme';
import { EmotionId } from '../types';

type Period = 'week' | 'month' | 'quarter';
function getRange(period: Period, offset: number, now: Date): [Date, Date] {
  if (period === 'week') {
    const start = addDays(startOfWeek(now), offset * 7);
    return [start, addDays(start, 7)];
  }
  if (period === 'month')
    return [
      new Date(now.getFullYear(), now.getMonth() + offset, 1),
      new Date(now.getFullYear(), now.getMonth() + offset + 1, 1),
    ];
  const end = addDays(startOfDay(now), 1 + offset * 90);
  return [addDays(end, -90), end];
}

export default function InsightsScreen() {
  const { entries, now, openComposer } = useMood();
  const { records, health } = useTimeline();
  const theme = useTheme();
  const { desktop, compact } = useLayout();
  const [period, setPeriod] = useState<Period>('week');
  const [offset, setOffset] = useState(0);
  const [methodology, setMethodology] = useState(false);
  const [allFactors, setAllFactors] = useState(false);
  const [start, end] = getRange(period, offset, now);
  const [previousStart, previousEnd] = getRange(period, offset - 1, now);
  const periodEntries = useMemo(
    () => entriesInRange(entries, start, end),
    [entries, start.getTime(), end.getTime()],
  );
  const previous = entriesInRange(entries, previousStart, previousEnd);
  const days = groupByDay(periodEntries).size;
  const average = dailyAverage(periodEntries);
  const previousAverage = dailyAverage(previous);
  const difference =
    days >= 3 && groupByDay(previous).size >= 3 && average !== null && previousAverage !== null
      ? average - previousAverage
      : null;
  const factors = activityInsights(periodEntries);
  const counts = periodEntries.reduce(
    (result, entry) => {
      result[entry.emotionId] = (result[entry.emotionId] ?? 0) + 1;
      return result;
    },
    {} as Record<string, number>,
  );
  const rangeTitle =
    offset === 0
      ? { week: '这一周', month: '这个月', quarter: '近 90 天' }[period]
      : `${start.getMonth() + 1}月${start.getDate()}日 — ${addDays(end, -1).getMonth() + 1}月${addDays(end, -1).getDate()}日`;
  return (
    <Page
      eyebrow="GET TO KNOW YOURSELF"
      title="看见心情背后的小规律"
      subtitle="不评价好坏，只帮你更懂自己一点。"
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <Segment<Period>
          value={period}
          options={[
            { id: 'week', label: '周' },
            { id: 'month', label: '月' },
            { id: 'quarter', label: '90 天' },
          ]}
          onChange={(next) => {
            setPeriod(next);
            setOffset(0);
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <IconButton
            name="chevron-left"
            label="上一个统计周期"
            disabled={start.getFullYear() <= 1970}
            onPress={() => setOffset(offset - 1)}
          />
          <Label style={{ fontSize: 13 }}>{rangeTitle}</Label>
          <IconButton
            name="chevron-right"
            label="下一个统计周期"
            disabled={offset === 0}
            onPress={() => setOffset(offset + 1)}
          />
        </View>
      </View>
      <AppleHealthReview
        key={`${start.getTime()}-${end.getTime()}`}
        records={timelineInRange(records, start, end)}
        health={health}
        start={start}
        end={end}
      />
      {health.enabled && (
        <SectionTitle
          title="本地日记回顾"
          subtitle="以下趋势、心情分布与活动关联仅根据本地日记，不混入 Apple 心境样本。"
        />
      )}
      <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 24 }}>
        <Card style={{ flex: desktop ? 1.8 : undefined, padding: compact ? 21 : 27 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 18,
              gap: 15,
            }}
          >
            <View style={{ gap: 10 }}>
              <Label muted style={{ fontSize: 13 }}>
                {health.enabled ? '本地日均心情' : '平均心情'}
              </Label>
              <Label
                style={{ fontSize: 46, lineHeight: 55, letterSpacing: -1.8, fontWeight: '600' }}
              >
                {average === null ? '—' : average.toFixed(1)}
                <Label muted style={{ fontSize: 14 }}>
                  {' '}
                  / 5
                </Label>
              </Label>
            </View>
            <View
              style={{
                backgroundColor: theme.accentSoft,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 7,
              }}
            >
              <Label style={{ fontSize: 11, color: theme.accentText }}>
                {days} 个{health.enabled ? '本地' : ''}记录日
              </Label>
            </View>
          </View>
          {periodEntries.length ? (
            <TrendChart entries={periodEntries} start={start} end={end} />
          ) : (
            <EmptyState
              compact
              icon="chart-timeline-variant"
              title={health.enabled ? '这个周期还没有本地日记' : '你的情绪曲线，还在起点'}
              description={
                health.enabled
                  ? 'Apple 心境已在上方单独回顾；这条曲线只展示本地日记。没有本地记录的日期会留白。'
                  : '留下第一条记录，就能在这里看见它。没有记录的日子，我们会留白。'
              }
              action="记录当下心情"
              onAction={() => openComposer()}
            />
          )}
          {difference !== null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 19 }}>
              <Icon
                name={difference >= 0 ? 'trending-up' : 'trending-down'}
                size={17}
                color={theme.accentText}
              />
              <Label muted style={{ fontSize: 12 }}>
                较上一周期{difference > 0 ? '高' : difference < 0 ? '低' : '持平'}
                {difference !== 0 ? ` ${Math.abs(difference).toFixed(1)} 分` : ''} ·
                只是变化，不是评价
              </Label>
            </View>
          )}
        </Card>
        <Card style={{ flex: desktop ? 1 : undefined, gap: 21 }}>
          <SectionTitle title="认识自己，是个慢过程" subtitle="你的记录会让这里慢慢丰富起来" />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Label
              style={{ fontSize: 40, lineHeight: 49, fontWeight: '600', color: theme.accentText }}
            >
              {days}
            </Label>
            <Label muted style={{ fontSize: 12 }}>
              天的真实感受
            </Label>
          </View>
          {[
            { days: 3, title: '看见情绪', hint: '从几个真实的瞬间开始' },
            { days: 7, title: '初见规律', hint: '给一周的自己一点回顾' },
            { days: 14, title: '发现关联', hint: '慢慢留意活动与感受' },
            { days: 30, title: '了解更多', hint: '积累更丰富的生活切片' },
          ].map((item) => (
            <View
              key={item.days}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'center', opacity: 1 }}
            >
              <View
                style={{
                  width: 31,
                  height: 31,
                  backgroundColor: days >= item.days ? theme.accentSoft : theme.subtle,
                  borderRadius: 11,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Icon
                  name={days >= item.days ? 'check' : 'circle-small'}
                  color={days >= item.days ? theme.accentText : theme.muted}
                  size={19}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Label style={{ fontSize: 12, fontWeight: '600' }}>{item.title}</Label>
                <Label muted style={{ fontSize: 10 }}>
                  {item.hint}
                </Label>
              </View>
              <Label muted style={{ fontSize: 10 }}>
                {item.days} 天
              </Label>
            </View>
          ))}
          <Label muted style={{ fontSize: 10, lineHeight: 18 }}>
            按当前周期的记录天数计算。这不是任务清单，按自己的节奏就好。
          </Label>
        </Card>
      </View>
      <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 24 }}>
        <Card style={{ flex: 1 }}>
          <SectionTitle
            title="心情的不同颜色"
            subtitle={`${periodEntries.length} 条${health.enabled ? '本地日记' : '记录'} · 每一种感受都被认真对待`}
          />
          <View style={{ gap: 20 }}>
            {(Object.keys(MOOD_APPEARANCE) as EmotionId[]).map((id) => {
              const count = counts[id] ?? 0;
              const share = periodEntries.length ? count / periodEntries.length : 0;
              return (
                <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <MoodIcon id={id} size={34} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Label style={{ fontSize: 12 }}>{MOOD_APPEARANCE[id].label}</Label>
                      <Label muted style={{ fontSize: 11 }}>
                        {count} 次{count ? ` · ${Math.round(share * 100)}%` : ''}
                      </Label>
                    </View>
                    <View
                      style={{
                        height: 6,
                        borderRadius: 4,
                        backgroundColor: theme.subtle,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${share * 100}%`,
                          borderRadius: 4,
                          backgroundColor: MOOD_APPEARANCE[id].color,
                        }}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
        <Card style={{ flex: 1 }}>
          <SectionTitle
            title="什么，和你的心情有关？"
            subtitle={
              health.enabled
                ? '活动关联 · 仅根据本地日记与本地活动'
                : '活动关联 · 只根据你的真实记录'
            }
          />
          {factors.length ? (
            <View style={{ gap: 18 }}>
              {factors.slice(0, allFactors ? factors.length : 6).map((activity) => (
                <View
                  key={activity.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <View
                    style={{
                      backgroundColor: theme.subtle,
                      height: 38,
                      width: 38,
                      borderRadius: 12,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Icon name={activity.icon} color={activity.color} size={21} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Label style={{ fontSize: 13, fontWeight: '500' }}>{activity.label}</Label>
                    <Label muted style={{ fontSize: 10 }}>
                      有此活动 {activity.days} 天 · 无此活动 {activity.comparisonDays} 天
                    </Label>
                  </View>
                  <View
                    style={{
                      backgroundColor:
                        activity.difference === null ? theme.subtle : theme.accentSoft,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                    }}
                  >
                    <Label
                      style={{
                        fontSize: 11,
                        color: activity.difference === null ? theme.secondary : theme.accentText,
                      }}
                    >
                      {activity.difference === null
                        ? '积累中'
                        : `${activity.difference >= 0 ? '+' : ''}${activity.difference.toFixed(1)} 分`}
                    </Label>
                  </View>
                </View>
              ))}
              {factors.length > 6 && (
                <Button kind="ghost" onPress={() => setAllFactors(!allFactors)}>
                  {allFactors ? '收起活动' : `查看全部 ${factors.length} 个活动`}
                </Button>
              )}
              <Label muted style={{ fontSize: 11, lineHeight: 21, marginTop: 4 }}>
                按差值的绝对值排序，正负关联都值得留意。关联不代表因果。两组各有至少 3
                个记录日，才展示日均心情的差值。
              </Label>
            </View>
          ) : (
            <EmptyState
              compact
              icon="puzzle-heart-outline"
              title="让生活里的小事，有迹可循"
              description="记录时顺手选几个活动。积累一些日子后，再一起看看它们和心情的关联。"
            />
          )}
        </Card>
      </View>
      <View>
        <Button
          kind="ghost"
          onPress={() => setMethodology(!methodology)}
          icon="information-outline"
          style={{ alignSelf: 'center' }}
        >
          {methodology ? '收起说明' : '这些数字，是怎么得来的？'}
        </Button>
        {methodology && (
          <Card style={{ marginTop: 15, gap: 12 }}>
            <Label style={{ fontWeight: '600', fontSize: 14 }}>透明一点，安心一点</Label>
            {health.enabled && (
              <Label muted style={{ fontSize: 12, lineHeight: 23 }}>
                Apple
                健康回顾单独汇总已读取、去重后的样本：“当下情绪”与“一天整体心情”各自按样本计算原始愉悦度均值。下面的五档分数、日均权重和活动差值只适用于本地日记。
              </Label>
            )}
            <Label muted style={{ fontSize: 12, lineHeight: 23 }}>
              五档心情仅用于整理记录：很开心 5、还不错 4、还好 3、有点烦 2、很难过
              1。先计算每天的平均分，再对有记录的日子取平均；多记几次不会让那一天占更大权重。
            </Label>
            <Label muted style={{ fontSize: 12, lineHeight: 23 }}>
              活动差值 = 有该活动的记录日日均值 −
              无该活动的记录日日均值。它可能受到其他因素影响，不能证明这个活动导致了心情变化。记录不足时不推断，不使用
              AI，不发送情绪数据。
            </Label>
            <Label muted style={{ fontSize: 12, lineHeight: 23 }}>
              分数不是对生活的评分。本应用用于自我记录与觉察，不提供诊断、治疗或医疗建议。
            </Label>
          </Card>
        )}
      </View>
    </Page>
  );
}
