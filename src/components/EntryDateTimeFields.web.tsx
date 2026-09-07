import React from 'react';
import { View } from 'react-native';
import { dayKey, formatTime } from '../lib/dates';
import { font, useTheme } from '../theme';
import type { EntryDateTimeFieldsProps } from './EntryDateTimeFields';

export function EntryDateTimeFields({ date, time, onChange, disabled }: EntryDateTimeFieldsProps) {
  const theme = useTheme();
  const now = new Date();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {(['date', 'time'] as const).map((field) => (
        <input
          key={field}
          type={field}
          aria-label={field === 'date' ? '选择记录日期' : '选择记录时间'}
          value={field === 'date' ? date : time}
          disabled={disabled}
          min={field === 'date' ? '1970-01-01' : undefined}
          max={field === 'date' ? dayKey(now) : date === dayKey(now) ? formatTime(now) : undefined}
          step={field === 'time' ? 60 : undefined}
          onChange={(event) => onChange({ date, time, [field]: event.target.value })}
          // Some date/time controls emit input before committing a change on blur.
          onInput={(event) => onChange({ date, time, [field]: event.currentTarget.value })}
          style={{
            boxSizing: 'border-box',
            flex: field === 'date' ? 1.6 : 1,
            minWidth: 0,
            width: 0,
            minHeight: 52,
            padding: 10,
            borderRadius: 14,
            border: `1px solid ${theme.border}`,
            background: theme.subtle,
            color: theme.text,
            colorScheme: theme.dark ? 'dark' : 'light',
            fontFamily: font,
            fontSize: 16,
          }}
        />
      ))}
    </View>
  );
}
