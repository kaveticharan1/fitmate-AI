import { consentSchema } from '@fitmate/validation';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../components/AppText';
import { Button, Card, CheckRow, ChoiceGroup, Screen } from '../components/ui';
import { setAppLanguage, type AppLanguage } from '../i18n';
import { useSession } from '../security/SessionProvider';
import { space } from '../theme/tokens';

export default function Welcome() {
  const { t, i18n } = useTranslation();
  const { setPendingConsent } = useSession();
  const [isAdult, setIsAdult] = useState(false);
  const [accepts, setAccepts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    const r = consentSchema.safeParse({ isAdult, acceptsPrivacyNotice: accepts });
    if (!r.success) {
      setError(t('errors.consent'));
      return;
    }
    setPendingConsent(true);
    router.push('/security-setup');
  };

  return (
    <Screen
      testID="welcome"
      footer={
        <>
          {error ? (
            <AppText tone="danger" variant="label" accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}
          <Button testID="welcome-start" label={t('welcome.start')} onPress={start} />
        </>
      }
    >
      <View style={{ gap: space.xs, paddingTop: space.xl }}>
        <AppText variant="display">FitMate AI</AppText>
        <AppText tone="secondary">{t('welcome.tagline')}</AppText>
      </View>

      <ChoiceGroup<AppLanguage>
        label={t('welcome.language')}
        value={i18n.language as AppLanguage}
        onChange={(l) => setAppLanguage(l)}
        options={[
          { value: 'en', label: t('options.language.en') },
          { value: 'te', label: t('options.language.te') },
        ]}
        testID="language"
      />

      <Card>
        <AppText variant="heading">{t('welcome.privacyTitle')}</AppText>
        {(['privacy1', 'privacy2', 'privacy3', 'privacy4'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', gap: space.sm }}>
            <AppText tone="accent">•</AppText>
            <AppText tone="secondary" style={{ flex: 1 }}>
              {t(`welcome.${k}`)}
            </AppText>
          </View>
        ))}
      </Card>

      <View>
        <CheckRow
          testID="consent-age"
          label={t('welcome.ageCheck')}
          value={isAdult}
          onChange={(v) => {
            setIsAdult(v);
            setError(null);
          }}
        />
        <CheckRow
          testID="consent-notice"
          label={t('welcome.accept')}
          value={accepts}
          onChange={(v) => {
            setAccepts(v);
            setError(null);
          }}
        />
      </View>
    </Screen>
  );
}
