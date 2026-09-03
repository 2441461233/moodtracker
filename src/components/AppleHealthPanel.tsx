import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useMood } from '../context/MoodContext';
import { healthExporter, MoodHealth, selectEntriesForHealth } from '../health';
import { formatDate, formatTime } from '../lib/dates';
import { useTheme } from '../theme';
import { MoodEntry } from '../types';
import { Button, Card, Icon, Label, Segment } from './ui';
import { Sheet } from './Sheet';

type HealthRecord = Awaited<ReturnType<typeof MoodHealth.queryStateOfMind>>[number];
type WriteAuthorization = ReturnType<typeof MoodHealth.getWriteAuthorization>;
type Range = 30 | 90 | 365;
type Operation = 'read' | 'write' | null;
const DAY = 86_400_000;
const READ_LIMIT = 200;

const unavailableCopy = {
  available: '',
  ios_version: '记录心境需要 iOS 18 或更新版本。你仍然可以正常使用心情日记。',
  health_data_unavailable: '这台设备目前无法使用 Apple 健康。心情日记不受影响。',
  native_module_missing: '需要安装包含健康功能的新版 iOS App；Expo Go 和旧安装包不支持。',
  unsupported_platform: '仅支持 iOS 18 及以上的原生 App。网页版和 Android 无法访问 Apple 健康。',
};

export function AppleHealthPanel() {
  const { entries, now } = useMood();
  const theme = useTheme();
  const [availability] = useState(() => MoodHealth.getAvailability());
  const [authorization, setAuthorization] = useState<WriteAuthorization>('notDetermined');
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range>(30);
  const [pending, setPending] = useState<{
    entries: MoodEntry[];
    range: Range;
    selectedAt: number;
  } | null>(null);
  const [busy, setBusy] = useState<Operation>(null);
  const [records, setRecords] = useState<HealthRecord[] | null>(null);
  const [readTime, setReadTime] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const mounted = useRef(true);
  const isOpen = useRef(false);
  const queryGeneration = useRef(0);
  const viewGeneration = useRef(0);
  const selected = useMemo(
    () => selectEntriesForHealth(entries, range, now.getTime()),
    [entries, range, now],
  );

  // Never keep Apple health samples in AsyncStorage, backups, or a background view.
  // Returning from Settings refreshes *write* status only, never reads health data.
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        queryGeneration.current++;
        setRecords(null);
        setReadTime(null);
      } else if (availability.available) {
        setAuthorization(MoodHealth.getWriteAuthorization());
      }
    });
    return () => {
      mounted.current = false;
      isOpen.current = false;
      queryGeneration.current++;
      subscription.remove();
    };
  }, [availability.available]);

  function clearRead() {
    queryGeneration.current++;
    setRecords(null);
    setReadTime(null);
    setVisibleCount(20);
  }

  function close() {
    // Avoid interrupting a batch after only some records have been written.
    if (busy === 'write') return;
    isOpen.current = false;
    viewGeneration.current++;
    clearRead();
    setPending(null);
    setOpen(false);
  }

  function show() {
    isOpen.current = true;
    setAuthorization(MoodHealth.getWriteAuthorization());
    setError('');
    setMessage('');
    setOpen(true);
  }

  async function run(operation: Exclude<Operation, null>, action: () => Promise<void>) {
    if (lock.current || !availability.available) return;
    const view = viewGeneration.current;
    lock.current = true;
    setBusy(operation);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (failure) {
      if (mounted.current && isOpen.current && view === viewGeneration.current) {
        setError(failure instanceof Error ? failure.message : '操作未完成，请稍后重试。');
      }
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(null);
        setAuthorization(MoodHealth.getWriteAuthorization());
      }
    }
  }

  async function read() {
    const view = viewGeneration.current;
    await run('read', async () => {
      clearRead();
      const result = await MoodHealth.requestAuthorization(true, false);
      if (!result.requestCompleted) throw new Error('授权步骤没有完成，你的日记未被修改。');
      if (!mounted.current || !isOpen.current || view !== viewGeneration.current) return;
      if (AppState.currentState !== 'active') {
        setMessage('回到应用后，点“读取 / 刷新心境”即可查看。');
        return;
      }
      const generation = queryGeneration.current;
      const end = Date.now();
      const samples = await MoodHealth.queryStateOfMind(end - range * DAY, end, READ_LIMIT);
      if (
        !mounted.current ||
        !isOpen.current ||
        view !== viewGeneration.current ||
        generation !== queryGeneration.current ||
        AppState.currentState !== 'active'
      )
        return;
      setRecords(samples);
      setReadTime(end);
    });
  }

  function prepareWrite() {
    if (lock.current) return;
    setError('');
    setMessage('');
    const selectedAt = Date.now();
    setPending({
      range,
      selectedAt,
      entries: selectEntriesForHealth(entries, range, selectedAt).map((entry) => ({
        ...entry,
        activityIds: entry.activityIds ? [...entry.activityIds] : undefined,
      })),
    });
  }

  async function write() {
    if (!pending) return;
    // A foreground reload can change the journal while its confirmation is open.
    // Ask for a fresh confirmation instead of exporting an obsolete snapshot.
    const current = selectEntriesForHealth(entries, pending.range, pending.selectedAt);
    if (JSON.stringify(current) !== JSON.stringify(pending.entries)) {
      setPending(null);
      setError('本地记录已更新，请重新选择写入并确认数量。');
      return;
    }
    const snapshot = pending.entries;
    await run('write', async () => {
      const result = await MoodHealth.requestAuthorization(false, true);
      if (!result.requestCompleted || result.writeAuthorization !== 'authorized') {
        throw new Error(
          '尚未获得“心境”写入权限。请在健康 App 的个人资料 → App → 心情日记中检查权限；未授权不会影响本地记录。',
        );
      }
      const exported = await healthExporter.exportEntries(snapshot);
      if (!mounted.current) return;
      setPending(null);
      clearRead();
      setMessage(`已写入 ${exported.saved} 条，跳过 ${exported.skipped} 条未变化的记录。`);
      if (exported.failed > 0) {
        setError(
          `另有 ${exported.failed} 条暂未确认写入成功，可以重试。已完成的条目不会因重试而重复新增，本地记录没有改变。`,
        );
      }
    });
  }

  const writeStatus =
    authorization === 'authorized'
      ? '系统已允许写入'
      : authorization === 'denied'
        ? '系统未允许写入'
        : '写入权限尚未申请';

  return (
    <>
      <Card style={{ gap: 17 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <View style={{ padding: 12, borderRadius: 16, backgroundColor: theme.dangerSoft }}>
            <Icon name="heart-outline" color={theme.danger} size={25} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Label accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600' }}>
              连接 Apple 健康
            </Label>
            <Label muted style={{ fontSize: 12 }}>
              让不同地方记下的感受，在这里相遇
            </Label>
          </View>
        </View>
        <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
          {availability.available
            ? '按需查看健康 / 正念中的心境，也可以把本地心情写入健康。两项权限分别由你决定，文字日记始终留在本地。'
            : unavailableCopy[availability.reason]}
        </Label>
        {availability.available ? (
          <Button kind="secondary" icon="heart-pulse" onPress={show}>
            管理心境连接
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
          title={pending ? '确认写入 Apple 健康' : 'Apple 健康 · 心境'}
          onClose={close}
          scrollKey={pending ? 'confirm' : 'manage'}
          footer={
            pending ? (
              <View style={{ gap: 10 }}>
                {!!error && (
                  <Label
                    accessibilityRole="alert"
                    style={{ color: theme.danger, fontSize: 12, lineHeight: 21 }}
                  >
                    {error}
                  </Label>
                )}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Button
                    kind="secondary"
                    disabled={!!busy}
                    onPress={() => {
                      setPending(null);
                      setError('');
                    }}
                    style={{ flex: 1 }}
                  >
                    返回
                  </Button>
                  <Button
                    busy={busy === 'write'}
                    disabled={!!busy}
                    onPress={() => {
                      void write();
                    }}
                    style={{ flex: 1 }}
                  >
                    确认写入
                  </Button>
                </View>
              </View>
            ) : undefined
          }
        >
          {pending ? (
            <View style={{ gap: 18 }}>
              <Label style={{ fontSize: 26, lineHeight: 38, fontWeight: '600' }}>
                分享 {pending.entries.length} 个{'\n'}被认真记住的瞬间
              </Label>
              <Label muted style={{ fontSize: 13, lineHeight: 24 }}>
                范围：最近 {pending.range}{' '}
                天。只写入心情、时间，以及苹果支持的对应活动；不会写入笔记或称呼。
              </Label>
              <View
                style={{ backgroundColor: theme.subtle, padding: 18, borderRadius: 17, gap: 10 }}
              >
                <Label style={{ fontSize: 13, fontWeight: '600' }}>写入前，你需要知道</Label>
                <Label muted style={{ fontSize: 12, lineHeight: 23 }}>
                  五档心情按顺序近似对应愉悦度
                  +1、+0.5、0、−0.5、−1，类型统一为“当下情绪”，不是一天的整体心情。它不是医学量表。
                </Label>
                <Label muted style={{ fontSize: 12, lineHeight: 23 }}>
                  本应用已发送且未变化的记录会跳过；修改后需要再次手动写入。仅修改文字笔记不会更新健康记录。
                </Label>
                <Label muted style={{ fontSize: 12, lineHeight: 23 }}>
                  删除本地记录不会删除 Apple
                  健康中的副本。在健康中删除的记录，也不会自动补回。健康数据是否通过 iCloud
                  同步，由你的系统设置决定。
                </Label>
              </View>
            </View>
          ) : (
            <View style={{ gap: 22 }}>
              <View style={{ gap: 10 }}>
                <Label style={{ fontSize: 24, lineHeight: 35, fontWeight: '600' }}>
                  连接，由你做主。
                </Label>
                <Label muted style={{ fontSize: 12, lineHeight: 23 }}>
                  只在你点击时读取或写入，不自动后台同步。“心境”和“正念分钟数”是两类数据，这里只连接心境。
                </Label>
              </View>
              <View style={{ gap: 11 }}>
                <Label style={{ fontSize: 12, fontWeight: '600' }}>回顾与写入的范围</Label>
                <Segment
                  value={String(range)}
                  onChange={(value) => {
                    if (lock.current) return;
                    viewGeneration.current++;
                    clearRead();
                    setRange(Number(value) as Range);
                    setError('');
                    setMessage('');
                  }}
                  options={[
                    { id: '30', label: '30 天' },
                    { id: '90', label: '90 天' },
                    { id: '365', label: '一年' },
                  ]}
                />
              </View>
              <View
                style={{ gap: 12, padding: 17, borderRadius: 17, backgroundColor: theme.subtle }}
              >
                <Label style={{ fontSize: 14, fontWeight: '600' }}>从健康 / 正念读取</Label>
                <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
                  保留“当下情绪”和“一天整体心情”的区别。结果只在本页展示，不混入日记统计、不放入
                  JSON / CSV 备份；关闭页面或进入后台后清除。
                </Label>
                <Button
                  kind="secondary"
                  busy={busy === 'read'}
                  disabled={!!busy}
                  icon="refresh"
                  onPress={() => {
                    void read();
                  }}
                >
                  读取 / 刷新心境
                </Button>
                <Label muted style={{ fontSize: 10, lineHeight: 19 }}>
                  苹果不会向应用透露你是否允许读取，因此授权面板关闭不代表已获得读取权限。
                </Label>
              </View>
              <View
                style={{ gap: 12, padding: 17, borderRadius: 17, backgroundColor: theme.subtle }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <Label style={{ fontSize: 14, fontWeight: '600' }}>把本地心情写入健康</Label>
                  <Label muted style={{ fontSize: 10 }}>
                    {writeStatus}
                  </Label>
                </View>
                <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
                  最近 {range} 天有 {selected.length}{' '}
                  条本地记录。每次写入前都会再确认，未修改的已发送条目会跳过。
                </Label>
                <Button
                  kind="secondary"
                  disabled={!!busy || selected.length === 0}
                  icon="arrow-top-right"
                  onPress={prepareWrite}
                >
                  选择写入 · {selected.length} 条
                </Button>
              </View>
              {!!message && (
                <Label
                  accessibilityLiveRegion="polite"
                  style={{ color: theme.accentText, fontSize: 12, lineHeight: 23 }}
                >
                  {message}
                </Label>
              )}
              {!!error && (
                <Label
                  accessibilityRole="alert"
                  style={{ color: theme.danger, fontSize: 12, lineHeight: 23 }}
                >
                  {error}
                </Label>
              )}
              {records !== null && (
                <View style={{ gap: 13 }}>
                  <View style={{ gap: 5 }}>
                    <Label accessibilityRole="header" style={{ fontSize: 15, fontWeight: '600' }}>
                      来自 Apple 健康
                    </Label>
                    <Label muted style={{ fontSize: 10 }}>
                      本次读取 {records.length} 条 · 最多显示最近 {READ_LIMIT} 条
                      {readTime ? ` · ${formatTime(readTime)} 刷新` : ''}
                    </Label>
                  </View>
                  {records.length === 0 ? (
                    <View
                      style={{
                        padding: 18,
                        borderRadius: 16,
                        backgroundColor: theme.subtle,
                        gap: 8,
                      }}
                    >
                      <Label style={{ fontSize: 13 }}>暂未读取到心境记录</Label>
                      <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
                        可能是范围内没有记录，也可能是尚未允许读取。可以扩大时间范围，或到健康 App
                        的个人资料 → App → 心情日记检查“心境”权限。
                      </Label>
                    </View>
                  ) : (
                    records
                      .slice(0, visibleCount)
                      .map((record) => <HealthRecordRow key={record.uuid} record={record} />)
                  )}
                  {records.length > visibleCount && (
                    <Button kind="ghost" onPress={() => setVisibleCount((count) => count + 20)}>
                      再查看 {Math.min(20, records.length - visibleCount)} 条
                    </Button>
                  )}
                </View>
              )}
              <Label muted style={{ fontSize: 11, lineHeight: 22 }}>
                权限可以随时在 Apple
                健康中关闭。连接不是账户登录，也不是两边的自动镜像；在一处编辑或删除，不会自动改动另一处。
              </Label>
            </View>
          )}
        </Sheet>
      )}
    </>
  );
}

function HealthRecordRow({ record }: { record: HealthRecord }) {
  const theme = useTheme();
  const valence = record.valence;
  return (
    <View
      style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, gap: 9 }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Label style={{ fontSize: 13, fontWeight: '600' }}>
          {record.kind === 'dailyMood' ? '一天整体心情' : '当下情绪'}
        </Label>
        <Label style={{ fontSize: 12, color: theme.accentText }}>
          愉悦度 {valence > 0 ? '+' : ''}
          {valence.toFixed(2)}
        </Label>
      </View>
      <Label muted style={{ fontSize: 11 }}>
        {formatDate(record.timestamp, true)} · {formatTime(record.timestamp)}
      </Label>
      <Label muted style={{ fontSize: 10, lineHeight: 18 }}>
        来源：{record.sourceName || 'Apple 健康'}
        {record.isFromThisApp ? ' · 本应用写入' : ''}
      </Label>
    </View>
  );
}
