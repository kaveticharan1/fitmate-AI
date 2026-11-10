import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export type MascotMood = 'happy' | 'thinking' | 'cheer';

/**
 * "Pilo", FitMate's coach: an original little robot drawn in SVG (no image
 * files, works offline). Rounded head with a dark visor, glowing eyes, an
 * antenna light and a small body. Decorative: screen readers skip it.
 */
export function Mascot({ size = 96, mood = 'happy', testID }: { size?: number; mood?: MascotMood; testID?: string }) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, '');
  const shell = `shell${u}`;
  const visor = `visor${u}`;
  const halo = `halo${u}`;
  const eye = '#7FF3FF';
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={shell} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#D9D2FF" />
        </LinearGradient>
        <LinearGradient id={visor} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#241C55" />
          <Stop offset="1" stopColor="#0F0B2A" />
        </LinearGradient>
        <RadialGradient id={halo} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#8B6CFF" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#8B6CFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* glow behind */}
      <Circle cx="60" cy="62" r="58" fill={`url(#${halo})`} />

      {/* antenna */}
      <Rect x="58" y="12" width="4" height="12" rx="2" fill="#CFC6FF" />
      <Circle cx="60" cy="11" r="5" fill={mood === 'thinking' ? '#FFC970' : '#7FF3FF'} />

      {/* body */}
      <Rect x="38" y="80" width="44" height="28" rx="12" fill={`url(#${shell})`} />
      <Rect x="52" y="88" width="16" height="8" rx="4" fill="#8B6CFF" opacity={0.85} />
      {/* arms */}
      {mood === 'cheer' ? (
        <G>
          <Path d="M38 88 Q26 78 24 66" stroke="#E4DEFF" strokeWidth="7" strokeLinecap="round" fill="none" />
          <Path d="M82 88 Q94 78 96 66" stroke="#E4DEFF" strokeWidth="7" strokeLinecap="round" fill="none" />
        </G>
      ) : (
        <G>
          <Path d="M38 88 Q28 94 28 102" stroke="#E4DEFF" strokeWidth="7" strokeLinecap="round" fill="none" />
          <Path d="M82 88 Q94 82 98 72" stroke="#E4DEFF" strokeWidth="7" strokeLinecap="round" fill="none" />
        </G>
      )}

      {/* ear pods */}
      <Rect x="20" y="44" width="10" height="22" rx="5" fill="#B9ABFF" />
      <Rect x="90" y="44" width="10" height="22" rx="5" fill="#B9ABFF" />

      {/* head */}
      <Rect x="26" y="24" width="68" height="58" rx="24" fill={`url(#${shell})`} />
      {/* visor */}
      <Rect x="33" y="34" width="54" height="36" rx="16" fill={`url(#${visor})`} />

      {/* eyes */}
      {mood === 'thinking' ? (
        <G>
          <Rect x="44" y="49" width="10" height="4" rx="2" fill={eye} />
          <Rect x="66" y="49" width="10" height="4" rx="2" fill={eye} />
        </G>
      ) : mood === 'cheer' ? (
        <G>
          <Path d="M44 53 Q49 45 54 53" stroke={eye} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <Path d="M66 53 Q71 45 76 53" stroke={eye} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </G>
      ) : (
        <G>
          <Ellipse cx="49" cy="51" rx="5" ry="6" fill={eye} />
          <Ellipse cx="71" cy="51" rx="5" ry="6" fill={eye} />
          <Circle cx="50.5" cy="49" r="1.6" fill="#FFFFFF" />
          <Circle cx="72.5" cy="49" r="1.6" fill="#FFFFFF" />
        </G>
      )}
      {/* mouth */}
      <Path d={mood === 'thinking' ? 'M54 62 L66 62' : 'M53 60 Q60 66 67 60'} stroke={eye} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* cheeks */}
      <Circle cx="41" cy="61" r="3" fill="#FF8FC7" opacity={0.55} />
      <Circle cx="79" cy="61" r="3" fill="#FF8FC7" opacity={0.55} />
    </Svg>
  );
}
