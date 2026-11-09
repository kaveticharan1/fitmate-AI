import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, ChoiceGroup, Screen, TextField, ToggleRow } from '../../components/ui';
import { getSetting, setSetting } from '../../db/repositories';
import { applyReminders } from '../../features/reminders/notifications';
import { DEFAULT_REMINDERS, parseTime, REMINDERS_KEY, type ReminderConfig } from '../../features/reminders/schedule';
import { useTheme } from '../../theme/ThemeProvider';
import { space, TOUCH } from '../../theme/tokens';

const HOURS = [6, 7, 8, 9, 10] as const;
const END_HOURS = [19, 20, 21, 22] as const;

export default function RemindersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [config, setConfig] = useState<ReminderConfig>(() => getSetting(REMINDERS_KEY, DEFAULT_REMINDERS));
  const [message, setMessage] = useState<{ tone: 'accent' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [badTimes, setBadTimes] = useState<Set<string>>(new Set());

  const water = config.water;
  const setWater = (patch: Partial<ReminderConfig['water']>) => setConfig({ ...config, water: { ...water, ...patch } });

  const save = async () => {
    const bad = new Set(config.medicines.filter((m) => !m.name.trim() || !parseTime(m.time)).map((m) => m.id));
    setBadTimes(bad);
    if (bad.size) return;
    setBusy(true);
    setMessage(null);
    try {
      const n = await applyReminders(config, {
        title: 'FitMate',
        water: t('reminders.waterBody'),
        medicine: (name) => t('reminders.medicineBody', { name }),
      });
      setSetting(REMINDERS_KEY, config);
      setMessage({ tone: 'accent', text: n ? t('reminders.saved', { count: n }) : t('reminders.allOff') });
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error && e.message === 'permission' ? t('reminders.noPermission') : t('errors.generic') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="settings-reminders" footer={<Button testID="reminders-save" label={t('common.save')} onPress={save} loading={busy} />}>
      <Header title={t('reminders.title')} />

      <Card>
        <ToggleRow testID="water-toggle" label={t('reminders.water')} description={t('reminders.waterHint')} value={water.enabled} onChange={(v) => setWater({ enabled: v })} />
        {water.enabled ? (
          <>
            <ChoiceGroup<string>
              label={t('reminders.from')}
              value={String(water.startHour)}
              onChange={(v) => setWater({ startHour: Number(v) })}
              options={HOURS.map((h) => ({ value: String(h), label: `${h}:00` }))}
            />
            <ChoiceGroup<string>
              label={t('reminders.until')}
              value={String(water.endHour)}
              onChange={(v) => setWater({ endHour: Number(v) })}
              options={END_HOURS.map((h) => ({ value: String(h), label: `${h}:00` }))}
            />
            <ChoiceGroup<'1' | '2'>
              label={t('reminders.every')}
              value={String(water.everyHours) as '1' | '2'}
              onChange={(v) => setWater({ everyHours: Number(v) as 1 | 2 })}
              options={[
                { value: '1', label: t('reminders.everyHour') },
                { value: '2', label: t('reminders.every2Hours') },
              ]}
            />
          </>
        ) : null}
      </Card>

      <Card>
        <AppText variant="heading">{t('reminders.medicines')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('reminders.medicinesHint')}
        </AppText>
        {config.medicines.map((m, idx) => (
          <View key={m.id} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 2 }}>
              <TextField
                testID={`med-name-${idx}`}
                label={t('reminders.medicineName')}
                value={m.name}
                onChangeText={(v) => setConfig({ ...config, medicines: config.medicines.map((x) => (x.id === m.id ? { ...x, name: v } : x)) })}
                error={badTimes.has(m.id) && !m.name.trim() ? t('errors.required') : undefined}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                testID={`med-time-${idx}`}
                label={t('reminders.time')}
                placeholder="08:00"
                value={m.time}
                onChangeText={(v) => setConfig({ ...config, medicines: config.medicines.map((x) => (x.id === m.id ? { ...x, time: v } : x)) })}
                keyboardType="numbers-and-punctuation"
                error={badTimes.has(m.id) && !parseTime(m.time) ? t('reminders.badTime') : undefined}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('food.delete')}
              onPress={() => setConfig({ ...config, medicines: config.medicines.filter((x) => x.id !== m.id) })}
              style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        <Button
          testID="med-add"
          variant="secondary"
          label={t('reminders.addMedicine')}
          onPress={() => setConfig({ ...config, medicines: [...config.medicines, { id: randomUUID(), name: '', time: '08:00' }] })}
        />
      </Card>

      <AppText variant="caption" tone="muted">
        {t('reminders.privacy')}
      </AppText>
      {message ? <Banner tone={message.tone} text={message.text} /> : null}
    </Screen>
  );
}
