import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { Gradient, GlowBackdrop } from './glow';
import { radius, space, TOUCH } from '../theme/tokens';
import { AppText } from './AppText';

export function Screen({
  children,
  scroll = true,
  footer,
  testID,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: space.lg, gap: space.lg }}>{children}</View>
  );
  return (
    <SafeAreaView testID={testID} style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <GlowBackdrop />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer ? (
          <View
            style={{
              padding: space.lg,
              paddingBottom: space.xl,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.bg,
              gap: space.sm,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  tone = 'default',
  testID,
}: {
  children: ReactNode;
  style?: ViewStyle;
  tone?: 'default' | 'accent' | 'warning' | 'danger';
  testID?: string;
}) {
  const { colors } = useTheme();
  const bg = { default: colors.glass, accent: colors.accentSoft, warning: colors.warningSoft, danger: colors.dangerSoft }[tone];
  const edge = { default: colors.glassBorder, accent: colors.accent + '55', warning: colors.warning + '44', danger: colors.danger + '44' }[tone];
  return (
    <View testID={testID} style={[{ backgroundColor: bg, borderRadius: radius.lg, borderWidth: 1, borderColor: edge, padding: space.lg, gap: space.md }, style]}>
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  testID,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: ReactNode;
}) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const bg = { primary: colors.gradFrom, secondary: colors.surfaceRaised, ghost: 'transparent', danger: colors.danger }[variant];
  const pressedBg = { primary: colors.gradFrom, secondary: colors.border, ghost: colors.surfaceRaised, danger: colors.danger }[variant];
  const tone = variant === 'primary' ? 'onAccent' : variant === 'danger' ? 'onAccent' : variant === 'ghost' ? 'accent' : 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => ({
        minHeight: TOUCH,
        borderRadius: radius.md,
        paddingHorizontal: space.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: space.sm,
        backgroundColor: pressed && !inactive ? pressedBg : bg,
        opacity: inactive && !loading ? 0.5 : pressed && variant === 'primary' ? 0.85 : 1,
        overflow: 'hidden',
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: colors.glassBorder,
        ...(variant === 'primary' ? { shadowColor: colors.gradTo, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: inactive ? 0 : 6 } : null),
      })}
    >
      {variant === 'primary' ? <Gradient from={colors.gradFrom} to={colors.gradTo} angle="horizontal" /> : null}
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.onAccent : colors.text} /> : icon}
      <AppText variant="body" weight="bold" tone={tone}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  const { t } = useTranslation();
  return (
    <AppText variant="label" tone="secondary" weight="bold">
      {label}
      {optional ? <AppText variant="label" tone="muted">{`  ·  ${t('common.optional')}`}</AppText> : null}
    </AppText>
  );
}

/** Translates an error key from the shared Zod schemas, with optional range values. */
export function useErrorText() {
  const { t } = useTranslation();
  return (message?: string, range?: [number, number]) =>
    message ? t(message, { min: range?.[0], max: range?.[1], defaultValue: t('errors.invalid') }) : undefined;
}

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  unit?: string;
  optional?: boolean;
}

export const TextField = forwardRef<React.ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, error, hint, unit, optional, style, ...input },
  ref,
) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <FieldLabel label={label} optional={optional} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: TOUCH,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: space.md,
        }}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          style={[{ flex: 1, color: colors.text, fontSize: 16, paddingVertical: space.md }, style]}
          {...input}
        />
        {unit ? <AppText tone="muted">{unit}</AppText> : null}
      </View>
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
});

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Single-choice list; renders as chips (compact) or full-width rows. */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  layout = 'chips',
  error,
  testID,
}: {
  label?: string;
  options: Choice<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  layout?: 'chips' | 'rows';
  error?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.sm }} accessibilityRole="radiogroup" testID={testID}>
      {label ? <FieldLabel label={label} /> : null}
      <View style={layout === 'chips' ? { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm } : { gap: space.sm }}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              testID={testID ? `${testID}-${o.value}` : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={{
                minHeight: layout === 'chips' ? 40 : TOUCH,
                justifyContent: 'center',
                paddingHorizontal: space.md,
                paddingVertical: layout === 'chips' ? space.sm : space.md,
                borderRadius: layout === 'chips' ? radius.pill : radius.md,
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.border,
                backgroundColor: selected ? colors.accentSoft : colors.surface,
              }}
            >
              <AppText variant={layout === 'chips' ? 'label' : 'body'} weight={selected ? 'bold' : 'regular'} tone={selected ? 'accent' : 'primary'}>
                {o.label}
              </AppText>
              {o.hint && layout === 'rows' ? (
                <AppText variant="caption" tone="secondary">
                  {o.hint}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
  testID,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      onPress={disabled ? undefined : () => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH, opacity: disabled ? 0.5 : 1 }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText>{label}</AppText>
        {description ? (
          <AppText variant="caption" tone="secondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.track }}
        thumbColor={colors.text}
      />
    </Pressable>
  );
}

/** Checkbox-style row used for consent. */
export function CheckRow({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', minHeight: TOUCH, paddingVertical: space.sm }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          marginTop: 2,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: value ? colors.accent : colors.textMuted,
          backgroundColor: value ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {value ? <AppText variant="caption" weight="bold" tone="onAccent">✓</AppText> : null}
      </View>
      <AppText style={{ flex: 1 }}>{label}</AppText>
    </Pressable>
  );
}

export function ProgressBar({ value, testID, color }: { value: number; testID?: string; color?: string }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: color ?? colors.gradTo }}>
        {color ? null : <Gradient from={colors.gradFrom} to={colors.accent} angle="horizontal" />}
      </View>
    </View>
  );
}

export function ListRow({ label, value, onPress, testID, danger }: { label: string; value?: string; onPress: () => void; testID?: string; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: TOUCH + 4,
        paddingHorizontal: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
      })}
    >
      <AppText style={{ flex: 1 }} tone={danger ? 'danger' : 'primary'}>
        {label}
      </AppText>
      {value ? <AppText tone="secondary">{value}</AppText> : null}
      <AppText tone="muted" style={{ marginLeft: space.sm }}>
        ›
      </AppText>
    </Pressable>
  );
}

export function ListGroup({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.border, gap: 1 }}>{children}</View>
  );
}

export function Banner({ text, tone = 'warning' }: { text: string; tone?: 'warning' | 'danger' | 'accent' }) {
  return (
    <Card tone={tone} style={{ padding: space.md }}>
      <AppText variant="label" tone={tone === 'accent' ? 'accent' : tone}>
        {text}
      </AppText>
    </Card>
  );
}

export type ChipTone = 'accent' | 'warning' | 'danger' | 'neutral' | 'info' | 'success';

/** Small status label, e.g. "Done" or "To do". */
export function Chip({ label, tone = 'neutral', testID }: { label: string; tone?: ChipTone; testID?: string }) {
  const { colors } = useTheme();
  const bg = { accent: colors.accentSoft, warning: colors.warningSoft, danger: colors.dangerSoft, neutral: colors.surfaceRaised, info: colors.info + '22', success: colors.successSoft }[tone];
  const fg = { accent: colors.accent, warning: colors.warning, danger: colors.danger, neutral: colors.textSecondary, info: colors.info, success: colors.success }[tone];
  return (
    <View testID={testID} style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 }}>
      <AppText variant="caption" weight="bold" style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}

/** Rounded square with an icon, used at the start of summary rows. */
export function IconTile({ name, tone = 'accent', size = 44 }: { name: React.ComponentProps<typeof Ionicons>['name']; tone?: ChipTone; size?: number }) {
  const { colors } = useTheme();
  const bg = { accent: colors.accentSoft, warning: colors.warningSoft, danger: colors.dangerSoft, neutral: colors.surfaceRaised, info: colors.info + '22', success: colors.successSoft }[tone];
  const fg = { accent: colors.accent, warning: colors.warning, danger: colors.danger, neutral: colors.textSecondary, info: colors.info, success: colors.success }[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}

/** Icon + title + subtitle + status chip; the whole row is one button. */
export function SummaryRow({
  icon,
  tone,
  title,
  subtitle,
  chip,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: ChipTone;
  title: string;
  subtitle?: string;
  chip?: { label: string; tone: ChipTone };
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, subtitle, chip?.label].filter(Boolean).join(', ')}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: TOUCH + 8,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        backgroundColor: pressed ? colors.surfaceRaised : colors.glass,
      })}
    >
      <IconTile name={icon} tone={tone} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText weight="bold">{title}</AppText>
        {subtitle ? (
          <AppText variant="label" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {chip ? <Chip label={chip.label} tone={chip.tone} /> : null}
    </Pressable>
  );
}

/** A row of small icon buttons that wrap, for shortcuts to other screens. */
export function QuickLinks({ links }: { links: { testID: string; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {links.map((l) => (
        <Pressable
          key={l.testID}
          testID={l.testID}
          accessibilityRole="button"
          accessibilityLabel={l.label}
          onPress={l.onPress}
          style={({ pressed }) => ({
            flexGrow: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.xs,
            minHeight: TOUCH,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            backgroundColor: pressed ? colors.surfaceRaised : colors.glass,
            borderWidth: 1,
            borderColor: colors.glassBorder,
          })}
        >
          <Ionicons name={l.icon} size={18} color={colors.accent} />
          <AppText variant="label" weight="bold">
            {l.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
