import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { normaliseDate } from '@fitmate/validation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, TOUCH } from '../theme/tokens';
import { AppText } from './AppText';
import { FieldLabel } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → "DD-MM-YYYY" using the phone's local calendar day. */
export const toDisplayDate = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

/** Typed text → Date at local noon (noon avoids any time-zone day shift), or null. */
export function parseDisplayDate(text: string): Date | null {
  const iso = normaliseDate(text);
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/**
 * Date input: tap the calendar button to pick a date, or type it (DD-MM-YYYY).
 * Uses the normal keyboard so "-" and "/" can be typed.
 */
export function DateField({
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  minimumDate,
  maximumDate,
  defaultPickerDate,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Where the calendar opens when the field is empty. */
  defaultPickerDate?: Date;
  testID?: string;
}) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const [iosOpen, setIosOpen] = useState(false);

  const current = parseDisplayDate(value) ?? defaultPickerDate ?? maximumDate ?? new Date();

  const onPicked = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'android') setIosOpen(false);
    if (event.type === 'set' && date) {
      onChange(toDisplayDate(date));
      onBlur?.();
    }
  };

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: current, mode: 'date', minimumDate, maximumDate, onChange: onPicked });
    } else {
      setIosOpen((o) => !o);
    }
  };

  return (
    <View style={{ gap: space.xs }}>
      <FieldLabel label={label} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: TOUCH,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value || t('onboarding.about.dobHint')}`}
          accessibilityHint={t('common.pickDate')}
          onPress={openPicker}
          style={{ flex: 1, minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: space.md }}
        >
          <AppText tone={value ? 'primary' : 'muted'}>{value || t('onboarding.about.dobHint')}</AppText>
        </Pressable>
        <Pressable
          testID={testID ? `${testID}-calendar` : undefined}
          accessibilityRole="button"
          accessibilityLabel={t('common.pickDate')}
          onPress={openPicker}
          style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.accent} />
        </Pressable>
      </View>
      {iosOpen ? (
        <DateTimePicker
          value={current}
          mode="date"
          display="inline"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          themeVariant={isDark ? 'dark' : 'light'}
          onChange={onPicked}
        />
      ) : null}
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
