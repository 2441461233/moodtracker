import React from 'react';
import { View } from 'react-native';
import type { StateOfMindSample } from '../../modules/mood-health';
import { formatDate, formatTime } from '../lib/dates';
import { healthDisplayScore } from '../health/timeline';
import { emotionForScore } from '../lib/insights';
import { useTheme } from '../theme';
import { Icon, Label, MoodIcon } from './ui';

export function HealthRecordRow({
  record,
  compact = false,
}: {
  record: StateOfMindSample;
  compact?: boolean;
}) {
  const theme = useTheme();
  const valence = record.valence;
  return (
    <View
      style={{
        padding: compact ? 13 : 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        gap: compact ? 6 : 9,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Icon name="heart-pulse" size={14} color={theme.accentText} />
        <Label style={{ color: theme.accentText, fontSize: 10, fontWeight: '600' }}>
          Apple 健康 · 只读
        </Label>
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <MoodIcon id={emotionForScore(healthDisplayScore(valence))!} size={34} />
        <Label style={{ fontSize: 13, fontWeight: '600', flexShrink: 1 }}>
          {record.kind === 'dailyMood' ? '一天整体心情' : '当下情绪'}
        </Label>
        <Label style={{ fontSize: 12, color: theme.accentText, flexShrink: 1, textAlign: 'right' }}>
          愉悦度 {valence > 0 ? '+' : ''}
          {String(valence)}
        </Label>
      </View>
      <Label muted style={{ fontSize: 11 }}>
        {formatDate(record.timestamp, true)} · {formatTime(record.timestamp)}
      </Label>
      <Label muted style={{ fontSize: 10, lineHeight: 18 }}>
        来源：{record.sourceName || record.sourceBundleId || '来源未提供'}
        {record.isFromThisApp ? ' · 本应用写入' : ''}
      </Label>
      {!compact && (
        <Label muted style={{ fontSize: 10, lineHeight: 17 }}>
          图标为五档近似；愉悦度保留 Apple 原值。请在原记录来源中管理此条心境。
        </Label>
      )}
    </View>
  );
}
