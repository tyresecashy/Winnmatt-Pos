import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import CustomerDashboardScreen from './screens/CustomerDashboardScreen';
import OrderHistoryScreen from './screens/OrderHistoryScreen';
import LoyaltyRewardsScreen from './screens/LoyaltyRewardsScreen';
import StoreLocatorScreen from './screens/StoreLocatorScreen';
import MobileOrderingScreen from './screens/MobileOrderingScreen';
import DigitalReceiptsScreen from './screens/DigitalReceiptsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CustomerDashboard"
        component={CustomerDashboardScreen}
        options={{ title: 'WinnMatt' }}
      />
      <Stack.Screen
        name="OrderHistory"
        component={OrderHistoryScreen}
        options={{ title: 'Order History' }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderHistoryScreen}
        options={{ title: 'Order Details' }}
      />
    </Stack.Navigator>
  );
}

function OrderStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MobileOrdering"
        component={MobileOrderingScreen}
        options={{ title: 'Place Order' }}
      />
    </Stack.Navigator>
  );
}

function LoyaltyStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="LoyaltyRewards"
        component={LoyaltyRewardsScreen}
        options={{ title: 'Loyalty & Rewards' }}
      />
      <Stack.Screen
        name="RedeemReward"
        component={LoyaltyRewardsScreen}
        options={{ title: 'Redeem Reward' }}
      />
    </Stack.Navigator>
  );
}

function StoreStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="StoreLocator"
        component={StoreLocatorScreen}
        options={{ title: 'Find a Store' }}
      />
    </Stack.Navigator>
  );
}

function ReceiptsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DigitalReceipts"
        component={DigitalReceiptsScreen}
        options={{ title: 'My Receipts' }}
      />
    </Stack.Navigator>
  );
}

export default function CustomerAppNavigation() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Order') {
              iconName = focused ? 'cart' : 'cart-outline';
            } else if (route.name === 'Loyalty') {
              iconName = focused ? 'gift' : 'gift-outline';
            } else if (route.name === 'Stores') {
              iconName = focused ? 'location' : 'location-outline';
            } else if (route.name === 'Receipts') {
              iconName = focused ? 'receipt' : 'receipt-outline';
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
        <Tab.Screen name="Home" component={HomeStack} />
        <Tab.Screen name="Order" component={OrderStack} />
        <Tab.Screen name="Loyalty" component={LoyaltyStack} />
        <Tab.Screen name="Stores" component={StoreStack} />
        <Tab.Screen name="Receipts" component={ReceiptsStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
