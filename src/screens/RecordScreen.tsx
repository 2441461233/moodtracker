import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { EMOTIONS } from '../data/emotions';
import { saveEntry } from '../storage';
import { Emotion, EmotionId, MoodEntry } from '../types';

const { width } = Dimensions.get('window');

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function formatDate(date: Date): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${month}月${day}日 · ${dayOfWeek}`;
}

export default function RecordScreen() {
  const [selected, setSelected] = useState<EmotionId | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const noteRef = useRef<TextInput>(null);
  const scaleAnims = useRef(EMOTIONS.map(() => new Animated.Value(1))).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const handleSelect = (emotion: Emotion, idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelected(emotion.id);
    setSaved(false);

    Animated.sequence([
      Animated.timing(scaleAnims[idx], {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnims[idx], {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSave = async () => {
    if (!selected) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const entry: MoodEntry = {
      id: Date.now().toString(),
      emotionId: selected,
      note: note.trim() || undefined,
      timestamp: Date.now(),
    };

    await saveEntry(entry);
    setSelected(null);
    setNote('');
    setSaved(true);

    Animated.sequence([
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(1800),
      Animated.timing(successAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const selectedEmotion = EMOTIONS.find((e) => e.id === selected);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()} 👋</Text>
          <Text style={styles.dateText}>{formatDate(new Date())}</Text>
          <Text style={styles.question}>现在感觉怎么样？</Text>
        </View>

        {/* Emotion Buttons */}
        <View style={styles.emotionsContainer}>
          {EMOTIONS.map((emotion, idx) => {
            const isSelected = selected === emotion.id;
            return (
              <Animated.View
                key={emotion.id}
                style={[
                  styles.emotionWrapper,
                  { transform: [{ scale: scaleAnims[idx] }] },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleSelect(emotion, idx)}
                  style={styles.emotionTouchable}
                >
                  <LinearGradient
                    colors={
                      isSelected
                        ? emotion.gradientColors
                        : ['#F5F5F7', '#EBEBF0']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.emotionCard,
                      isSelected && styles.emotionCardSelected,
                    ]}
                  >
                    <Text style={styles.emotionEmoji}>{emotion.emoji}</Text>
                    <Text
                      style={[
                        styles.emotionLabel,
                        isSelected && styles.emotionLabelSelected,
                      ]}
                    >
                      {emotion.label}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkDot} />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Note Input */}
        {selected && (
          <Animated.View style={styles.noteSection}>
            <Text style={styles.noteLabel}>加点备注？（选填）</Text>
            <TextInput
              ref={noteRef}
              style={styles.noteInput}
              placeholder="是什么让你有这种感觉…"
              placeholderTextColor="#C2C2C8"
              value={note}
              onChangeText={setNote}
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            <Text style={styles.charCount}>{note.length}/80</Text>
          </Animated.View>
        )}

        {/* Save Button */}
        {selected && (
          <TouchableOpacity
            style={styles.saveButtonWrapper}
            activeOpacity={0.85}
            onPress={handleSave}
          >
            <LinearGradient
              colors={
                selectedEmotion
                  ? selectedEmotion.gradientColors
                  : ['#667eea', '#764ba2']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>记录这一刻 ✓</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Success Toast */}
        <Animated.View
          style={[
            styles.successToast,
            {
              opacity: successAnim,
              transform: [
                {
                  translateY: successAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.successText}>✨ 已记录！</Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 36,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 15,
    color: '#9A9AA8',
    marginTop: 4,
    fontWeight: '400',
  },
  question: {
    fontSize: 17,
    color: '#3A3A52',
    marginTop: 16,
    fontWeight: '500',
  },
  emotionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 8,
  },
  emotionWrapper: {
    width: (width - 48 - 24) / 3,
    margin: 6,
  },
  emotionTouchable: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  emotionCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
    borderRadius: 20,
    minHeight: 96,
  },
  emotionCardSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  emotionEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emotionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B7B',
    textAlign: 'center',
  },
  emotionLabelSelected: {
    color: '#fff',
  },
  checkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
    marginTop: 6,
  },
  noteSection: {
    marginTop: 24,
    marginBottom: 4,
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B7B',
    marginBottom: 10,
  },
  noteInput: {
    backgroundColor: '#F0F0F5',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1A1A2E',
    lineHeight: 22,
  },
  charCount: {
    fontSize: 12,
    color: '#C2C2C8',
    textAlign: 'right',
    marginTop: 6,
  },
  saveButtonWrapper: {
    marginTop: 24,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  saveButton: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 18,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  successToast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 60,
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
  },
  successText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
