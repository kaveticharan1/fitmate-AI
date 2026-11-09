import { setPinSchema } from '@fitmate/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../components/AppText';
import { Banner, Button, Card, Screen, TextField, useErrorText } from '../components/ui';
import { recordConsent } from '../db/repositories';
import { useSession } from '../security/SessionProvider';
import { enableBiometricUnlock } from '../security/vault';
import { space } from '../theme/tokens';

type Form = { pin: string; confirmPin: string };

export default function SecuritySetup() {
  const { t } = useTranslation();
  const errText = useErrorText();
  const { setup, pendingConsent } = useSession();
  const [step, setStep] = useState<'pin' | 'biometric'>('pin');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    if (!pendingConsent) router.replace('/welcome');
  }, [pendingConsent]);

  useEffect(() => {
    (async () => {
      try {
        setBioAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()));
      } catch {
        setBioAvailable(false);
      }
    })();
  }, []);

  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(setPinSchema),
    defaultValues: { pin: '', confirmPin: '' },
  });

  const finish = async (useBiometric: boolean) => {
    setBusy(true);
    setFailure(null);
    try {
      await setup(pin, async (dbKey) => {
        recordConsent('age_18_plus');
        recordConsent('privacy_notice');
        if (useBiometric) {
          try {
            await enableBiometricUnlock(dbKey, t('security.biometricPrompt'));
          } catch {
            // Biometrics can be turned on later from Security settings.
          }
        }
      });
      router.replace('/onboarding');
    } catch {
      setFailure(t('errors.generic'));
      setBusy(false);
    }
  };

  const onPin = handleSubmit(({ pin: p }) => {
    setPin(p);
    if (bioAvailable) setStep('biometric');
    else finish(false);
  });

  if (busy) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppText variant="heading" center>
            {t('security.encrypting')}
          </AppText>
        </View>
      </Screen>
    );
  }

  if (step === 'biometric') {
    return (
      <Screen
        footer={
          <>
            <Button testID="bio-enable" label={t('security.biometricEnable')} onPress={() => finish(true)} />
            <Button testID="bio-skip" variant="ghost" label={t('security.notNow')} onPress={() => finish(false)} />
          </>
        }
      >
        <View style={{ gap: space.sm, paddingTop: space.xl }}>
          <AppText variant="title">{t('security.biometricTitle')}</AppText>
          <AppText tone="secondary">{t('security.biometricBody')}</AppText>
        </View>
        {failure ? <Banner tone="danger" text={failure} /> : null}
      </Screen>
    );
  }

  return (
    <Screen
      testID="security-setup"
      footer={<Button testID="pin-create" label={t('security.create')} onPress={onPin} />}
    >
      <View style={{ gap: space.sm, paddingTop: space.xl }}>
        <AppText variant="title">{t('security.title')}</AppText>
        <AppText tone="secondary">{t('security.body')}</AppText>
      </View>
      <Controller
        control={control}
        name="pin"
        render={({ field }) => (
          <TextField
            testID="pin-input"
            label={t('security.pin')}
            value={field.value}
            onChangeText={(v) => field.onChange(v.replace(/\D/g, ''))}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            autoComplete="off"
            importantForAutofill="no"
            error={errText(formState.errors.pin?.message)}
            hint={t('security.pinTip')}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPin"
        render={({ field }) => (
          <TextField
            testID="pin-confirm"
            label={t('security.confirm')}
            value={field.value}
            onChangeText={(v) => field.onChange(v.replace(/\D/g, ''))}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            autoComplete="off"
            importantForAutofill="no"
            error={errText(formState.errors.confirmPin?.message)}
          />
        )}
      />
      <Card tone="warning">
        <AppText variant="label" tone="warning">
          {t('security.noRecovery')}
        </AppText>
      </Card>
      {failure ? <Banner tone="danger" text={failure} /> : null}
    </Screen>
  );
}
