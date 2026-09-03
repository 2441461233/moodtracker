import React, { useState } from 'react';
import { View } from 'react-native';
import type { MoodEntry } from '../types';
import type { TimelineRecord } from '../health/timeline';
import { EntryList } from './EntryList';
import { HealthRecordRow } from './HealthRecordRow';
import { Button, Label } from './ui';

export function TimelineList({
  records,
  onPressLocal,
  showDate = false,
}: {
  records: readonly TimelineRecord[];
  onPressLocal: (entry: MoodEntry) => void;
  showDate?: boolean;
}) {
  const [limit, setLimit] = useState(20);
  return (
    <View style={{ gap: 12 }}>
      {records
        .slice(0, limit)
        .map((record) =>
          record.type === 'local' ? (
            <EntryList
              key={record.id}
              entries={[record.entry]}
              onPress={onPressLocal}
              showDate={showDate}
            />
          ) : (
            <HealthRecordRow key={record.id} record={record.sample} />
          ),
        )}
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
}
