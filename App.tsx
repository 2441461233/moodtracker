import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import RecordScreen from './src/screens/RecordScreen';
import StatsScreen from './src/screens/StatsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#667eea',
          tabBarInactiveTintColor: '#C2C2C8',
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ focused, color }) => {
            const icons: Record<string, string> = {
              Record: focused ? '✦' : '✧',
              Stats: focused ? '◈' : '◇',
            };
            return (
              <Text style={{ fontSize: 18, color }}>
                {icons[route.name] ?? '•'}
              </Text>
            );
          },
        })}
      >
        <Tab.Screen
          name="Record"
          component={RecordScreen}
          options={{ tabBarLabel: '记录' }}
        />
        <Tab.Screen
          name="Stats"
          component={StatsScreen}
          options={{ tabBarLabel: '统计' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 0,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    height: 80,
    paddingBottom: 24,
    paddingTop: 10,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
