import React, { useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useMood } from '../context/MoodContext';
import { EmotionId, MoodEntry } from '../types';
import { ACTIVITIES, getActivityIds } from '../data/activities';
import { dayKey, formatTime, parseEntryTime } from '../lib/dates';
import { font, MOOD_APPEARANCE, useTheme } from '../theme';
import { Button, Icon, Label, MoodIcon } from './ui';
import { Gradient } from './effects';
import { Sheet } from './Sheet';
import { EntryDateTimeFields } from './EntryDateTimeFields';

export function EntryComposer() {
  const { composer, closeComposer, persistEntry, feedback, now } = useMood();
  const theme = useTheme();
  const entry = composer?.entry;
  const initialDate = useRef(entry ? new Date(entry.timestamp) : (composer?.date ?? now)).current;
  const initialTime = useRef(entry ? formatTime(entry.timestamp) : formatTime(now)).current;
  const [emotion, setEmotion] = useState<EmotionId | undefined>(
    entry?.emotionId ?? composer?.emotionId,
  );
  const [activities, setActivities] = useState<string[]>(entry ? getActivityIds(entry) : []);
  const [note, setNote] = useState(entry?.note ?? '');
  const [date, setDate] = useState(dayKey(initialDate));
  const [time, setTime] = useState(initialTime);
  const [step, setStep] = useState(entry ? 0 : composer?.emotionId ? 1 : 0);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const id = useRef(
    entry?.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
  );
  const requestClose = () => {
    if (lock.current) return;
    Keyboard.dismiss();
    closeComposer();
  };
  const save = async () => {
    if (!emotion || lock.current) return;
    Keyboard.dismiss();
    let parsed: Date;
    try {
      parsed = parseEntryTime(date, time);
    } catch (error) {
      setError(error instanceof Error ? error.message : '请检查记录时间。');
      setStep(2);
      return;
    }
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      const updated: MoodEntry = {
        ...entry,
        id: id.current,
        emotionId: emotion,
        activityIds: activities,
        note: note.trim() || undefined,
        timestamp:
          entry && date === dayKey(entry.timestamp) && time === formatTime(entry.timestamp)
            ? entry.timestamp
            : parsed.getTime(),
        ...(entry ? { updatedAt: Date.now() } : {}),
      };
      await persistEntry(updated, !!entry);
      closeComposer();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '暂时没有保存成功，请重试。你的输入还在这里。',
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  const headings = ['此刻，你感觉怎么样？', '这份心情和什么有关？', '想留下一点什么吗？'];
  const hints = [
    '选一个最接近的感受，不需要想太多。',
    '可能影响心情的事情，可多选或跳过。',
    '不必写得很好，真实就已经足够。',
  ];
  const inputStyle = {
    fontFamily: font,
    backgroundColor: theme.subtle,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    minHeight: 48,
    minWidth: 0,
  } as const;
  return (
    <Sheet
      preserveOnQuickRecord
      scrollKey={step}
      scrollRef={scroll}
      dismissDisabled={saving}
      contentDisabled={saving}
      title={entry ? '编辑这一刻' : '记录这一刻'}
      onClose={requestClose}
      footer={
        <View style={{ gap: 12 }}>
          {!!error && (
            <Label
              accessibilityRole="alert"
              style={{ color: theme.danger, fontSize: 12, lineHeight: 20 }}
            >
              {error}
            </Label>
          )}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {step > 0 && (
              <Button
                onPress={() => setStep(step - 1)}
                kind="secondary"
                icon="arrow-left"
                disabled={saving}
              >
                上一步
              </Button>
            )}
            <Button
              onPress={step === 2 ? save : () => setStep(step + 1)}
              disabled={!emotion}
              busy={saving}
              icon={step === 2 ? 'check' : 'arrow-right'}
              style={{ flex: 1 }}
            >
              {saving ? '正在保存…' : step === 2 ? (entry ? '保存修改' : '保存这一刻') : '继续'}
            </Button>
          </View>
          {step < 2 && emotion && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="跳过选填，直接保存"
              disabled={saving}
              onPress={save}
              style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Label muted style={{ fontSize: 12 }}>
                跳过选填，直接记录
              </Label>
            </Pressable>
          )}
        </View>
      }
    >
      <View style={{ flexDirection: 'row', gap: 7, marginBottom: 24, alignSelf: 'center' }}>
        {[0, 1, 2].map((item) =>
          step === item ? (
            <Gradient
              key={item}
              colors={[theme.accentFrom, theme.accentTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              borderRadius={4}
              style={{ height: 5, width: 27 }}
            />
          ) : (
            <View
              key={item}
              style={{ height: 5, width: 8, borderRadius: 4, backgroundColor: theme.border }}
            />
          ),
        )}
      </View>
      <Label
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        style={{ fontSize: 25, fontWeight: '600', lineHeight: 36, textAlign: 'center' }}
      >
        {headings[step]}
      </Label>
      <Label muted style={{ fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 27 }}>
        {hints[step]}
      </Label>
      {step === 0 && (
        <View style={{ gap: 11 }}>
          {(Object.keys(MOOD_APPEARANCE) as EmotionId[]).map((key) => {
            const mood = MOOD_APPEARANCE[key];
            const active = key === emotion;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={mood.label}
                accessibilityState={{ checked: active }}
                disabled={saving}
                onPress={() => {
                  setEmotion(key);
                  feedback();
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 13,
                  borderRadius: 18,
                  gap: 15,
                  borderWidth: 1.5,
                  borderColor: active ? mood.color : theme.cardBorder,
                  backgroundColor: active ? (theme.dark ? mood.dark : mood.soft) : theme.surface,
                  boxShadow: active ? `0 6px 24px ${mood.glow}` : undefined,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <MoodIcon id={key} size={45} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Label style={{ fontWeight: '600', fontSize: 16, color: theme.text }}>
                    {mood.label}
                  </Label>
                  <Label muted style={{ fontSize: 11 }}>
                    {mood.hint}
                  </Label>
                </View>
                {active && <Icon name="check-circle" size={23} color={mood.color} />}
              </Pressable>
            );
          })}
        </View>
      )}
      {step === 1 && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {ACTIVITIES.slice(0, showAll ? 24 : 12).map((activity) => {
              const active = activities.includes(activity.id);
              return (
                <Pressable
                  key={activity.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={activity.label}
                  accessibilityState={{ checked: active }}
                  disabled={saving}
                  onPress={() => {
                    setActivities((prev) =>
                      active ? prev.filter((item) => item !== activity.id) : [...prev, activity.id],
                    );
                    feedback();
                  }}
                  style={({ pressed }) => ({
                    width: '30.5%',
                    flexGrow: 1,
                    maxWidth: '33.33%',
                    minHeight: 86,
                    gap: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 15,
                    backgroundColor: active ? theme.accentSoft : theme.subtle,
                    borderWidth: 1.5,
                    borderColor: active ? theme.accent : 'transparent',
                    opacity: pressed ? 0.65 : 1,
                  })}
                >
                  <Icon
                    name={activity.icon}
                    color={active ? theme.accentText : activity.color}
                    size={25}
                  />
                  <Label
                    style={{ fontSize: 12, color: active ? theme.accentText : theme.secondary }}
                  >
                    {activity.label}
                  </Label>
                </Pressable>
              );
            })}
          </View>
          <Button
            disabled={saving}
            onPress={() => setShowAll(!showAll)}
            kind="ghost"
            icon={showAll ? 'chevron-up' : 'chevron-down'}
            style={{ marginTop: 13 }}
          >
            {showAll ? '收起选项' : '更多选项'}
          </Button>
          <Label muted style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>
            已选 {activities.length} 项 · 不必为每一种情绪找到原因
          </Label>
        </>
      )}
      {step === 2 && (
        <View style={{ gap: 17 }}>
          {emotion && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 }}>
              <MoodIcon id={emotion} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Label style={{ fontSize: 14, fontWeight: '600' }}>
                  {MOOD_APPEARANCE[emotion].label}
                </Label>
                <Label muted style={{ fontSize: 11 }}>
                  {activities.length
                    ? ACTIVITIES.filter((item) => activities.includes(item.id))
                        .map((item) => item.label)
                        .join(' · ')
                    : '属于你自己的一个瞬间'}
                </Label>
              </View>
            </View>
          )}
          <View>
            <TextInput
              accessibilityLabel="心情笔记"
              placeholder="愿意告诉我，刚刚发生了什么吗？"
              placeholderTextColor={theme.muted}
              multiline
              editable={!saving}
              keyboardAppearance={theme.dark ? 'dark' : 'light'}
              textAlignVertical="top"
              maxLength={Math.max(1000, entry?.note?.length ?? 0)}
              value={note}
              onChangeText={setNote}
              style={[inputStyle, { minHeight: 145, lineHeight: 24 }]}
            />
            <Label muted style={{ fontSize: 10, marginTop: 6, textAlign: 'right' }}>
              {note.length} / {Math.max(1000, entry?.note?.length ?? 0)} · 选填
            </Label>
          </View>
          <View style={{ gap: 8 }}>
            <Label muted style={{ fontSize: 12 }}>
              这个瞬间发生在
            </Label>
            <EntryDateTimeFields
              date={date}
              time={time}
              disabled={saving}
              onChange={(next) => {
                setDate(next.date);
                setTime(next.time);
                setError('');
              }}
              onExpand={() => scroll.current?.scrollToEnd({ animated: false })}
            />
            <Label muted style={{ fontSize: 11 }}>
              可选择当前或之前的时间
            </Label>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name="lock-outline" size={13} color={theme.muted} />
            <Label muted style={{ fontSize: 11, flex: 1 }}>
              仅保存在本设备，不会发送给 AI 或其他人。
            </Label>
          </View>
        </View>
      )}
    </Sheet>
  );
}
