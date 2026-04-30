import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
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
          <Stack.Screen name="chat" options={{ title: 'Chat' }} />
        </Stack>
        <StatusBar style="light" />
      </>
    </AuthProvider>
  );
}
