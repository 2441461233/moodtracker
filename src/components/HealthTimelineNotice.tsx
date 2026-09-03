import React from 'react';
import { View } from 'react-native';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useHealthSync } from '../context/HealthSyncContext';
import { useTheme } from '../theme';
import { Button, Icon, Label } from './ui';

export function HealthTimelineNotice() {
  const health = useHealthSync();
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  if (!health.availability.available) return null;
  let message: string;
  if (!health.enabled) message = '连接 Apple 健康后，心境会自动出现在日历和每日记录里。';
  else if (health.error) message = health.error;
  else if (!health.hasRead) message = '正在等待 Apple 心境读取；暂未显示不代表没有记录。';
  else if (!health.records.length)
    message = '本次没有读到 Apple 心境；可能是最近一年无记录，或未允许读取。';
  else message = '已合并最近一年可读取的 Apple 心境 · 只读 · 已去除对应本地日记的副本';
  return (
    <View style={{ gap: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
        <Icon name="heart-pulse" size={15} color={health.error ? theme.danger : theme.accentText} />
        <Label muted style={{ flex: 1, fontSize: 11, lineHeight: 19 }}>
          {message}
        </Label>
      </View>
      {health.enabled && (
        <Label muted style={{ fontSize: 10, lineHeight: 18 }}>
          {health.readTruncated
            ? '本次已达到 5,000 条读取上限，较早记录可能未显示。'
            : '健康读取范围为最近 365 天；范围外的空白不代表没有记录。'}{' '}
          进入后台或关闭连接会清空健康展示，回到 App 自动重读；原始记录不删除。
        </Label>
      )}
      {(!health.enabled || health.error || (health.hasRead && !health.records.length)) && (
        <Button
          kind="ghost"
          icon="arrow-top-right"
          style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
          onPress={() => navigation.navigate('settings')}
        >
          {health.enabled ? '检查健康连接' : '连接 Apple 健康'}
        </Button>
      )}
    </View>
  );
}
