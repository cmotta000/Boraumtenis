import { Stack } from 'expo-router';

import { AuthProvider } from '@/lib/auth';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.chalk },
        }}
      />
    </AuthProvider>
  );
}
