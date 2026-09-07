import React, { useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { applyPickedTime, EntryTimeFields, EntryTimeMode, pickerValue } from '../lib/entry-time';
import { dayKey } from '../lib/dates';
import { useTheme } from '../theme';
import { Button, Icon, Label } from './ui';

export interface EntryDateTimeFieldsProps extends EntryTimeFields {
  onChange: (fields: EntryTimeFields) => void;
  disabled?: boolean;
  onExpand?: () => void;
}

export function EntryDateTimeFields({
  date,
  time,
  onChange,
  disabled,
  onExpand,
}: EntryDateTimeFieldsProps) {
  const theme = useTheme();
  const [mode, setMode] = useState<EntryTimeMode | null>(null);
  const fields = { date, time };
  const value = pickerValue(fields);
  const maximumDate = new Date();
  const minimumDate = new Date(1970, 0, 1);
  const open = (next: EntryTimeMode) => {
    Keyboard.dismiss();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: next,
        is24Hour: true,
        minimumDate,
        maximumDate,
        positiveButton: { label: '确定' },
        negativeButton: { label: '取消' },
        onChange: (event, picked) => {
          if (event.type === 'set' && picked) onChange(applyPickedTime(fields, next, picked));
        },
      });
    } else {
      setMode((current) => (current === next ? null : next));
    }
  };
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['date', 'time'] as const).map((field) => (
          <Pressable
            key={field}
            accessibilityRole="button"
            accessibilityLabel={field === 'date' ? '选择记录日期' : '选择记录时间'}
            accessibilityValue={{ text: field === 'date' ? date : time }}
            accessibilityState={{ disabled, expanded: mode === field }}
            disabled={disabled}
            onPress={() => open(field)}
            style={({ pressed }) => ({
              flex: field === 'date' ? 1.6 : 1,
              minWidth: 0,
              minHeight: 52,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: mode === field ? theme.accent : theme.border,
              backgroundColor: theme.subtle,
              opacity: pressed || disabled ? 0.6 : 1,
            })}
          >
            <Icon name={field === 'date' ? 'calendar-outline' : 'clock-outline'} size={18} />
            <Label style={{ fontSize: 14, flexShrink: 1 }}>{field === 'date' ? date : time}</Label>
          </Pressable>
        ))}
      </View>
      {Platform.OS === 'ios' && mode && (
        <View
          key={mode}
          onLayout={onExpand}
          style={{ backgroundColor: theme.subtle, borderRadius: 16, overflow: 'hidden' }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 14,
              paddingRight: 4,
            }}
          >
            <Label style={{ fontWeight: '600', flexShrink: 1 }}>
              {mode === 'date' ? '选择日期' : '选择时间'}
            </Label>
            <Button kind="ghost" disabled={disabled} onPress={() => setMode(null)}>
              完成
            </Button>
          </View>
          <DateTimePicker
            value={value}
            mode={mode}
            display="spinner"
            locale="zh-CN"
            minimumDate={mode === 'date' ? minimumDate : undefined}
            maximumDate={mode === 'date' || date === dayKey(maximumDate) ? maximumDate : undefined}
            themeVariant={theme.dark ? 'dark' : 'light'}
            textColor={theme.text}
            disabled={disabled}
            onChange={(event, picked) => {
              if (!disabled && event.type === 'set' && picked) {
                onChange(applyPickedTime(fields, mode, picked));
              }
            }}
            style={{ width: '100%', height: 216 }}
          />
        </View>
      )}
    </View>
  );
}
