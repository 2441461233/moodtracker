import React from 'react';
import { Pressable, View } from 'react-native';
import { MoodEntry } from '../types';
import { getActivity, getActivityIds } from '../data/activities';
import { MOOD_APPEARANCE, useTheme } from '../theme';
import { formatDate, formatTime } from '../lib/dates';
import { Icon, Label, MoodIcon } from './ui';

export function EntryList({
  entries,
  onPress,
  showDate = false,
}: {
  entries: MoodEntry[];
  onPress: (entry: MoodEntry) => void;
  showDate?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {[...entries]
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((entry) => {
          const mood = MOOD_APPEARANCE[entry.emotionId];
          const activities = getActivityIds(entry).map(getActivity).filter(Boolean);
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`${showDate ? formatDate(entry.timestamp) : ''} ${formatTime(entry.timestamp)}，${mood.label}，${entry.note || '查看记录'}`}
              onPress={() => onPress(entry)}
              style={({ pressed, hovered }) => ({
                flexDirection: 'row',
                alignItems: 'flex-start',
                padding: 16,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: hovered ? theme.subtle : theme.surface,
                opacity: pressed ? 0.72 : 1,
                gap: 14,
              })}
            >
              <MoodIcon id={entry.emotionId} size={46} />
              <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Label style={{ fontSize: 15, fontWeight: '600' }}>{mood.label}</Label>
                  <Label muted style={{ fontSize: 11 }}>
                    {showDate
                      ? `${new Date(entry.timestamp).getMonth() + 1}/${new Date(entry.timestamp).getDate()} `
                      : ''}
                    {formatTime(entry.timestamp)}
                  </Label>
                </View>
                {entry.note ? (
                  <Label muted numberOfLines={2} style={{ fontSize: 13, lineHeight: 22 }}>
                    {entry.note}
                  </Label>
                ) : null}
                {activities.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {activities.slice(0, 4).map((activity) => (
                      <View
                        key={activity!.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 7,
                          backgroundColor: theme.subtle,
                        }}
                      >
                        <Icon name={activity!.icon} size={13} color={activity!.color} />
                        <Label muted style={{ fontSize: 11, lineHeight: 17 }}>
                          {activity!.label}
                        </Label>
                      </View>
                    ))}
                    {activities.length > 4 && (
                      <Label muted style={{ fontSize: 11 }}>
                        +{activities.length - 4}
                      </Label>
                    )}
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
    </View>
  );
}
