import React, { memo, useState } from 'react';
import { View } from 'react-native';
import type { MoodEntry } from '../types';
import type { TimelineRecord } from '../health/timeline';
import { EntryList } from './EntryList';
import { HealthRecordRow } from './HealthRecordRow';
import { Button, Label } from './ui';
import { dayKey, formatDate } from '../lib/dates';

export const TimelineList = memo(function TimelineList({
  records,
  onPressLocal,
  showDate = false,
  groupByDate = false,
}: {
  records: readonly TimelineRecord[];
  onPressLocal: (entry: MoodEntry) => void;
  showDate?: boolean;
  groupByDate?: boolean;
}) {
  const [limit, setLimit] = useState(20);
  return (
    <View style={{ gap: 12 }}>
      {records.slice(0, limit).map((record, index) => (
        <React.Fragment key={record.id}>
          {groupByDate &&
            (index === 0 || dayKey(records[index - 1].timestamp) !== dayKey(record.timestamp)) && (
              <Label
                accessibilityRole="header"
                muted
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  marginTop: index === 0 ? 0 : 14,
                  marginBottom: 2,
                }}
              >
                {formatDate(record.timestamp, true)}
              </Label>
            )}
          {record.type === 'local' ? (
            <EntryList
              key={record.id}
              entries={[record.entry]}
              onPress={onPressLocal}
              showDate={showDate}
            />
          ) : (
            <HealthRecordRow key={record.id} record={record.sample} compact={groupByDate} />
          )}
        </React.Fragment>
      ))}
      {records.length > limit && (
        <Button kind="secondary" onPress={() => setLimit((count) => count + 20)}>
          再显示 20 条（还有 {records.length - limit} 条）
        </Button>
      )}
      {records.length > 20 && (
        <Label muted style={{ fontSize: 11 }}>
          已显示 {Math.min(limit, records.length)} / {records.length} 条
        </Label>
      )}
    </View>
  );
});
