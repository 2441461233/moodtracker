import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import { useHealthSync } from '../context/HealthSyncContext';
import { useTheme } from '../theme';
import { Button, Card, Icon, Label } from './ui';
import { HealthRecordRow } from './HealthRecordRow';

export function AppleHealthSummary() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { availability, enabled, hasRead, records, status } = useHealthSync();
  const externalRecords = useMemo(
    () =>
      records
        .filter((record) => !record.isFromThisApp)
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, 3),
    [records],
  );

  if (!availability.available || !enabled) return null;

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <View
          style={{
            width: 34,
            height: 34,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            backgroundColor: theme.dangerSoft,
          }}
        >
          <Icon name="heart-pulse" size={18} color={theme.danger} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Label accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600' }}>
            Apple 心境近况
          </Label>
          <Label muted style={{ fontSize: 10 }}>
            来自其他 App · 与本地日记统计分开
          </Label>
        </View>
        {status === 'syncing' && (
          <Label style={{ color: theme.accentText, fontSize: 10 }}>同步中</Label>
        )}
      </View>

      {status === 'attention' && (
        <View style={{ gap: 5 }}>
          <Label style={{ fontSize: 12, color: theme.danger, lineHeight: 21 }}>
            自动同步需要处理。已有本地日记不受影响。
          </Label>
          <Button
            kind="ghost"
            icon="arrow-top-right"
            onPress={() => navigation.navigate('settings')}
            style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
          >
            前往“我的”检查连接
          </Button>
        </View>
      )}
      {!hasRead && status !== 'attention' ? (
        <Label muted style={{ fontSize: 12, lineHeight: 21 }}>
          正在等待首次读取。Apple 不会向 App 透露读取权限是否被拒绝。
        </Label>
      ) : externalRecords.length ? (
        <View style={{ gap: 9 }}>
          {externalRecords.map((record) => (
            <HealthRecordRow key={record.uuid} record={record} compact />
          ))}
        </View>
      ) : hasRead ? (
        <Label muted style={{ fontSize: 12, lineHeight: 21 }}>
          最近一年没有读取到其他来源的 Apple
          心境，可能是没有记录或未允许读取。它们不会被创建为本地日记。
        </Label>
      ) : null}
    </Card>
  );
}
