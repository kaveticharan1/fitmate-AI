import type { TFunction } from 'i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../components/AppText';
import { PinPad } from '../components/PinPad';
import { Button, Screen } from '../components/ui';
import { space } from '../theme/tokens';
import { useSession } from './SessionProvider';

export function formatWait(ms: number, t: TFunction): string {
  const s = Math.ceil(ms / 1000);
  return s < 60 ? t('lock.seconds', { count: s }) : t('lock.minutes', { count: Math.ceil(s / 60) });
}

export function LockScreen() {
  const { t } = useTranslation();
  const { unlockPin, unlockBiometric, prefs } = useSession();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const triedBio = useRef(false);

  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waitUntil]);

  const bio = useCallback(async () => {
    setBusy(true);
    try {
      await unlockBiometric(t('security.biometricPrompt'));
    } finally {
      setBusy(false);
    }
  }, [unlockBiometric, t]);

  useEffect(() => {
    if (prefs.biometricEnabled && !triedBio.current) {
      triedBio.current = true;
      bio();
    }
  }, [prefs.biometricEnabled, bio]);

  const waiting = waitUntil > now;

  const submit = async () => {
    if (pin.length < 4 || waiting) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await unlockPin(pin);
      if (r.ok) return;
      setPin('');
      if (r.reason === 'locked') {
        setWaitUntil(Date.now() + r.retryAfterMs);
        setNow(Date.now());
        setMessage(t('lock.waitFor', { time: formatWait(r.retryAfterMs, t) }));
      } else if (r.reason === 'wrong') {
        const parts = [t('lock.wrong')];
        if (r.retryAfterMs > 0) {
          setWaitUntil(Date.now() + r.retryAfterMs);
          setNow(Date.now());
          parts.push(t('lock.waitFor', { time: formatWait(r.retryAfterMs, t) }));
        }
        if (r.wipeIn != null && r.wipeIn <= 5) parts.push(t('lock.wipeWarning', { count: r.wipeIn }));
        setMessage(parts.join(' '));
      } else {
        setMessage(t('errors.generic'));
      }
    } catch {
      setMessage(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false} testID="lock-screen">
      <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
        <View style={{ gap: space.sm, alignItems: 'center' }}>
          <AppText variant="title" center>
            {t('lock.title')}
          </AppText>
          <AppText tone="secondary" center>
            {busy ? t('lock.checking') : t('lock.enterPin')}
          </AppText>
        </View>
        <PinPad
          value={pin}
          onChange={setPin}
          disabled={busy || waiting}
          extraKey={
            prefs.biometricEnabled
              ? { label: '◉', onPress: bio, accessibilityLabel: t('lock.useBiometric') }
              : undefined
          }
        />
        {message ? (
          <AppText tone="danger" center accessibilityLiveRegion="assertive">
            {waiting ? t('lock.waitFor', { time: formatWait(waitUntil - now, t) }) : message}
          </AppText>
        ) : null}
        <Button testID="unlock" label={t('lock.unlock')} onPress={submit} loading={busy} disabled={pin.length < 4 || waiting} />
      </View>
    </Screen>
  );
}
