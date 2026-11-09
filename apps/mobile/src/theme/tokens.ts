/**
 * Dark, muted design with one calm green accent (approved 9 Nov 2026).
 * Status colours appear only where they carry meaning.
 */
export interface Palette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentPressed: string;
  onAccent: string;
  accentSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  track: string;
}

export const dark: Palette = {
  bg: '#0F1113',
  surface: '#171A1D',
  surfaceRaised: '#1F2327',
  border: '#2A2F34',
  text: '#ECEFF1',
  textSecondary: '#A3ACB3',
  textMuted: '#6E777E',
  accent: '#2BB38A',
  accentPressed: '#24996F',
  onAccent: '#04261A',
  accentSoft: '#173A2F',
  warning: '#E3AA4C',
  warningSoft: '#3A2D14',
  danger: '#EB6F66',
  dangerSoft: '#3C1D1B',
  success: '#5FC79B',
  track: '#2A2F34',
};

export const light: Palette = {
  bg: '#F5F7F6',
  surface: '#FFFFFF',
  surfaceRaised: '#EEF2F0',
  border: '#DCE2DF',
  text: '#14191C',
  textSecondary: '#4D585E',
  textMuted: '#7C878D',
  accent: '#0F8A66',
  accentPressed: '#0B7055',
  onAccent: '#FFFFFF',
  accentSoft: '#DDF2EA',
  warning: '#A86A0C',
  warningSoft: '#FBEFD9',
  danger: '#C2392F',
  dangerSoft: '#FBE7E5',
  success: '#1E8A5C',
  track: '#DCE2DF',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const type = {
  display: { fontSize: 34, lineHeight: 40 },
  title: { fontSize: 24, lineHeight: 30 },
  heading: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 23 },
  label: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 13, lineHeight: 18 },
} as const;

export type TypeVariant = keyof typeof type;

/** Minimum touch target, per accessibility guidelines. */
export const TOUCH = 48;
