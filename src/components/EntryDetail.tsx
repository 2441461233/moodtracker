import React, { useRef, useState, useSyncExternalStore } from 'react';
import { Platform, View } from 'react-native';
import { useMoodOverlays, useMoodActions, useMoodData } from '../context/MoodContext';
import { getActivity, getActivityIds } from '../data/activities';
import { formatDate, formatTime } from '../lib/dates';
import { MOOD_APPEARANCE, useTheme } from '../theme';
import { Button, Icon, Label, MoodIcon } from './ui';
import { Sheet } from './Sheet';
import { VoicePlayer } from './VoicePlayer';
import { currentVoice, getVoiceJob, startVoiceJob, subscribeVoiceJobs } from '../voice/jobs';
import { Disclosure } from './ui';

export function EntryDetail() {
  const { detail } = useMoodOverlays();
  const { entries } = useMoodData();
  useSyncExternalStore(subscribeVoiceJobs, () => getVoiceJob(detail?.voice?.id));
  const { openDetail, openComposer, removeEntry } = useMoodActions();
  const theme = useTheme();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const [visible, setVisible] = useState(true);
  const editPending = useRef(false);
  if (!detail) return null;
  const storedEntry = entries.find((item) => item.id === detail.id) ?? detail;
  const entry = { ...storedEntry, voice: currentVoice(storedEntry.voice) };
  const edit = () => {
    if (editPending.current) return;
    editPending.current = true;
    if (Platform.OS === 'ios') setVisible(false);
    else finishEditingTransition();
  };
  const finishEditingTransition = () => {
    if (!editPending.current) return;
    editPending.current = false;
    openDetail(null);
    openComposer({ entry });
  };
  const remove = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await removeEntry(entry.id, entry);
      openDetail(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '删除没有完成，请重试。记录仍保留在设备上。',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Sheet
      title="一个被记住的瞬间"
      visible={visible}
      onDismiss={finishEditingTransition}
      dismissDisabled={busy || !visible}
      onClose={() => {
        if (!busy) openDetail(null);
      }}
      footer={
        <View style={{ gap: 12 }}>
          {error && (
            <Label accessibilityRole="alert" style={{ color: theme.danger, fontSize: 12 }}>
              {error}
            </Label>
          )}
          {confirm ? (
            <>
              <Label style={{ fontSize: 13, lineHeight: 22 }}>
                确定删除这条记录吗？此操作无法撤销。已导出的备份，以及你已写入 Apple
                健康的副本，不会一并删除。
              </Label>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Button
                  kind="secondary"
                  onPress={() => setConfirm(false)}
                  disabled={busy}
                  style={{ flex: 1 }}
                >
                  保留记录
                </Button>
                <Button kind="danger" onPress={remove} busy={busy} style={{ flex: 1 }}>
                  确认删除
                </Button>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button kind="danger" onPress={() => setConfirm(true)} icon="trash-can-outline">
                删除
              </Button>
              <Button onPress={edit} icon="pencil-outline" style={{ flex: 1 }}>
                编辑记录
              </Button>
            </View>
          )}
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12, marginBottom: 18 }}>
        <MoodIcon id={entry.emotionId} size={76} />
        <Label style={{ fontSize: 25, fontWeight: '600', lineHeight: 34 }}>
          {MOOD_APPEARANCE[entry.emotionId].label}
        </Label>
        <Label muted style={{ fontSize: 12 }}>
          {formatDate(entry.timestamp, true)} · {formatTime(entry.timestamp)}
        </Label>
      </View>
      {getActivityIds(entry).length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {getActivityIds(entry).map((id) => {
            const activity = getActivity(id);
            return (
              activity && (
                <View
                  key={id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    backgroundColor: theme.subtle,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderRadius: 11,
                  }}
                >
                  <Icon name={activity.icon} size={17} color={activity.color} />
                  <Label style={{ fontSize: 12 }}>{activity.label}</Label>
                </View>
              )
            );
          })}
        </View>
      )}
      {entry.voice && (
        <View style={{ gap: 12, marginBottom: 16 }}>
          <Label muted style={{ fontSize: 12 }}>
            AI 转写{entry.voice.edited ? ' · 已修改' : ''}
          </Label>
          {entry.voice.transcript ? (
            <Label selectable style={{ fontSize: 16, lineHeight: 28 }}>
              {entry.voice.transcript}
            </Label>
          ) : (
            <Label muted style={{ fontSize: 13, lineHeight: 23 }}>
              {entry.voice.status === 'pending'
                ? '正在转写，完成后正文会显示在这里。'
                : entry.voice.edited
                  ? '已清空转写文字。'
                  : entry.voice.fileName
                    ? '尚未生成文字，原声仍可回听。'
                    : '这段录音没有转写文字。'}
            </Label>
          )}
          {!!entry.voice.error && (
            <Label style={{ fontSize: 12, lineHeight: 21, color: theme.secondary }}>
              {entry.voice.error}
            </Label>
          )}
          {entry.voice.status === 'failed' && entry.voice.fileName && (
            <Button kind="secondary" onPress={() => void startVoiceJob(entry.voice!)}>
              重新转写
            </Button>
          )}
          <VoicePlayer voice={entry.voice} />
          {entry.voice.originalTranscript && (
            <Disclosure title="查看识别原文">
              <Label selectable muted style={{ fontSize: 13, lineHeight: 23 }}>
                {entry.voice.originalTranscript}
              </Label>
            </Disclosure>
          )}
        </View>
      )}
      {(!entry.voice || entry.note) && (
        <View
          style={{ backgroundColor: theme.subtle, borderRadius: 18, padding: 20, minHeight: 110 }}
        >
          <Label
            selectable
            style={{
              fontSize: 14,
              lineHeight: 26,
              color: entry.note ? theme.text : theme.secondary,
            }}
          >
            {entry.note || '没有留下文字。光是记住此刻的感受，就已经很好。'}
          </Label>
        </View>
      )}
      {entry.updatedAt && (
        <Label muted style={{ marginTop: 14, fontSize: 10 }}>
          最后编辑于 {formatDate(entry.updatedAt)} {formatTime(entry.updatedAt)}
        </Label>
      )}
    </Sheet>
  );
}
