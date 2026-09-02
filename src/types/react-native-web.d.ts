import 'react-native';

declare module 'react-native' {
  interface PressableStateCallbackType {
    /** React Native Web supplies hover/focus; native platforms leave them unset. */
    readonly hovered?: boolean;
    readonly focused?: boolean;
  }
}
