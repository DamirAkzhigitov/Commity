import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/auth-context';
import { LocalDataProvider } from '../context/local-data-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <LocalDataProvider>
        <>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#101828' },
              headerTintColor: '#ffffff',
              contentStyle: { backgroundColor: '#f8fafc' },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Personal Assistant' }} />
            <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="light" />
        </>
      </LocalDataProvider>
    </AuthProvider>
  );
}
