import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/auth-context';
import { LocalDataProvider } from '../context/local-data-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LocalDataProvider>
          <>
            <StatusBar translucent={false} />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: '#101828' },
                headerTintColor: '#ffffff',
                contentStyle: { backgroundColor: '#f8fafc' },
                statusBarStyle: 'light',
                statusBarTranslucent: false,
                statusBarBackgroundColor: '#101828',
              }}
            >
              <Stack.Screen name="index" options={{ title: 'Personal Assistant' }} />
              <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
              <Stack.Screen name="paywall" options={{ title: 'Upgrade' }} />
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: false,
                  statusBarStyle: 'dark',
                  statusBarBackgroundColor: '#ffffff',
                }}
              />
              <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
              <Stack.Screen name="task/new" options={{ title: 'New task' }} />
            </Stack>
          </>
        </LocalDataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
