import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { VoiceRecording } from '../types';
import { useTheme } from '../theme';
import { Button, Label } from './ui';
import { playbackSource, shareRecording } from '../voice/files';
import { formatDuration } from '../voice/core';

export function VoicePlayer({ voice }: { voice: VoiceRecording }) {
  const theme = useTheme();
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState('');
  const [source, setSource] = useState<string>();
  useEffect(() => {
    let active = true;
    let release: undefined | (() => void);
    setSource(undefined);
    setError('');
    if (voice.fileName)
      void playbackSource(voice)
        .then((next) => {
          release = next.release;
          if (active) {
            player.replace(next.uri);
            setSource(next.uri);
          } else next.release();
        })
        .catch(() => {
          if (active) setError('本机没有这段原声，文字仍然保留。');
        });
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') player.pause();
    });
    return () => {
      active = false;
      player.pause();
      release?.();
      subscription.remove();
    };
  }, [voice.id, voice.fileName, player]);
  const play = async () => {
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      if (
        status.didJustFinish ||
        (status.duration > 0 && status.currentTime >= status.duration - 0.05)
      )
        await player.seekTo(0);
      player.play();
    } catch {
      setError('暂时无法回听，请稍后重试。');
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
          disabled={!source}
          icon={status.playing ? 'pause' : 'play'}
          onPress={() => void play()}
        >
          {status.playing ? '暂停' : '回听原声'}
        </Button>
        <Label muted style={{ fontSize: 12, fontVariant: ['tabular-nums'], flex: 1 }}>
          {formatDuration(status.playing ? status.currentTime * 1000 : voice.durationMs)}
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
