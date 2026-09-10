import { setAudioModeAsync } from 'expo-audio';

// Expo's iOS mode fields default when omitted; pass the complete foreground
// mode and serialize transitions across recorder and player lifecycles.
let pending = Promise.resolve();
function configure(allowsRecording: boolean): Promise<void> {
  const next = pending.then(() =>
    setAudioModeAsync({
      allowsRecording,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      allowsBackgroundRecording: false,
      interruptionMode: 'doNotMix',
    }),
  );
  pending = next.catch(() => undefined);
  return next;
}

export const setRecordingAudioMode = () => configure(true);
export const setPlaybackAudioMode = () => configure(false);
