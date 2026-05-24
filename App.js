import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';

// Screens
import AuthScreen from './src/screens/AuthScreen';
import MapScreen from './src/screens/MapScreen';
import ReportScreen from './src/screens/ReportScreen';
import ReportListScreen from './src/screens/ReportListScreen';
import TouristScreen from './src/screens/TouristScreen';
import WorkshopScreen from './src/screens/WorkshopScreen';
import NoticeBoardScreen from './src/screens/NoticeBoardScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }) {
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.6 }}>
      {emoji}
    </Text>
  );
}

function MapStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MapMain" component={MapScreen} />
      <Stack.Screen name="Report" component={ReportScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

function MainTabs() { 
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: 8,
          paddingTop: 6,
          height: 64,
        },
        tabBarActiveTintColor: '#0c3563',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tab.Screen
        name="Mapa"
        component={MapStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" focused={focused} />,
          tabBarLabel: 'Mapa',
        }}
      />
      <Tab.Screen
        name="Reportes"
        component={ReportListScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
          tabBarLabel: 'Reportes',
        }}
      />
      <Tab.Screen
        name="Turismo"
        component={TouristScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏔️" focused={focused} />,
          tabBarLabel: 'Turismo',
        }}
      />
      <Tab.Screen
        name="Talleres"
        component={WorkshopScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔧" focused={focused} />,
          tabBarLabel: 'Talleres',
        }}
      />
      <Tab.Screen
        name="Avisos"
        component={NoticeBoardScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📢" focused={focused} />,
          tabBarLabel: 'Avisos',
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { session } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session && session.user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
