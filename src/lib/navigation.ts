import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<{
  today: undefined;
  calendar: { date: string; source?: 'local'; widgetRequest?: number } | undefined;
  insights: undefined;
  settings: undefined;
}>();
