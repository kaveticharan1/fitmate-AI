import { useId } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

/** Fills its parent with a diagonal gradient (put it first inside a View with overflow hidden). */
export function Gradient({ from, to, radius = 0, style, angle = 'diagonal' }: { from: string; to: string; radius?: number; style?: ViewStyle; angle?: 'diagonal' | 'horizontal' | 'vertical' }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [x2, y2] = angle === 'horizontal' ? ['1', '0'] : angle === 'vertical' ? ['0', '1'] : ['1', '1'];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Soft violet and blue light behind a screen's content. */
export function GlowBackdrop() {
  const { colors, isDark } = useTheme();
  const a = `ga${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const b = `gb${a}`;
  const strength = isDark ? 0.35 : 0.5;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="glow-backdrop">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={a} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.glowA} stopOpacity={strength} />
            <Stop offset="1" stopColor={colors.glowA} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={b} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.glowB} stopOpacity={strength * 0.6} />
            <Stop offset="1" stopColor={colors.glowB} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="85%" cy="4%" r="260" fill={`url(#${a})`} />
        <Circle cx="5%" cy="38%" r="220" fill={`url(#${b})`} />
      </Svg>
    </View>
  );
}
