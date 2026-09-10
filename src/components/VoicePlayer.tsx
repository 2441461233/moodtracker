import React, { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';
import type { VoiceRecording } from '../types';
import { useTheme } from '../theme';
import { Button, Label } from './ui';
import { playbackSource, shareRecording } from '../voice/files';
import { formatDuration } from '../voice/core';
import { setPlaybackAudioMode } from '../voice/audio-session';

export function VoicePlayer({ voice }: { voice: VoiceRecording }) {
  const theme = useTheme();
  const player = useRef<AudioPlayer | null>(null);
  const [status, setStatus] = useState<AudioStatus>();
  const [error, setError] = useState('');
  const [source, setSource] = useState<string>();
  useEffect(() => {
    let active = true;
    let release: undefined | (() => void);
    let ownedPlayer: AudioPlayer | undefined;
    let statusSubscription: { remove(): void } | undefined;
    setSource(undefined);
    setStatus(undefined);
    setError('');
    if (voice.fileName)
      void playbackSource(voice)
        .then((next) => {
          release = next.release;
          if (active) {
            setSource(next.uri);
            // Create only after the retained file is available. Constructor
            // errors are recoverable here instead of escaping React render.
            ownedPlayer = createAudioPlayer(next.uri, { updateInterval: 500 });
            player.current = ownedPlayer;
            setStatus(ownedPlayer.currentStatus);
            statusSubscription = ownedPlayer.addListener('playbackStatusUpdate', (value) => {
              if (active) setStatus(value);
            });
          } else next.release();
        })
        .catch(() => {
          if (active) setError('暂时无法加载原声，录音记录仍然保留。');
        });
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && player.current) {
        try {
          player.current.pause();
        } catch {
          if (active) setError('回听已停止，请重新打开这条记录。');
        }
      }
    });
    return () => {
      active = false;
      player.current = null;
      statusSubscription?.remove();
      // This effect owns disposal. useAudioPlayer would release the native
      // object before a later effect cleanup could call pause() on it.
      if (ownedPlayer) {
        try {
          ownedPlayer.pause();
        } catch {
          // Still release a player whose audio session has already stopped.
        } finally {
          ownedPlayer.release();
        }
      }
      release?.();
      subscription.remove();
    };
  }, [voice.id, voice.fileName]);
  const play = async () => {
    const current = player.current;
    if (!current) return;
    try {
      if (current.playing) {
        current.pause();
        return;
      }
      await setPlaybackAudioMode();
      if (player.current !== current) return;
      if (
        status?.didJustFinish ||
        (current.duration > 0 && current.currentTime >= current.duration - 0.05)
      )
        await current.seekTo(0);
      if (player.current !== current) return;
      current.play();
    } catch {
      if (player.current === current) setError('暂时无法回听，请稍后重试。');
    }
  };
  return (
    <View style={{ gap: 5 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingTop: 7,
        }}
      >
        <Button
          testID="voice-play"
          kind="ghost"
          disabled={!source || !status}
          icon={status?.playing ? 'pause' : 'play'}
          onPress={() => void play()}
        >
          {status?.playing ? '暂停' : '回听原声'}
        </Button>
        <Label muted style={{ fontSize: 12, fontVariant: ['tabular-nums'], flex: 1 }}>
          {formatDuration(status?.playing ? status.currentTime * 1000 : voice.durationMs)}
        </Label>
        <Button
          kind="ghost"
          disabled={!source}
          icon="export-variant"
          onPress={() =>
            void shareRecording(voice).catch(() => setError('导出原声未完成，请重试。'))
          }
        >
          导出
        </Button>
      </View>
      {!voice.fileName && (
        <Label muted style={{ fontSize: 11 }}>
          文字备份不包含原声
        </Label>
      )}
      {!!error && (
        <Label accessibilityRole="alert" style={{ fontSize: 11, color: theme.secondary }}>
          {error}
        </Label>
      )}
    </View>
  );
}
