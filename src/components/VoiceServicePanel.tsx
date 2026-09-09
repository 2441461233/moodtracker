import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Switch, TextInput, View } from 'react-native';
import { font, useTheme } from '../theme';
import { readVoiceConfig, saveVoiceConfig } from '../voice/config';
import { Button, Card, Disclosure, Label, SectionTitle } from './ui';

export function VoiceServicePanel() {
  const theme = useTheme();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void readVoiceConfig()
      .then((value) => {
        if (!active) return;
        setUrl(value.url);
        setToken(value.token);
        setEnabled(value.enabled);
      })
      .catch(() => {
        if (active) setError('暂时无法读取转写设置，请重新打开此页。');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const save = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    Keyboard.dismiss();
    try {
      await saveVoiceConfig({ url, token, enabled });
      setMessage(
        enabled
          ? '已启用：之后结束录音会自动转写。已有失败录音可点「重新转写」。'
          : '已关闭自动转写，仍可录音和回放。',
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : '转写设置未保存，请重试。');
    } finally {
      setBusy(false);
    }
  };
  const inputStyle = {
    fontFamily: font,
    fontSize: 15,
    minHeight: 46,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.subtle,
    color: theme.text,
  };
  return (
    <Card>
      <SectionTitle title="语音与 AI 转写" subtitle="说下来，再慢慢看见自己的感受" />
      <View style={{ gap: 14 }}>
        <Label muted style={{ fontSize: 12, lineHeight: 22 }}>
          原声保存在本设备。启用后，每次结束录音，会经你配置的服务发送至硅基流动：SenseVoice
          识别语音，DeepSeek 整理标点和语句。正文默认展示，你可以修改。
        </Label>
        <Disclosure title="连接转写服务">
          <View style={{ gap: 10 }}>
            <Label style={{ fontSize: 12 }}>服务地址</Label>
            <TextInput
              accessibilityLabel="转写服务地址"
              value={url}
              onChangeText={setUrl}
              editable={!busy}
              placeholder="https://voice.example.com"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={inputStyle}
            />
            <Label style={{ fontSize: 12 }}>服务访问口令</Label>
            <TextInput
              accessibilityLabel="转写服务访问口令"
              value={token}
              onChangeText={setToken}
              editable={!busy}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={256}
              placeholder="由服务端提供"
              placeholderTextColor={theme.muted}
              style={inputStyle}
            />
            <Label muted style={{ fontSize: 11, lineHeight: 20 }}>
              这里填写转写服务的访问口令。硅基流动 API Key 只配置在服务端。
              {Platform.OS === 'web'
                ? '网页版仅在当前标签页会话保留连接配置。'
                : '访问口令保存在本设备的安全存储中。'}
            </Label>
          </View>
        </Disclosure>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Label style={{ fontSize: 13 }}>结束录音后自动转写</Label>
            <Label muted style={{ fontSize: 11, lineHeight: 19 }}>
              开启即同意将本段语音和识别文字交给上述服务处理。
            </Label>
          </View>
          <Switch
            accessibilityLabel="自动转写"
            value={enabled}
            disabled={busy}
            onValueChange={setEnabled}
          />
        </View>
        <Button kind="secondary" busy={busy} onPress={() => void save()}>
          保存转写设置
        </Button>
        {!!message && (
          <Label accessibilityLiveRegion="polite" style={{ fontSize: 12, lineHeight: 21 }}>
            {message}
          </Label>
        )}
        {!!error && (
          <Label
            accessibilityRole="alert"
            style={{ fontSize: 12, lineHeight: 21, color: theme.danger }}
          >
            {error}
          </Label>
        )}
      </View>
    </Card>
  );
}
