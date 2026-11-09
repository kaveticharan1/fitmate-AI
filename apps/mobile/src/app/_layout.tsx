import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppText, TELUGU_FONT, TELUGU_FONT_BOLD } from '../components/AppText';
import { Button, Screen } from '../components/ui';
import { loadSavedLanguage } from '../i18n';
import { LockScreen } from '../security/LockScreen';
import { SessionProvider, useSession } from '../security/SessionProvider';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 5 * 60_000 } },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    [TELUGU_FONT]: require('../../assets/fonts/NotoSansTelugu_400Regular.ttf'),
    [TELUGU_FONT_BOLD]: require('../../assets/fonts/NotoSansTelugu_600SemiBold.ttf'),
  });
  const [langLoaded, setLangLoaded] = useState(false);
  useEffect(() => {
    loadSavedLanguage().finally(() => setLangLoaded(true));
  }, []);

  if (!fontsLoaded || !langLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SessionProvider>
            <Root />
          </SessionProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { colors, isDark } = useTheme();
  const { status, hasProfile } = useSession();

  let body: React.ReactNode;
  if (status === 'loading') body = <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  else if (status === 'error') body = <FatalError />;
  else if (status === 'wiped') body = <WipedNotice />;
  else if (status === 'locked') body = <LockScreen />;
  else {
    const unlocked = status === 'unlocked';
    body = (
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      >
        <Stack.Protected guard={status === 'needs-setup'}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="security-setup" />
        </Stack.Protected>
        <Stack.Protected guard={unlocked && !hasProfile}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={unlocked && hasProfile}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="settings/security" />
          <Stack.Screen name="settings/backup" />
          <Stack.Screen name="settings/privacy" />
          <Stack.Screen name="settings/appearance" />
          <Stack.Screen name="settings/reminders" />
          <Stack.Screen name="food/add" />
          <Stack.Screen name="food/item" />
          <Stack.Screen name="food/recipes" />
          <Stack.Screen name="food/recipe-edit" />
          <Stack.Screen name="food/grocery" />
        </Stack.Protected>
      </Stack>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {body}
    </>
  );
}

function FatalError() {
  const { t } = useTranslation();
  const { errorKind } = useSession();
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
        <AppText variant="title">FitMate</AppText>
        <AppText tone="danger">{errorKind === 'encryption' ? t('errors.encryption') : t('errors.generic')}</AppText>
      </View>
    </Screen>
  );
}

function WipedNotice() {
  const { t } = useTranslation();
  const { acknowledgeWipe } = useSession();
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
        <AppText variant="title">{t('lock.wipedTitle')}</AppText>
        <AppText tone="secondary">{t('lock.wipedBody')}</AppText>
        <Button label={t('common.continue')} onPress={acknowledgeWipe} />
      </View>
    </Screen>
  );
}
