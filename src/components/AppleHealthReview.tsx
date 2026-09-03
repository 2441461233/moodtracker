import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { AUTO_SYNC_DAYS } from '../health/auto-sync';
import { groupTimelineByDay, type TimelineRecord } from '../health/timeline';
import type { useTimeline } from '../health/useTimeline';
import { addDays, formatTime } from '../lib/dates';
import { useLayout, useTheme } from '../theme';
import { Button, Card, EmptyState, Icon, Label } from './ui';
import { HealthTimelineNotice } from './HealthTimelineNotice';
import { TimelineList } from './TimelineList';

type AppleRecord = Extract<TimelineRecord, { type: 'apple' }>;

function dateLabel(value: Date | number) {
  const date = new Date(value);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function meanValence(records: AppleRecord[]): number | null {
  return records.length
    ? records.reduce((sum, record) => sum + record.sample.valence, 0) / records.length
    : null;
}

function valenceLabel(value: number | null) {
  if (value === null) return '—';
  const rounded = Number(value.toFixed(2));
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(2)}`;
}

/** A read-only view over in-memory, deduplicated HealthKit timeline samples. */
export function AppleHealthReview({
  records,
  health,
  start,
  end,
}: {
  records: TimelineRecord[];
  health: ReturnType<typeof useTimeline>['health'];
  start: Date;
  end: Date;
}) {
  const theme = useTheme();
  const { compact } = useLayout();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [expanded, setExpanded] = useState(false);
  const apple = records.filter((record): record is AppleRecord => record.type === 'apple');
  const momentary = apple.filter((record) => record.sample.kind === 'momentaryEmotion');
  const daily = apple.filter((record) => record.sample.kind === 'dailyMood');
  const sourceNames = new Map<string, string>();
  for (const { sample } of apple) {
    sourceNames.set(
      sample.sourceBundleId || sample.sourceName || 'unknown',
      sample.sourceName || sample.sourceBundleId || '来源未提供',
    );
  }
  const sourceLabelCounts = new Map<string, number>();
  for (const name of sourceNames.values())
    sourceLabelCounts.set(name, (sourceLabelCounts.get(name) ?? 0) + 1);
  const sources = [...sourceNames].map(([identifier, name]) =>
    (sourceLabelCounts.get(name) ?? 0) > 1 ? `${name}（${identifier}）` : name,
  );
  const readStart =
    health.lastReadAt === null
      ? null
      : Math.max(0, health.lastReadAt - AUTO_SYNC_DAYS * 86_400_000);
  const beforeReadWindow = readStart !== null && start.getTime() < readStart;

  if (!health.availability.available || !health.enabled) return null;

  return (
    <Card style={{ padding: compact ? 21 : 27, gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 39,
            height: 39,
            borderRadius: 13,
            backgroundColor: theme.dangerSoft,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Icon name="heart-pulse" color={theme.danger} size={21} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Label accessibilityRole="header" style={{ fontSize: 18, fontWeight: '600' }}>
            Apple 健康回顾
          </Label>
          <Label muted style={{ fontSize: 11, lineHeight: 19 }}>
            {dateLabel(start)} — {dateLabel(addDays(end, -1))} · 只读
          </Label>
        </View>
      </View>

      <HealthTimelineNotice />

      {health.hasRead ? (
        <>
          <View style={{ flexDirection: 'row', gap: 22 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Label style={{ fontSize: 34, lineHeight: 42, fontWeight: '600' }}>
                {apple.length}
              </Label>
              <Label muted style={{ fontSize: 12 }}>
                已读取、去重后的样本
              </Label>
            </View>
            <View style={{ width: 1, backgroundColor: theme.border }} />
            <View style={{ flex: 1, gap: 6 }}>
              <Label style={{ fontSize: 34, lineHeight: 42, fontWeight: '600' }}>
                {groupTimelineByDay(apple).size}
              </Label>
              <Label muted style={{ fontSize: 12 }}>
                有 Apple 样本的日期
              </Label>
            </View>
          </View>

          {apple.length > 0 ? (
            <>
              <View style={{ flexDirection: compact ? 'column' : 'row', gap: 12 }}>
                {[
                  { name: '当下情绪', samples: momentary, icon: 'clock-outline' },
                  { name: '一天整体心情', samples: daily, icon: 'calendar-heart' },
                ].map(({ name, samples, icon }) => (
                  <View
                    key={name}
                    style={{
                      flex: compact ? undefined : 1,
                      backgroundColor: theme.subtle,
                      padding: 17,
                      borderRadius: 16,
                      gap: 9,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Icon name={icon} size={16} color={theme.secondary} />
                      <Label style={{ fontSize: 13, fontWeight: '600' }}>{name}</Label>
                    </View>
                    <Label
                      style={{
                        fontSize: 29,
                        lineHeight: 36,
                        fontWeight: '600',
                        color: theme.accentText,
                      }}
                    >
                      {valenceLabel(meanValence(samples))}
                    </Label>
                    <Label muted style={{ fontSize: 11, lineHeight: 19 }}>
                      {samples.length
                        ? `${samples.length} 条已读取样本 · 原始愉悦度均值`
                        : '此类型未读取到样本，不按 0 计算'}
                    </Label>
                  </View>
                ))}
              </View>
              <Label muted style={{ fontSize: 11, lineHeight: 21 }}>
                范围 −1 至
                +1；每条已读取、去重后的同类型样本等权，显示保留两位小数。两种类型分别计算，不合成一个平均值，也不并入下方本地日记趋势或活动关联。
              </Label>
              <Label muted style={{ fontSize: 11, lineHeight: 20 }}>
                来源：{sources.slice(0, 3).join('、')}
                {sources.length > 3 ? ` 等 ${sources.length} 个来源；逐条来源见明细` : ''}
              </Label>
            </>
          ) : (
            <EmptyState
              compact
              icon="heart-outline"
              title="这个周期暂未读取到 Apple 心境"
              description="可能没有匹配样本、未允许读取，或所选日期不在当前读取窗口；不能据此判断 Apple 健康中没有记录。已有本地日记在下方单独回顾。"
            />
          )}
        </>
      ) : (
        <EmptyState
          compact
          icon={health.status === 'syncing' ? 'sync' : 'heart-outline'}
          title={health.status === 'syncing' ? '正在读取 Apple 心境' : 'Apple 心境尚未读取'}
          description="完成读取后，这里会按所选周期回顾样本。在读取完成前，条数与愉悦度都不会当作零值。Apple 不会透露读取权限是否被拒绝。"
        />
      )}

      <View style={{ gap: 7 }}>
        {health.lastReadAt !== null && readStart !== null && (
          <Label muted style={{ fontSize: 10, lineHeight: 19 }}>
            本次查询窗口：{dateLabel(readStart)} — {dateLabel(health.lastReadAt)}{' '}
            {formatTime(health.lastReadAt)}。此分区不是所有健康历史的总计。
          </Label>
        )}
        {beforeReadWindow && (
          <Label style={{ fontSize: 11, lineHeight: 20, color: theme.accentText }}>
            所选周期包含当前查询窗口以外的日期；未读取部分不计为无记录。
          </Label>
        )}
        {health.readTruncated && (
          <Label style={{ fontSize: 11, lineHeight: 20, color: theme.accentText }}>
            本次读取已达到数量上限，以上只汇总当前已读取的样本，可能不是这个周期的全部记录。
          </Label>
        )}
        <Label muted style={{ fontSize: 10, lineHeight: 19 }}>
          与本地日记对应的本应用健康副本只计一次，不在这里重复计数。Apple
          样本仅在内存中展示，不会写回、加入备份或导出。
        </Label>
      </View>

      <View style={{ flexDirection: compact ? 'column' : 'row', gap: 10 }}>
        {health.hasRead && apple.length > 0 && (
          <Button
            kind="secondary"
            icon={expanded ? 'chevron-up' : 'format-list-bulleted'}
            onPress={() => setExpanded(!expanded)}
          >
            {expanded ? '收起 Apple 心境明细' : `查看本周期 ${apple.length} 条心境`}
          </Button>
        )}
        <Button
          kind="ghost"
          icon="calendar-month-outline"
          onPress={() => navigation.navigate('calendar')}
        >
          去日历查看全部记录
        </Button>
      </View>
      {expanded && health.hasRead && apple.length > 0 && (
        <TimelineList records={apple} onPressLocal={() => undefined} showDate />
      )}
    </Card>
  );
}
