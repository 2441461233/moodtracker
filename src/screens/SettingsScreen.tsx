import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Switch, TextInput, View } from 'react-native';
import { useMoodData, useMoodActions } from '../context/MoodContext';
import { Page } from '../components/Page';
import { Button, Card, Disclosure, Icon, Label, SectionTitle, Segment } from '../components/ui';
import { Gradient } from '../components/effects';
import { Sheet } from '../components/Sheet';
import { AppleHealthPanel } from '../components/AppleHealthPanel';
import { font, useLayout, useTheme } from '../theme';
import { AppSettings, MoodEntry } from '../types';
import { parseBackup } from '../storage/core';
import { makeBackup, makeCSV } from '../lib/backup';
import { exportText, pickBackup } from '../lib/transfer';
import { dayKey } from '../lib/dates';
import { groupByDay } from '../lib/insights';
import appConfig from '../../app.json';

export default function SettingsScreen() {
  const { settings, entries } = useMoodData();
  const { updateSettings, importEntries, notify } = useMoodActions();
  const theme = useTheme();
  const { desktop } = useLayout();
  const [name, setName] = useState(settings.name);
  const previousName = useRef(settings.name);
  useEffect(() => {
    const previous = previousName.current;
    previousName.current = settings.name;
    setName((draft) => (draft === previous ? settings.name : draft));
  }, [settings.name]);
  const [saving, setSaving] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [incoming, setIncoming] = useState<MoodEntry[] | null>(null);
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const lock = useRef(false);
  const fileLock = useRef(false);
  const preferences = async (next: AppSettings, message?: string) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      await updateSettings(next);
      if (message) {
        setName(next.name);
        Keyboard.dismiss();
        notify(message);
      }
    } catch {
      setError('偏好设置没有保存成功，请再试一次。');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  const exportData = async (csv: boolean) => {
    if (fileLock.current) return;
    fileLock.current = true;
    setFileBusy(true);
    setError('');
    try {
      await exportText(
        csv ? makeCSV(entries) : makeBackup(entries),
        `moodtracker-${dayKey(new Date())}.${csv ? 'csv' : 'json'}`,
        csv ? 'text/csv' : 'application/json',
      );
      notify(
        Platform.OS === 'web'
          ? '已发起下载，请妥善保管你的心情备份。'
          : '分享面板已关闭，请确认备份已保存到你选择的位置。',
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : '导出未完成，请重试。');
    } finally {
      fileLock.current = false;
      setFileBusy(false);
    }
  };
  const selectFile = async () => {
    if (fileLock.current) return;
    fileLock.current = true;
    setFileBusy(true);
    setError('');
    setImportError('');
    try {
      const raw = await pickBackup();
      if (raw !== null) setIncoming(parseBackup(raw));
    } catch (error) {
      setError(error instanceof Error ? error.message : '无法读取这个备份文件。');
    } finally {
      fileLock.current = false;
      setFileBusy(false);
    }
  };
  const restore = async () => {
    if (fileLock.current || !incoming) return;
    fileLock.current = true;
    setFileBusy(true);
    setImportError('');
    try {
      const result = await importEntries(incoming);
      setIncoming(null);
      notify(
        `已导入 ${result.added} 条记录${result.skipped ? `，跳过 ${result.skipped} 条已存在的记录` : ''}。`,
      );
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '导入未完成，原有记录未被覆盖。');
    } finally {
      fileLock.current = false;
      setFileBusy(false);
    }
  };
  const duplicateCount =
    incoming?.filter((entry) => entries.some((existing) => existing.id === entry.id)).length ?? 0;
  return (
    <Page
      eyebrow="YOUR OWN LITTLE SPACE"
      title="我的心情空间"
      subtitle="按自己的习惯，照顾自己的感受。"
      action={false}
    >
      <View
        style={{ flexDirection: desktop ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}
      >
        <View
          style={{ flex: desktop ? 1.25 : undefined, width: desktop ? undefined : '100%', gap: 24 }}
        >
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 25 }}>
              <Gradient
                colors={[theme.accentFrom, theme.accentTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                borderRadius={21}
                style={{
                  width: 59,
                  height: 59,
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: theme.dark
                    ? '0 6px 22px rgba(139, 124, 246, 0.35)'
                    : '0 8px 20px rgba(108, 99, 223, 0.28)',
                }}
              >
                <Icon
                  name="account-heart-outline"
                  size={31}
                  color={theme.dark ? '#17123A' : '#FFFFFF'}
                />
              </Gradient>
              <View style={{ flex: 1, gap: 6 }}>
                <Label style={{ fontSize: 18, fontWeight: '600' }}>
                  {settings.name || '欢迎，真实的你'}
                </Label>
                <Label muted style={{ fontSize: 12 }}>
                  已经留下 {entries.length} 个瞬间，陪伴自己 {groupByDay(entries).size} 天
                </Label>
              </View>
            </View>
            <Label muted style={{ fontSize: 12, marginBottom: 10 }}>
              希望怎么称呼你？
            </Label>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                accessibilityLabel="你的称呼"
                placeholder="给自己一个喜欢的称呼"
                placeholderTextColor={theme.muted}
                maxLength={24}
                value={name}
                editable={!saving}
                returnKeyType="done"
                keyboardAppearance={theme.dark ? 'dark' : 'light'}
                onChangeText={setName}
                onSubmitEditing={() => {
                  void preferences({ ...settings, name: name.trim() }, '称呼已更新。');
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: theme.subtle,
                  color: theme.text,
                  fontFamily: font,
                  fontSize: 16,
                  minHeight: 47,
                  borderRadius: 13,
                  paddingHorizontal: 14,
                }}
              />
              <Button
                busy={saving}
                disabled={name.trim() === settings.name}
                onPress={() => {
                  void preferences({ ...settings, name: name.trim() }, '称呼已更新。');
                }}
              >
                保存
              </Button>
            </View>
            <Label muted style={{ fontSize: 10, marginTop: 9 }}>
              选填，只在本设备上使用，不是账户信息。
            </Label>
          </Card>
          <Card>
            <SectionTitle title="外观与反馈" />
            <View style={{ gap: 22 }}>
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>
                  <Icon name="palette-outline" size={20} />
                  <Label style={{ fontSize: 13 }}>外观主题</Label>
                </View>
                <Segment
                  disabled={saving}
                  value={settings.theme}
                  onChange={(value) => {
                    void preferences({ ...settings, theme: value });
                  }}
                  options={[
                    { id: 'light', label: '浅色' },
                    { id: 'dark', label: '深色' },
                    { id: 'system', label: '跟随系统' },
                  ]}
                />
              </View>
              <View style={{ height: 1, backgroundColor: theme.border }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon name="gesture-tap" size={21} />
                <View style={{ flex: 1, gap: 5 }}>
                  <Label style={{ fontSize: 13 }}>轻触反馈</Label>
                  <Label muted style={{ fontSize: 11 }}>
                    {Platform.OS === 'web'
                      ? '触感反馈仅在原生手机应用中可用'
                      : '选择心情时，一点轻轻的回应'}
                  </Label>
                </View>
                <Switch
                  accessibilityLabel="轻触反馈"
                  disabled={saving || Platform.OS === 'web'}
                  value={settings.haptics && Platform.OS !== 'web'}
                  onValueChange={(haptics) => {
                    void preferences({ ...settings, haptics });
                  }}
                  trackColor={{ false: theme.border, true: theme.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </Card>
          {Platform.OS === 'ios' && (
            <Card>
              <SectionTitle title="桌面小组件" subtitle="记录用小卡片，日历用大卡片" />
              <Label style={{ fontSize: 13, lineHeight: 23 }}>
                长按主屏幕空白处，选择添加小组件，搜索「情绪像素」。添加小号「快速记录」和大号「心情日历」，再拖到喜欢的位置。
              </Label>
              <Label muted style={{ fontSize: 12, lineHeight: 22, marginTop: 10 }}>
                小卡片轻点即记，已有输入会保留。大卡片显示本月的本地心情，轻点日期查看当天记录；保存后由系统安排刷新。
              </Label>
            </Card>
          )}
        </View>
        <View
          style={{ flex: desktop ? 1 : undefined, width: desktop ? undefined : '100%', gap: 24 }}
        >
          <AppleHealthPanel />
          <Card>
            <SectionTitle title="备份与导入" subtitle="导出完整备份，或把记录带到另一台设备" />
            <View style={{ gap: 13 }}>
              <Button
                kind="secondary"
                icon="download-outline"
                disabled={fileBusy}
                onPress={() => {
                  void exportData(false);
                }}
              >
                导出 JSON 备份
              </Button>
              <Button
                kind="ghost"
                icon="table-arrow-right"
                disabled={fileBusy}
                onPress={() => {
                  void exportData(true);
                }}
              >
                导出 CSV 表格
              </Button>
              <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 2 }} />
              <Button
                kind="secondary"
                icon="tray-arrow-up"
                disabled={fileBusy}
                onPress={() => {
                  void selectFile();
                }}
              >
                从 JSON 备份导入
              </Button>
              <Label muted style={{ fontSize: 11, lineHeight: 21 }}>
                导入会保留原有记录，只添加新记录。相同编号的记录会跳过，不会覆盖本地修改。兼容旧版日记备份。
              </Label>
            </View>
          </Card>
          {!!error && (
            <Card style={{ backgroundColor: theme.dangerSoft }}>
              <Label accessibilityRole="alert" style={{ fontSize: 12, color: theme.danger }}>
                {error}
              </Label>
            </Card>
          )}
        </View>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 16, gap: 4 }}>
        <Label muted style={{ fontSize: 12, lineHeight: 21 }}>
          记录保存在本设备。换设备或卸载前，请先导出备份。
        </Label>
        <Disclosure title="隐私与本地保存">
          <Label muted style={{ fontSize: 12, lineHeight: 21 }}>
            无需注册，笔记、活动与洞察在本地处理，不上传到我们的服务器。Apple
            健康同步需你主动连接并授权，文字笔记不参与同步。
          </Label>
          <Label muted style={{ fontSize: 12, lineHeight: 21 }}>
            不接入 AI 情绪分析，不设置广告与追踪统计，不自动上传文字日记。
          </Label>
          <Label muted style={{ fontSize: 12, lineHeight: 21 }}>
            网页记录保存在当前浏览器，原生应用记录保存在应用内。更换设备、浏览器或网址后，需要导入备份才能恢复记录。
          </Label>
          <Label muted style={{ fontSize: 12, lineHeight: 21 }}>
            清除浏览器数据、卸载应用或使用无痕模式可能丢失记录。数据未单独加密，请保护设备访问权限，并妥善保存备份。
          </Label>
        </Disclosure>
        <Label muted style={{ fontSize: 11, lineHeight: 20 }}>
          情绪像素 · {appConfig.expo.version}
        </Label>
        <Label muted style={{ fontSize: 11, lineHeight: 20 }}>
          用于自我记录与觉察，不提供诊断或治疗，不能替代专业支持。
        </Label>
      </View>
      {incoming && (
        <Sheet
          title="确认导入备份"
          dismissDisabled={fileBusy}
          onClose={() => {
            if (!fileBusy) setIncoming(null);
          }}
          footer={
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                kind="secondary"
                disabled={fileBusy}
                onPress={() => setIncoming(null)}
                style={{ flex: 1 }}
              >
                取消
              </Button>
              <Button busy={fileBusy} onPress={restore} style={{ flex: 1 }}>
                合并导入
              </Button>
            </View>
          }
        >
          <View style={{ gap: 15 }}>
            <Label style={{ fontSize: 23, fontWeight: '600', lineHeight: 34 }}>
              找到 {incoming.length} 条心情记录
            </Label>
            <Label muted style={{ lineHeight: 25 }}>
              将添加 {incoming.length - duplicateCount} 条新记录，跳过 {duplicateCount}{' '}
              条已存在的记录。你的本地记录和偏好设置会完整保留。
            </Label>
            <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
              文件只在这台设备读取，不会上传到服务器。
            </Label>
            {!!importError && (
              <Label accessibilityRole="alert" style={{ color: theme.danger, fontSize: 12 }}>
                {importError}
              </Label>
            )}
          </View>
        </Sheet>
      )}
    </Page>
  );
}
