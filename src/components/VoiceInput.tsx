import React, { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioRecorder,
} from 'expo-audio';
import { VoiceRecording } from '../types';
import { font, useTheme } from '../theme';
import { Button, Disclosure, Icon, Label } from './ui';
import { retainRecording } from '../voice/files';
import { currentVoice, getVoiceJob, startVoiceJob, subscribeVoiceJobs } from '../voice/jobs';
import { formatDuration, MAX_RECORDING_MS, MAX_TRANSCRIPT_LENGTH } from '../voice/core';
import { VoicePlayer } from './VoicePlayer';
import { setPlaybackAudioMode, setRecordingAudioMode } from '../voice/audio-session';

type Stage = 'idle' | 'starting' | 'recording' | 'paused' | 'finishing' | 'recover';
export const VoiceInput = memo(function VoiceInput({
  draft,
  disabled,
  onBusy,
  onCreated,
}: {
  draft: React.RefObject<VoiceRecording | undefined>;
  disabled: boolean;
  onBusy(value: boolean): void;
  onCreated(voice: VoiceRecording): void;
}) {
  const theme = useTheme();
  const [stage, setStage] = useState<Stage>('idle');
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const captured = useRef<{ uri: string; duration: number } | null>(null);
  const lastDuration = useRef(0);
  const latestFinish = useRef<() => void>(() => {});
  const options = {
    ...RecordingPresets.HIGH_QUALITY,
    numberOfChannels: 1,
    bitRate: 64000,
    isMeteringEnabled: true,
    web: {
      bitsPerSecond: 64000,
      ...(Platform.OS === 'web' && typeof MediaRecorder !== 'undefined'
        ? {
            mimeType: ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(
              (type) => MediaRecorder.isTypeSupported(type),
            ),
          }
        : {}),
    },
  };
  const recorder = useAudioRecorder(options, (status) => {
    if (
      (status.isFinished || status.hasError) &&
      ['recording', 'paused'].includes(stageRef.current)
    ) {
      if (status.url)
        captured.current = {
          uri: status.url,
          duration: Math.max(1, Math.min(MAX_RECORDING_MS, lastDuration.current)),
        };
      latestFinish.current();
    }
  });
  useSyncExternalStore(subscribeVoiceJobs, () => getVoiceJob(draft.current?.id));
  const voice = currentVoice(draft.current);
  draft.current = voice;
  void revision;
  const transition = (next: Stage) => {
    stageRef.current = next;
    if (alive.current) setStage(next);
  };
  const start = async () => {
    if (lock.current || disabled) return;
    lock.current = true;
    onBusy(true);
    setError('');
    setConfirm(false);
    transition('starting');
    Keyboard.dismiss();
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setPermissionDenied(true);
        throw new Error('麦克风权限未开启，你仍然可以用文字记录。');
      }
      setPermissionDenied(false);
      if (!alive.current) return;
      await setRecordingAudioMode();
      if (!alive.current) return;
      await recorder.prepareToRecordAsync();
      if (!alive.current) return;
      lastDuration.current = 0;
      recorder.record();
      transition('recording');
    } catch (error) {
      await setPlaybackAudioMode().catch(() => undefined);
      if (alive.current) {
        setError(error instanceof Error ? error.message : '录音未能开始，请重试。');
        transition('idle');
        onBusy(false);
      }
    } finally {
      lock.current = false;
    }
  };
  const finish = async () => {
    if (lock.current) return;
    lock.current = true;
    transition('finishing');
    setError('');
    try {
      if (!captured.current) {
        const duration = Math.max(
          1,
          Math.min(
            MAX_RECORDING_MS,
            Math.max(lastDuration.current, recorder.getStatus().durationMillis),
          ),
        );
        await recorder.stop();
        if (!recorder.uri) throw new Error('暂时无法读取录音，请重试。');
        captured.current = { uri: recorder.uri, duration };
      }
      const next = await retainRecording(captured.current.uri, captured.current.duration);
      // The native recorder must finish changing audio mode before publishing
      // the attachment mounts its player or unlocks the next recording.
      await setPlaybackAudioMode().catch(() => undefined);
      if (!alive.current) {
        onCreated(next);
        return;
      }
      onCreated(next);
      draft.current = next;
      captured.current = null;
      transition('idle');
      onBusy(false);
      setEditing(false);
      setRevision((value) => value + 1);
      void startVoiceJob(next);
    } catch (error) {
      await setPlaybackAudioMode().catch(() => undefined);
      if (alive.current) {
        setError(error instanceof Error ? error.message : '录音暂未保存，请重试。');
        transition('recover');
      }
    } finally {
      lock.current = false;
    }
  };
  latestFinish.current = () => void finish();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (value) => {
      if (value !== 'active' && stageRef.current === 'recording') {
        recorder.pause();
        transition('paused');
      }
    });
    return () => {
      subscription.remove();
    };
  }, [recorder]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      void setPlaybackAudioMode().catch(() => undefined);
    };
  }, []);
  const pause = () => {
    if (stage === 'paused') {
      recorder.record();
      transition('recording');
    } else {
      recorder.pause();
      transition('paused');
    }
  };
  const isCapturing = stage !== 'idle';
  return (
    <View style={{ gap: 12 }}>
      {isCapturing ? (
        <View
          style={{
            minHeight: 210,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            backgroundColor: theme.subtle,
            borderRadius: 18,
            padding: 18,
          }}
        >
          <Label style={{ fontSize: 13, color: theme.danger }}>
            {stage === 'paused'
              ? '已暂停，可以继续说'
              : stage === 'recording'
                ? '正在聆听…'
                : stage === 'starting'
                  ? '正在准备麦克风…'
                  : stage === 'recover'
                    ? '原声暂未保存'
                    : '正在保留原声…'}
          </Label>
          {(stage === 'recording' || stage === 'paused') && (
            <RecorderMeter
              recorder={recorder}
              lastDuration={lastDuration}
              onLimit={() => latestFinish.current()}
            />
          )}
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            {(stage === 'recording' || stage === 'paused') && (
              <>
                <Button
                  testID="voice-pause"
                  kind="secondary"
                  icon={stage === 'paused' ? 'play' : 'pause'}
                  onPress={pause}
                >
                  {stage === 'paused' ? '继续' : '暂停'}
                </Button>
                <Button testID="voice-stop" icon="stop" onPress={() => void finish()}>
                  结束录音
                </Button>
              </>
            )}
            {(stage === 'starting' || stage === 'finishing') && (
              <ActivityIndicator color={theme.accent} />
            )}
            {stage === 'recover' && (
              <>
                <Button
                  kind="secondary"
                  onPress={() => {
                    captured.current = null;
                    transition('idle');
                    onBusy(false);
                    setError('');
                  }}
                >
                  放弃本段
                </Button>
                <Button onPress={() => void finish()}>重试保存原声</Button>
              </>
            )}
          </View>
          <Label muted style={{ fontSize: 11 }}>
            最长 5 分钟 · 结束后自动整理为正文
          </Label>
        </View>
      ) : voice ? (
        <>
          {voice.status === 'pending' && (
            <View style={{ minHeight: 120, justifyContent: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.accent} />
                <Label style={{ fontSize: 14 }}>正在把声音整理成文字…</Label>
              </View>
              <Label muted style={{ fontSize: 12 }}>
                可以先保存，完成后正文会自动出现。
              </Label>
            </View>
          )}
          {voice.transcript !== undefined && (
            <View style={{ gap: 9 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Label muted style={{ fontSize: 12 }}>
                  AI 转写{voice.edited ? ' · 已修改' : ''}
                </Label>
                <Button
                  kind="ghost"
                  icon={editing ? 'check' : 'pencil-outline'}
                  disabled={disabled}
                  onPress={() => setEditing(!editing)}
                >
                  {editing ? '完成' : '修改文字'}
                </Button>
              </View>
              {editing ? (
                <TextInput
                  testID="voice-transcript"
                  accessibilityLabel="修改 AI 转写"
                  multiline
                  autoFocus
                  editable={!disabled}
                  value={voice.transcript}
                  maxLength={MAX_TRANSCRIPT_LENGTH}
                  onChangeText={(value) => {
                    draft.current = { ...voice, transcript: value, edited: true };
                    setRevision((value) => value + 1);
                  }}
                  style={{
                    fontFamily: font,
                    fontSize: 16,
                    lineHeight: 26,
                    minHeight: 140,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: theme.subtle,
                    color: theme.text,
                  }}
                />
              ) : (
                <Label selectable style={{ fontSize: 16, lineHeight: 28 }}>
                  {voice.transcript}
                </Label>
              )}
            </View>
          )}
          {!!voice.error && (
            <View style={{ gap: 8 }}>
              <Label
                accessibilityRole={voice.status === 'failed' ? 'alert' : undefined}
                style={{
                  fontSize: 12,
                  lineHeight: 20,
                  color: voice.status === 'failed' ? theme.danger : theme.secondary,
                }}
              >
                {voice.error}
              </Label>
              {voice.status === 'failed' && (
                <Button
                  testID="voice-retry"
                  kind="secondary"
                  icon="reload"
                  disabled={disabled}
                  onPress={() => void startVoiceJob(voice)}
                >
                  重新转写
                </Button>
              )}
            </View>
          )}
          <VoicePlayer voice={voice} />
          {voice.originalTranscript && (
            <Disclosure title="查看识别原文">
              <Label selectable muted style={{ fontSize: 13, lineHeight: 23 }}>
                {voice.originalTranscript}
              </Label>
            </Disclosure>
          )}
          {confirm ? (
            <View style={{ gap: 8 }}>
              <Label style={{ fontSize: 12 }}>重录会在新录音完成后替换本段原声与转写。</Label>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button kind="secondary" onPress={() => setConfirm(false)}>
                  保留原录音
                </Button>
                <Button onPress={() => void start()}>开始重录</Button>
              </View>
            </View>
          ) : (
            <Button
              testID="voice-rerecord"
              kind="ghost"
              icon="microphone"
              disabled={disabled}
              onPress={() => setConfirm(true)}
            >
              重新录制
            </Button>
          )}
        </>
      ) : (
        <View
          style={{
            minHeight: 205,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            backgroundColor: theme.subtle,
            borderRadius: 18,
          }}
        >
          <Pressable
            testID="voice-start"
            accessibilityRole="button"
            accessibilityLabel="开始语音记录"
            disabled={disabled}
            onPress={() => void start()}
            style={({ pressed }) => ({
              height: 72,
              width: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.accent,
              opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <Icon name="microphone" size={32} color="#FFFFFF" />
          </Pressable>
          <Label style={{ fontSize: 15 }}>点一下，把这一刻说下来</Label>
          <Label muted style={{ fontSize: 11 }}>
            结束录音后，AI 自动整理为正文
          </Label>
        </View>
      )}
      {!!error && (
        <Label
          accessibilityRole="alert"
          style={{ fontSize: 12, color: theme.danger, lineHeight: 21 }}
        >
          {error}
        </Label>
      )}
      {permissionDenied && Platform.OS !== 'web' && (
        <Button kind="ghost" onPress={() => void Linking.openSettings()}>
          打开麦克风设置
        </Button>
      )}
    </View>
  );
});

// Meter polling is intentionally isolated from the composer, text and sheet.
function RecorderMeter({
  recorder,
  onLimit,
  lastDuration,
}: {
  recorder: AudioRecorder;
  onLimit(): void;
  lastDuration: React.RefObject<number>;
}) {
  const theme = useTheme();
  const status = useAudioRecorderState(recorder, 200);
  lastDuration.current = Math.max(lastDuration.current, status.durationMillis);
  const reached = useRef(false);
  useEffect(() => {
    if (status.durationMillis >= MAX_RECORDING_MS && !reached.current) {
      reached.current = true;
      onLimit();
    }
  }, [status.durationMillis, onLimit]);
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <Label style={{ fontSize: 28, fontVariant: ['tabular-nums'] }}>
        {formatDuration(status.durationMillis)}
      </Label>
      {status.metering !== undefined && (
        <View
          accessible={false}
          style={{ height: 24, flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          {[0.3, 0.5, 0.7, 1, 0.8, 0.5, 0.3].map((scale, index) => (
            <View
              key={index}
              style={{
                width: 4,
                borderRadius: 3,
                backgroundColor: theme.accent,
                height: Math.max(4, 24 * Math.max(0, 1 + status.metering! / 60) * scale),
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
