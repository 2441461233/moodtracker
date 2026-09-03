import React, { useRef, useState } from 'react';
import { Platform, Switch, TextInput, View } from 'react-native';
import { useMood } from '../context/MoodContext';
import { Page } from '../components/Page';
import { Button, Card, Icon, Label, SectionTitle, Segment } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { AppleHealthPanel } from '../components/AppleHealthPanel';
import { font, useLayout, useTheme } from '../theme';
import { AppSettings, MoodEntry } from '../types';
import { parseBackup } from '../storage/core';
import { makeBackup, makeCSV } from '../lib/backup';
import { exportText, pickBackup } from '../lib/transfer';
import { dayKey } from '../lib/dates';
import { groupByDay } from '../lib/insights';

export default function SettingsScreen() {
  const { settings, entries, updateSettings, importEntries, notify } = useMood();
  const theme = useTheme();
  const { desktop } = useLayout();
  const [name, setName] = useState(settings.name);
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
      if (message) notify(message);
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
        <View style={{ flex: 1.25, width: desktop ? undefined : '100%', gap: 24 }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 25 }}>
              <View
                style={{
                  width: 59,
                  height: 59,
                  backgroundColor: theme.accentSoft,
                  borderRadius: 21,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="account-heart-outline" size={31} color={theme.accentText} />
              </View>
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
                  fontSize: 13,
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
            <SectionTitle title="让这里，更像你" />
            <View style={{ gap: 22 }}>
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>
                  <Icon name="palette-outline" size={20} />
                  <Label style={{ fontSize: 13 }}>外观主题</Label>
                </View>
                <View pointerEvents={saving ? 'none' : 'auto'}>
                  <Segment
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
          <AppleHealthPanel />
          <Card>
            <SectionTitle
              title="你的记录，始终由你掌握"
              subtitle="导出完整备份，或把记录带到另一台设备"
            />
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
                导入会保留原有记录，只添加新记录。相同编号的记录会跳过，不会覆盖本地修改。支持原版心情日记备份。
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
        <View style={{ flex: 1, width: desktop ? undefined : '100%', gap: 24 }}>
          <Card style={{ backgroundColor: theme.accentSoft, borderColor: 'transparent', gap: 18 }}>
            <Icon name="shield-lock-outline" size={32} color={theme.accentText} />
            <Label style={{ fontSize: 21, fontWeight: '600', lineHeight: 31 }}>
              有些心事，{'\n'}只需要自己知道。
            </Label>
            <Label muted style={{ fontSize: 13, lineHeight: 24 }}>
              无需注册，不上传到我们的服务器。{'\n'}笔记、活动与洞察在本地处理；可选的 Apple
              健康读写，只在你授权并操作时发生。
            </Label>
            <View style={{ height: 1, backgroundColor: theme.accent + '30' }} />
            <View style={{ gap: 12 }}>
              {['不接入 AI 情绪分析', '不设置广告与追踪统计', '不自动上传文字日记'].map((item) => (
                <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <Icon name="check-circle-outline" color={theme.accentText} size={17} />
                  <Label style={{ fontSize: 12 }}>{item}</Label>
                </View>
              ))}
            </View>
          </Card>
          <Card style={{ gap: 13 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Icon name="information-outline" size={20} color={theme.orange} />
              <Label style={{ fontSize: 14, fontWeight: '600' }}>关于本地保存</Label>
            </View>
            <Label muted style={{ fontSize: 12, lineHeight: 23 }}>
              网页记录保存在当前浏览器，原生应用记录保存在应用内。更换设备、浏览器或网址后，不会自动出现原来的记录；请先导出备份，再在新设备导入。
            </Label>
            <Label muted style={{ fontSize: 12, lineHeight: 23 }}>
              清除浏览器数据、卸载应用或使用无痕模式可能丢失记录。数据未单独加密，请保护设备访问权限，并妥善保存导出的文件。
            </Label>
          </Card>
          <View style={{ paddingHorizontal: 6, gap: 10 }}>
            <Label style={{ fontSize: 16, fontWeight: '700', letterSpacing: -0.5 }}>
              moodtracker.
            </Label>
            <Label muted style={{ fontSize: 11 }}>
              心情日记 · 2.1.0
            </Label>
            <Label muted style={{ fontSize: 11, lineHeight: 22 }}>
              一个帮助自我记录与觉察的小空间。{'\n'}不提供诊断或治疗，不能替代专业支持。
            </Label>
          </View>
        </View>
      </View>
      {incoming && (
        <Sheet
          title="确认导入备份"
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
