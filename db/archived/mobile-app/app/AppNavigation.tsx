// @ts-nocheck — archived mobile app, not part of active build
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import TaskDashboardScreen from './screens/TaskDashboardScreen';
import TaskDetailScreen from './screens/TaskDetailScreen';
import TimeClockScreen from './screens/TimeClockScreen';
import BarcodeScannerScreen from './screens/BarcodeScannerScreen';
import PhotoCaptureScreen from './screens/PhotoCaptureScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TaskStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="TaskDashboard"
        component={TaskDashboardScreen}
        options={{ title: 'My Tasks' }}
      />
      <Stack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: 'Task Details' }}
      />
      <Stack.Screen
        name="PhotoCapture"
        component={PhotoCaptureScreen}
        options={{ title: 'Take Photo' }}
      />
    </Stack.Navigator>
  );
}

function ScannerStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{ title: 'Scan Barcode' }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigation() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Tasks') {
              iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
            } else if (route.name === 'TimeClock') {
              iconName = focused ? 'time' : 'time-outline';
            } else if (route.name === 'Scanner') {
              iconName = focused ? 'scan' : 'scan-outline';
            } else {
              iconName = 'ellipse';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#3b82f6',
          tabBarInactiveTintColor: '#6b7280',
          headerShown: false,
        })}
      >
        <Tab.Screen name="Tasks" component={TaskStack} />
        <Tab.Screen
          name="TimeClock"
          component={TimeClockScreen}
          options={{
            title: 'Time Clock',
            headerShown: true,
          }}
        />
        <Tab.Screen name="Scanner" component={ScannerStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
