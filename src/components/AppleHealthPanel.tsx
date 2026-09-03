import React, { useState } from 'react';
import { View } from 'react-native';
import { useHealthSync } from '../context/HealthSyncContext';
import { formatDate, formatTime } from '../lib/dates';
import { useTheme } from '../theme';
import { Button, Card, Icon, Label } from './ui';
import { HealthRecordRow } from './HealthRecordRow';
import { Sheet } from './Sheet';

const unavailableCopy = {
  available: '',
  ios_version: '自动同步 Apple 心境需要 iOS 18 或更新版本。心情日记仍可正常使用。',
  health_data_unavailable: '这台设备目前无法使用 Apple 健康。心情日记不受影响。',
  native_module_missing: '需要安装包含健康功能的新版 iOS App；Expo Go 和旧安装包不支持。',
  unsupported_platform: '仅支持 iOS 18 及以上的原生 App。网页版和 Android 无法访问 Apple 健康。',
};

const statusCopy = {
  off: { label: '尚未连接', icon: 'link-variant-off', color: 'muted' },
  idle: { label: '自动同步已开启', icon: 'check-circle-outline', color: 'accent' },
  syncing: { label: '正在同步', icon: 'sync', color: 'accent' },
  attention: { label: '需要处理', icon: 'alert-circle-outline', color: 'danger' },
  paused: { label: '回到前台后继续', icon: 'pause-circle-outline', color: 'muted' },
} as const;

function timeCopy(value: number | null) {
  return value ? `${formatDate(value, true)} ${formatTime(value)}` : '尚无记录';
}

export function AppleHealthPanel() {
  const theme = useTheme();
  const sync = useHealthSync();
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const state = statusCopy[sync.status];
  const stateColor =
    state.color === 'danger'
      ? theme.danger
      : state.color === 'accent'
        ? theme.accentText
        : theme.muted;

  async function enable() {
    await sync.enable();
  }

  async function disable() {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      await sync.disable();
      setConfirmDisable(false);
      setVisibleCount(20);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <>
      <Card style={{ gap: 17 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <View style={{ padding: 12, borderRadius: 16, backgroundColor: theme.dangerSoft }}>
            <Icon name="heart-outline" color={theme.danger} size={25} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Label accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600' }}>
              Apple 健康 · 心境
            </Label>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name={state.icon} color={stateColor} size={13} />
              <Label style={{ color: stateColor, fontSize: 11 }}>
                {sync.loading ? '正在读取连接状态' : state.label}
              </Label>
            </View>
          </View>
        </View>
        <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
          {sync.availability.available
            ? sync.enabled
              ? '本地新增或修改会自动写入健康，Apple 心境变化会自动刷新到这里。不需要每次手动同步。'
              : '授权一次后，近一年的记录及之后的新变化会自动同步。文字笔记始终留在本地。'
            : unavailableCopy[sync.availability.reason]}
        </Label>
        {sync.availability.available ? (
          <Button
            kind="secondary"
            icon={sync.enabled ? 'cog-outline' : 'link-variant'}
            disabled={sync.loading}
            onPress={() => setOpen(true)}
          >
            {sync.enabled ? '管理自动同步' : '连接 Apple 健康'}
          </Button>
        ) : (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: theme.subtle,
              borderRadius: 9,
              paddingHorizontal: 10,
              paddingVertical: 7,
            }}
          >
            <Label muted style={{ fontSize: 11 }}>
              当前环境不可用 · 不影响本地记录
            </Label>
          </View>
        )}
      </Card>

      {open && (
        <Sheet
          title={sync.enabled ? '管理自动同步' : '连接 Apple 健康'}
          onClose={() => {
            setConfirmDisable(false);
            setOpen(false);
          }}
          scrollKey={confirmDisable ? 'disable' : sync.enabled ? 'connected' : 'connect'}
        >
          {confirmDisable ? (
            <View style={{ gap: 18 }}>
              <Label style={{ fontSize: 24, lineHeight: 35, fontWeight: '600' }}>
                要关闭自动同步吗？
              </Label>
              <Label muted style={{ fontSize: 13, lineHeight: 24 }}>
                关闭后会停止读取和写入，并清除本次在内存中读取的 Apple
                心境。你的本地日记和健康中已有的记录都不会被删除。
              </Label>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Button
                  kind="secondary"
                  disabled={disconnecting}
                  onPress={() => setConfirmDisable(false)}
                  style={{ flex: 1 }}
                >
                  返回
                </Button>
                <Button
                  kind="danger"
                  busy={disconnecting}
                  onPress={() => void disable()}
                  style={{ flex: 1 }}
                >
                  确认关闭
                </Button>
              </View>
            </View>
          ) : !sync.enabled ? (
            <View style={{ gap: 20 }}>
              <View style={{ gap: 10 }}>
                <Label style={{ fontSize: 24, lineHeight: 35, fontWeight: '600' }}>
                  授权一次，之后自动同步。
                </Label>
                <Label muted style={{ fontSize: 12, lineHeight: 23 }}>
                  开启时会请求 Apple
                  心境的读取和写入权限，并把最近一年范围内的现有本地记录写入健康；以后新增，或修改心情、活动、时间时会自动更新。
                </Label>
              </View>
              <View
                style={{ backgroundColor: theme.subtle, padding: 18, borderRadius: 17, gap: 11 }}
              >
                <Label style={{ fontSize: 13, fontWeight: '600' }}>连接前，你需要知道</Label>
                <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
                  只传心情、时间及苹果支持的活动，不传文字笔记或称呼。五档心情会近似映射为 Apple
                  愉悦度，不是医学量表。
                </Label>
                <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
                  读取到的心境只保留在运行内存中，用于前台展示；不会写入备份，也不会混入本地日记统计。
                </Label>
                <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
                  自动同步由系统调度：App 活跃时会及时响应，回到前台会补齐；后台不保证秒级，彻底关闭
                  App 后不会持续实时运行。
                </Label>
                <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
                  本地新增和心情修改会写入健康；Apple
                  心境更新会刷新只读展示。在任一边删除都不会自动删除另一边的记录。
                </Label>
              </View>
              <Label muted style={{ fontSize: 10, lineHeight: 19 }}>
                Apple 不会向 App 透露你是否拒绝读取；因此“未读到记录”不会被当作读取授权成功。
              </Label>
              {!!sync.error && (
                <Label
                  accessibilityRole="alert"
                  style={{ color: theme.danger, fontSize: 12, lineHeight: 22 }}
                >
                  {sync.error}
                </Label>
              )}
              <Button
                busy={sync.loading || sync.busy}
                icon="heart-plus-outline"
                onPress={() => void enable()}
              >
                开启自动同步
              </Button>
            </View>
          ) : (
            <View style={{ gap: 20 }}>
              <View style={{ gap: 10 }}>
                <Label style={{ fontSize: 24, lineHeight: 35, fontWeight: '600' }}>
                  {sync.status === 'syncing' ? '正在更新两边的心境。' : '让记录，自然连在一起。'}
                </Label>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Icon name={state.icon} color={stateColor} size={17} />
                  <Label style={{ color: stateColor, fontSize: 12, fontWeight: '600' }}>
                    {state.label}
                  </Label>
                </View>
              </View>

              <View
                style={{ backgroundColor: theme.subtle, padding: 18, borderRadius: 17, gap: 13 }}
              >
                <StatusRow label="上次读取 Apple 心境" value={timeCopy(sync.lastReadAt)} />
                <StatusRow label="上次写入 Apple 健康" value={timeCopy(sync.lastWriteAt)} />
                <StatusRow
                  label="心境写入权限"
                  value={
                    sync.writeAuthorization === 'authorized'
                      ? '已允许'
                      : sync.writeAuthorization === 'denied'
                        ? '未允许'
                        : '尚未确定'
                  }
                />
                <StatusRow
                  label="后台变化通知"
                  value={
                    sync.backgroundDelivery === 'enabled'
                      ? '已开启'
                      : sync.backgroundDelivery === 'unavailable'
                        ? '暂不可用'
                        : '未开启'
                  }
                />
              </View>

              {!!sync.error && (
                <View
                  style={{
                    gap: 11,
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: theme.dangerSoft,
                  }}
                >
                  <Label
                    accessibilityRole="alert"
                    style={{ color: theme.danger, fontSize: 12, lineHeight: 22 }}
                  >
                    {sync.error}
                  </Label>
                  <Button kind="secondary" busy={sync.busy} icon="refresh" onPress={sync.retry}>
                    立即重试
                  </Button>
                  {sync.writeAuthorization !== 'authorized' && (
                    <>
                      <Label muted style={{ fontSize: 11, lineHeight: 21 }}>
                        若曾拒绝权限，请先在健康 App 的个人资料 → App →
                        心情日记中允许“心境”写入，再重新连接。已启用的同步范围与隐私约定不变。
                      </Label>
                      <Button
                        kind="secondary"
                        busy={sync.busy}
                        icon="link-variant"
                        onPress={() => void enable()}
                      >
                        重新连接
                      </Button>
                    </>
                  )}
                </View>
              )}

              <View style={{ gap: 12 }}>
                <View style={{ gap: 5 }}>
                  <Label accessibilityRole="header" style={{ fontSize: 15, fontWeight: '600' }}>
                    来自 Apple 健康
                  </Label>
                  <Label muted style={{ fontSize: 10, lineHeight: 18 }}>
                    {sync.hasRead
                      ? `本次读取 ${sync.records.length} 条${sync.readTruncated ? ' · 已到 5,000 条上限' : ''}`
                      : '尚未完成一次读取；系统不会向 App 透露读取权限是否被拒绝'}
                  </Label>
                </View>
                {sync.hasRead && sync.records.length === 0 ? (
                  <View
                    style={{ padding: 18, borderRadius: 16, backgroundColor: theme.subtle, gap: 8 }}
                  >
                    <Label style={{ fontSize: 13 }}>最近一年暂未读取到心境</Label>
                    <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
                      可能是没有记录，也可能是未允许读取。请在健康 App 的个人资料 → App →
                      心情日记中检查“心境”权限。
                    </Label>
                  </View>
                ) : (
                  sync.records
                    .slice(0, visibleCount)
                    .map((record) => <HealthRecordRow key={record.uuid} record={record} />)
                )}
                {sync.records.length > visibleCount && (
                  <Button kind="ghost" onPress={() => setVisibleCount((count) => count + 20)}>
                    再查看 {Math.min(20, sync.records.length - visibleCount)} 条
                  </Button>
                )}
              </View>

              <Label muted style={{ fontSize: 11, lineHeight: 22 }}>
                读取结果只在当前运行内存中展示，与本地日记和统计保持分开。权限可随时在 Apple
                健康中更改；系统后台调度不保证秒级。
              </Label>
              <Button
                kind="danger"
                disabled={disconnecting}
                onPress={() => setConfirmDisable(true)}
              >
                关闭自动同步
              </Button>
            </View>
          )}
        </Sheet>
      )}
    </>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 18 }}>
      <Label muted style={{ fontSize: 11, flex: 1 }}>
        {label}
      </Label>
      <Label style={{ fontSize: 11, fontWeight: '600', textAlign: 'right', flexShrink: 1 }}>
        {value}
      </Label>
    </View>
  );
}
