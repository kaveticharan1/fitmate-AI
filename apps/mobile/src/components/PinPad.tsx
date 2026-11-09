import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { AppText } from './AppText';

/**
 * On-screen number pad. It avoids the system keyboard, so third-party
 * keyboard apps never see the PIN.
 */
export function PinPad({
  value,
  onChange,
  maxLength = 8,
  disabled,
  extraKey,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  disabled?: boolean;
  extraKey?: { label: string; onPress: () => void; accessibilityLabel: string };
}) {
  const { colors } = useTheme();
  const press = (d: string) => {
    if (disabled) return;
    if (d === 'del') onChange(value.slice(0, -1));
    else if (value.length < maxLength) onChange(value + d);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'extra', '0', 'del'];
  return (
    <View style={{ gap: space.xl, alignItems: 'center' }}>
      <View
        style={{ flexDirection: 'row', gap: space.md, minHeight: 16 }}
        accessibilityLabel={`${value.length} digits entered`}
        accessible
      >
        {Array.from({ length: Math.max(4, value.length) }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: i < value.length ? colors.accent : 'transparent',
              borderWidth: 2,
              borderColor: i < value.length ? colors.accent : colors.textMuted,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 3 * 80 + 2 * space.lg, gap: space.lg }}>
        {keys.map((k) => {
          if (k === 'extra') {
            return extraKey ? (
              <Pressable
                key={k}
                testID="pin-extra"
                accessibilityRole="button"
                accessibilityLabel={extraKey.accessibilityLabel}
                onPress={disabled ? undefined : extraKey.onPress}
                style={{ width: 80, height: 64, alignItems: 'center', justifyContent: 'center' }}
              >
                <AppText variant="heading" tone="accent">
                  {extraKey.label}
                </AppText>
              </Pressable>
            ) : (
              <View key={k} style={{ width: 80, height: 64 }} />
            );
          }
          return (
            <Pressable
              key={k}
              testID={`pin-${k}`}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Delete' : k}
              onPress={() => press(k)}
              style={({ pressed }) => ({
                width: 80,
                height: 64,
                borderRadius: radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: k === 'del' ? 'transparent' : pressed ? colors.surfaceRaised : colors.surface,
                opacity: disabled ? 0.4 : 1,
              })}
            >
              <AppText variant="title" weight="regular">
                {k === 'del' ? '⌫' : k}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
