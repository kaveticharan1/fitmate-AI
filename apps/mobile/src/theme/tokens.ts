/**
 * "Glow" design (v1.4, after the FitPilot concept): deep violet night background,
 * glass cards with a faint violet edge, and a violet gradient for primary actions.
 * Every text colour is checked for at least 4.5:1 contrast on cards.
 */
export interface Palette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  /** Accent for text, icons and outlines. */
  accent: string;
  accentPressed: string;
  /** Text on the gradient / accent fill. */
  onAccent: string;
  accentSoft: string;
  /** Primary button gradient (white text reads ≥ 4.8:1 on both ends). */
  gradFrom: string;
  gradTo: string;
  /** Glass cards. */
  glass: string;
  glassBorder: string;
  /** Background glow blobs. */
  glowA: string;
  glowB: string;
  info: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  track: string;
}

export const dark: Palette = {
  bg: '#0C0A1C',
  surface: '#171433',
  surfaceRaised: '#211D45',
  border: '#2E2960',
  text: '#F3F1FF',
  textSecondary: '#BDB7DE',
  textMuted: '#8E87B8',
  accent: '#A48CFF',
  accentPressed: '#5A36E6',
  onAccent: '#FFFFFF',
  accentSoft: '#2A2160',
  gradFrom: '#6A3DF0',
  gradTo: '#7A4DFF',
  glass: 'rgba(30, 25, 70, 0.72)',
  glassBorder: 'rgba(164, 140, 255, 0.22)',
  glowA: '#6A3DF0',
  glowB: '#2B7BFF',
  info: '#5CD6FF',
  warning: '#F2B65A',
  warningSoft: '#3A2A12',
  danger: '#FF7A8A',
  dangerSoft: '#3F1726',
  success: '#4FD8A4',
  successSoft: '#123A33',
  track: '#2E2960',
};

export const light: Palette = {
  bg: '#F6F4FF',
  surface: '#FFFFFF',
  surfaceRaised: '#EEEAFF',
  border: '#DDD7FA',
  text: '#16123A',
  textSecondary: '#4E4880',
  textMuted: '#6F6A99',
  accent: '#5B3BE8',
  accentPressed: '#4A2BD0',
  onAccent: '#FFFFFF',
  accentSoft: '#E9E3FF',
  gradFrom: '#6A3DF0',
  gradTo: '#7A4DFF',
  glass: 'rgba(255, 255, 255, 0.86)',
  glassBorder: 'rgba(91, 59, 232, 0.16)',
  glowA: '#B9A6FF',
  glowB: '#9FD0FF',
  info: '#0A6F99',
  warning: '#9A5B00',
  warningSoft: '#FBEFD9',
  danger: '#C4304A',
  dangerSoft: '#FBE4E8',
  success: '#137A55',
  successSoft: '#DDF4EA',
  track: '#DDD7FA',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;

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
