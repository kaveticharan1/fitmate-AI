import { useTranslation } from 'react-i18next';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { type, type TypeVariant } from '../theme/tokens';

export const TELUGU_FONT = 'NotoSansTelugu';
export const TELUGU_FONT_BOLD = 'NotoSansTelugu-SemiBold';

type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'warning' | 'onAccent';

interface Props extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  weight?: 'regular' | 'bold';
  center?: boolean;
}

/** Text with the app's type scale; switches to the bundled Telugu font when Telugu is selected. */
export function AppText({ variant = 'body', tone = 'primary', weight, center, style, ...rest }: Props) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const bold = weight === 'bold' || (weight == null && (variant === 'title' || variant === 'display' || variant === 'heading'));
  const color: Record<Tone, string> = {
    primary: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    accent: colors.accent,
    danger: colors.danger,
    warning: colors.warning,
    onAccent: colors.onAccent,
  };
  const telugu = i18n.language === 'te';
  const s: TextStyle = {
    ...type[variant],
    color: color[tone],
    fontWeight: bold ? '600' : '400',
    textAlign: center ? 'center' : undefined,
    ...(telugu ? { fontFamily: bold ? TELUGU_FONT_BOLD : TELUGU_FONT, fontWeight: undefined } : null),
    // Telugu glyphs need extra vertical room.
    ...(telugu ? { lineHeight: Math.round(type[variant].lineHeight * 1.25) } : null),
  };
  return <Text maxFontSizeMultiplier={1.6} {...rest} style={[s, style]} />;
}
