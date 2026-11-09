import { pinField, setPinSchema } from '@fitmate/validation';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, ChoiceGroup, Screen, TextField, ToggleRow, useErrorText } from '../../components/ui';
import { useSession } from '../../security/SessionProvider';
import { changePin, disableBiometricUnlock, enableBiometricUnlock, unlockWithPin } from '../../security/vault';
import { space } from '../../theme/tokens';

export default function SecuritySettings() {
  const { t } = useTranslation();
  const { prefs, updatePrefs } = useSession();
  const [bioAvailable, setBioAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setBioAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()));
      } catch {
        setBioAvailable(false);
      }
    })();
  }, []);

  return (
    <Screen testID="settings-security">
      <Header title={t('profile.security')} />

      <Card>
        <BiometricSetting available={bioAvailable} />
      </Card>

      <Card>
        <ChoiceGroup<'0' | '60' | '300'>
          testID="auto-lock"
          label={t('settingsSecurity.autoLock')}
          value={String(prefs.autoLockSeconds) as '0' | '60' | '300'}
          onChange={(v) => updatePrefs({ autoLockSeconds: Number(v) })}
          options={[
            { value: '0', label: t('settingsSecurity.autoLock0') },
            { value: '60', label: t('settingsSecurity.autoLock60') },
            { value: '300', label: t('settingsSecurity.autoLock300') },
          ]}
        />
      </Card>

      <Card>
        <ToggleRow
          testID="toggle-screenshots"
          label={t('settingsSecurity.screenshots')}
          description={t('settingsSecurity.screenshotsBody')}
          value={prefs.blockScreenshots}
          onChange={(v) => updatePrefs({ blockScreenshots: v })}
        />
        <ToggleRow
          testID="toggle-autowipe"
          label={t('settingsSecurity.autoWipe')}
          description={t('settingsSecurity.autoWipeBody')}
          value={prefs.autoWipe}
          onChange={(v) => {
            if (!v) {
              updatePrefs({ autoWipe: false });
              return;
            }
            Alert.alert(t('settingsSecurity.autoWipe'), t('settingsSecurity.autoWipeBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.on'), style: 'destructive', onPress: () => updatePrefs({ autoWipe: true }) },
            ]);
          }}
        />
      </Card>

      <ChangePinCard />
    </Screen>
  );
}

function BiometricSetting({ available }: { available: boolean | null }) {
  const { t } = useTranslation();
  const errText = useErrorText();
  const { prefs, updatePrefs } = useSession();
  const [askPin, setAskPin] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const turnOn = async () => {
    const parsed = pinField.safeParse(pin);
    if (!parsed.success && pin.length < 4) {
      setError(errText(parsed.error.issues[0]?.message));
      return;
    }
    setBusy(true);
    try {
      const r = await unlockWithPin(pin);
      if (!r.ok) {
        setError(t('settingsSecurity.wrongCurrent'));
        return;
      }
      await enableBiometricUnlock(r.dbKey, t('security.biometricPrompt'));
      await updatePrefs({ biometricEnabled: true });
      setAskPin(false);
      setPin('');
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <ToggleRow
        testID="toggle-biometric"
        label={t('settingsSecurity.biometric')}
        description={available === false ? t('settingsSecurity.biometricUnavailable') : undefined}
        value={prefs.biometricEnabled}
        disabled={!available && !prefs.biometricEnabled}
        onChange={async (v) => {
          if (v) setAskPin(true);
          else {
            await disableBiometricUnlock().catch(() => {});
            await updatePrefs({ biometricEnabled: false });
          }
        }}
      />
      {askPin ? (
        <>
          <TextField
            label={t('settingsSecurity.confirmWithPin')}
            value={pin}
            onChangeText={(v) => {
              setPin(v.replace(/\D/g, ''));
              setError(undefined);
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            error={error}
          />
          <Button label={t('common.on')} onPress={turnOn} loading={busy} />
        </>
      ) : null}
    </View>
  );
}

function ChangePinCard() {
  const { t } = useTranslation();
  const errText = useErrorText();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; pin?: string; confirmPin?: string }>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setDone(false);
    const r = setPinSchema.safeParse({ pin: next, confirmPin: confirm });
    const errs: typeof errors = {};
    if (current.length < 4) errs.current = t('errors.pinFormat');
    if (!r.success) {
      for (const issue of r.error.issues) {
        const k = issue.path[0] as 'pin' | 'confirmPin';
        errs[k] ??= errText(issue.message);
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const ok = await changePin(current, next);
      if (!ok) {
        setErrors({ current: t('settingsSecurity.wrongCurrent') });
        return;
      }
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch {
      setErrors({ current: t('errors.generic') });
    } finally {
      setBusy(false);
    }
  };

  const digits = (set: (v: string) => void) => (v: string) => {
    set(v.replace(/\D/g, ''));
    setErrors({});
  };

  return (
    <Card>
      <AppText variant="heading">{t('settingsSecurity.changePin')}</AppText>
      <TextField label={t('settingsSecurity.currentPin')} value={current} onChangeText={digits(setCurrent)} keyboardType="number-pad" secureTextEntry maxLength={8} error={errors.current} />
      <TextField label={t('security.pin')} value={next} onChangeText={digits(setNext)} keyboardType="number-pad" secureTextEntry maxLength={8} error={errors.pin} />
      <TextField label={t('security.confirm')} value={confirm} onChangeText={digits(setConfirm)} keyboardType="number-pad" secureTextEntry maxLength={8} error={errors.confirmPin} />
      {done ? <Banner tone="accent" text={t('settingsSecurity.pinChanged')} /> : null}
      <Button testID="change-pin" variant="secondary" label={t('settingsSecurity.changePin')} onPress={submit} loading={busy} />
    </Card>
  );
}
