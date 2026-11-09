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
import { parseTime, REMINDERS_KEY, withDefaults, type ReminderConfig } from '../../features/reminders/schedule';
import { readNotificationLog } from '../../features/reminders/bridge';
import { DEFAULT_SMART, parseClock, type SmartConfig } from '../../features/reminders/smart';
import { currentDayStatus, syncSmartReminders } from '../../features/reminders/smartSync';
import { useTheme } from '../../theme/ThemeProvider';
import { space, TOUCH } from '../../theme/tokens';

const HOURS = [6, 7, 8, 9, 10] as const;
const END_HOURS = [19, 20, 21, 22] as const;

export default function RemindersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [config, setConfig] = useState<ReminderConfig>(() => withDefaults(getSetting<Partial<ReminderConfig> | null>(REMINDERS_KEY, null)));
  const [message, setMessage] = useState<{ tone: 'accent' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [badTimes, setBadTimes] = useState<Set<string>>(new Set());
  const [tried, setTried] = useState(false);

  const water = config.water;
  const setWater = (patch: Partial<ReminderConfig['water']>) => setConfig({ ...config, water: { ...water, ...patch } });
  const smart = { ...DEFAULT_SMART, ...config.smart!, mealTimes: { ...DEFAULT_SMART.mealTimes, ...(config.smart?.mealTimes ?? {}) }, quiet: { ...DEFAULT_SMART.quiet, ...(config.smart?.quiet ?? {}) } };
  const [history] = useState(() => readNotificationLog().slice(0, 10));
  const smartTimes: [string, string][] = [
    ['checkInTime', smart.checkInTime],
    ...(smart.meals ? (Object.entries(smart.mealTimes).map(([k, v]) => [`meal-${k}`, v]) as [string, string][]) : []),
    ...(smart.workout ? [['workoutTime', smart.workoutTime] as [string, string]] : []),
    ...(smart.bedtime ? [['bedtimeTime', smart.bedtimeTime] as [string, string]] : []),
    ...(smart.faceCheckIn ? [['faceTime', smart.faceTime] as [string, string]] : []),
    ...(smart.skincareAm ? [['skincareAmTime', smart.skincareAmTime] as [string, string]] : []),
    ...(smart.skincarePm ? [['skincarePmTime', smart.skincarePmTime] as [string, string]] : []),
    ...(smart.quiet.enabled ? [['quietStart', smart.quiet.start] as [string, string], ['quietEnd', smart.quiet.end] as [string, string]] : []),
  ];
  const badSmart = new Set(smartTimes.filter(([, v]) => !parseClock(v)).map(([k]) => k));
  const customList = config.custom ?? [];
  const setSmart = (patch: Partial<SmartConfig>) => setConfig({ ...config, smart: { ...smart, ...patch } });

  const save = async () => {
    const bad = new Set([
      ...config.medicines.filter((m) => !m.name.trim() || !parseTime(m.time)).map((m) => m.id),
      ...customList.filter((m) => !m.label.trim() || !parseTime(m.time)).map((m) => m.id),
    ]);
    setBadTimes(bad);
    setTried(true);
    if (bad.size || badSmart.size) return;
    setBusy(true);
    setMessage(null);
    try {
      const n = await applyReminders(config, {
        title: 'FitMate',
        water: t('reminders.waterBody'),
        medicine: (name) => t('reminders.medicineBody', { name }),
        custom: (label) => t('reminders.customBody', { label }),
      });
      setSetting(REMINDERS_KEY, config);
      const day = currentDayStatus();
      const smartCount = day ? await syncSmartReminders(t, day.status, day.targets, true) : 0;
      const anySmart = smart.checkIn || smart.logNudge || smart.morning || smart.weighIn;
      setMessage({ tone: 'accent', text: n || smartCount || anySmart ? t('reminders.saved', { count: n + smartCount }) : t('reminders.allOff') });
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

      <Card>
        <AppText variant="heading">{t('reminders.custom')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('reminders.customHint')}
        </AppText>
        {customList.map((m, idx) => (
          <View key={m.id} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 2 }}>
              <TextField
                testID={`custom-label-${idx}`}
                label={t('reminders.customLabel')}
                value={m.label}
                onChangeText={(v) => setConfig({ ...config, custom: customList.map((x) => (x.id === m.id ? { ...x, label: v } : x)) })}
                error={badTimes.has(m.id) && !m.label.trim() ? t('errors.required') : undefined}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                testID={`custom-time-${idx}`}
                label={t('reminders.time')}
                placeholder="08:00"
                value={m.time}
                onChangeText={(v) => setConfig({ ...config, custom: customList.map((x) => (x.id === m.id ? { ...x, time: v } : x)) })}
                keyboardType="numbers-and-punctuation"
                error={badTimes.has(m.id) && !parseTime(m.time) ? t('reminders.badTime') : undefined}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('food.delete')}
              onPress={() => setConfig({ ...config, custom: customList.filter((x) => x.id !== m.id) })}
              style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        <Button
          testID="custom-add"
          variant="secondary"
          label={t('reminders.addCustom')}
          onPress={() => setConfig({ ...config, custom: [...customList, { id: randomUUID(), label: '', time: '18:00' }] })}
        />
      </Card>

      <Card testID="smart-card">
        <AppText variant="heading">{t('smart.title')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('smart.hint')}
        </AppText>
        <ToggleRow testID="smart-checkin" label={t('smart.checkIn')} description={t('smart.checkInHint')} value={smart.checkIn} onChange={(v) => setSmart({ checkIn: v })} />
        {smart.checkIn ? (
          <ChoiceGroup<string>
            testID="smart-time"
            label={t('reminders.time')}
            value={smart.checkInTime}
            onChange={(v) => setSmart({ checkInTime: v })}
            options={['18:30', '19:30', '20:30', '21:30'].map((v) => ({ value: v, label: v }))}
          />
        ) : null}
        <ToggleRow testID="smart-log" label={t('smart.logNudgeLabel')} description={t('smart.logNudgeHint')} value={smart.logNudge} onChange={(v) => setSmart({ logNudge: v })} />
        <ToggleRow testID="smart-morning" label={t('smart.morningLabel')} description={t('smart.morningHint')} value={smart.morning} onChange={(v) => setSmart({ morning: v })} />
        <ToggleRow testID="smart-weighin" label={t('smart.weighInLabel')} description={t('smart.weighInHint')} value={smart.weighIn} onChange={(v) => setSmart({ weighIn: v })} />
        <ToggleRow testID="smart-meals" label={t('smart.mealsLabel')} description={t('smart.mealsHint')} value={smart.meals} onChange={(v) => setSmart({ meals: v })} />
        {smart.meals ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {(['breakfast', 'lunch', 'dinner'] as const).map((m) => (
              <View key={m} style={{ flex: 1 }}>
                <TextField
                  testID={`smart-meal-${m}`}
                  label={t(`meals.${m}`)}
                  value={smart.mealTimes[m]}
                  onChangeText={(v) => setSmart({ mealTimes: { ...smart.mealTimes, [m]: v } })}
                  keyboardType="numbers-and-punctuation"
                  error={tried && badSmart.has(`meal-${m}`) ? t('reminders.badTime') : undefined}
                />
              </View>
            ))}
          </View>
        ) : null}
        {(
          [
            ['workout', 'workoutTime', 'smart.workoutLabel', 'smart.workoutHint'],
            ['bedtime', 'bedtimeTime', 'smart.bedtimeLabel', 'smart.bedtimeHint'],
            ['faceCheckIn', 'faceTime', 'smart.faceLabel', 'smart.faceHint'],
            ['skincareAm', 'skincareAmTime', 'smart.skinAmLabel', 'smart.skinHint'],
            ['skincarePm', 'skincarePmTime', 'smart.skinPmLabel', 'smart.skinHint'],
          ] as const
        ).map(([flag, timeKey, label, hint]) => (
          <View key={flag} style={{ gap: space.sm }}>
            <ToggleRow testID={`smart-${flag}`} label={t(label)} description={t(hint)} value={smart[flag]} onChange={(v) => setSmart({ [flag]: v } as Partial<SmartConfig>)} />
            {smart[flag] ? (
              <TextField
                testID={`smart-${timeKey}`}
                label={t('reminders.time')}
                value={smart[timeKey]}
                onChangeText={(v) => setSmart({ [timeKey]: v } as Partial<SmartConfig>)}
                keyboardType="numbers-and-punctuation"
                error={tried && badSmart.has(timeKey) ? t('reminders.badTime') : undefined}
              />
            ) : null}
          </View>
        ))}
      </Card>

      <Card testID="quiet-card">
        <ToggleRow testID="quiet-toggle" label={t('smart.quietLabel')} description={t('smart.quietHint')} value={smart.quiet.enabled} onChange={(v) => setSmart({ quiet: { ...smart.quiet, enabled: v } })} />
        {smart.quiet.enabled ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <TextField testID="quiet-start" label={t('smart.quietFrom')} value={smart.quiet.start} onChangeText={(v) => setSmart({ quiet: { ...smart.quiet, start: v } })} keyboardType="numbers-and-punctuation" error={tried && badSmart.has('quietStart') ? t('reminders.badTime') : undefined} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField testID="quiet-end" label={t('smart.quietTo')} value={smart.quiet.end} onChangeText={(v) => setSmart({ quiet: { ...smart.quiet, end: v } })} keyboardType="numbers-and-punctuation" error={tried && badSmart.has('quietEnd') ? t('reminders.badTime') : undefined} />
            </View>
          </View>
        ) : null}
        <ChoiceGroup<string>
          testID="daily-limit"
          label={t('smart.limitLabel')}
          value={String(smart.dailyLimit)}
          onChange={(v) => setSmart({ dailyLimit: Number(v) })}
          options={['3', '6', '10'].map((v) => ({ value: v, label: v }))}
        />
        <AppText variant="caption" tone="secondary">
          {t('smart.snoozeHint')}
        </AppText>
      </Card>

      <Card testID="history-card">
        <AppText variant="heading">{t('smart.historyTitle')}</AppText>
        {history.length === 0 ? <AppText tone="muted">{t('smart.historyEmpty')}</AppText> : null}
        {history.map((h, i) => (
          <View key={i} style={{ gap: 2 }}>
            <AppText variant="label">{h.body || h.title}</AppText>
            <AppText variant="caption" tone="secondary">
              {`${new Date(h.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${t(`smart.history.${h.action}`)}`}
            </AppText>
          </View>
        ))}
      </Card>

      <AppText variant="caption" tone="muted">
        {t('reminders.privacy')}
      </AppText>
      {message ? <Banner tone={message.tone} text={message.text} /> : null}
    </Screen>
  );
}
