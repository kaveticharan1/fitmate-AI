import type { Point } from '@fitmate/core';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

const H = 180;
const PAD = { l: 36, r: 12, t: 12, b: 22 };

const dayNum = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** Daily readings as faint dots, the 7-day average as a line, and an optional dashed target. */
export function TrendChart({ points, trend, target, testID }: { points: Point[]; trend: Point[]; target?: number | null; testID?: string }) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const values = [...points.map((p) => p.value), ...(target != null ? [target] : [])];
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  const days = points.map((p) => dayNum(p.date));
  const d0 = Math.min(...days);
  const d1 = Math.max(d0 + 1, Math.max(...days));
  const x = (iso: string) => PAD.l + ((dayNum(iso) - d0) / (d1 - d0)) * (w - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const short = (iso: string) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;

  return (
    <View testID={testID} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }} accessibilityRole="image">
      {w > 0 && points.length > 0 ? (
        <Svg width={w} height={H}>
          {[min, (min + max) / 2, max].map((v) => (
            <SvgText key={v} x={PAD.l - 6} y={y(v) + 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
              {Math.round(v)}
            </SvgText>
          ))}
          {target != null ? <Line x1={PAD.l} x2={w - PAD.r} y1={y(target)} y2={y(target)} stroke={colors.accent} strokeDasharray="4 4" strokeWidth={1} /> : null}
          {points.map((p) => (
            <Circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={3} fill={colors.textMuted} />
          ))}
          {trend.length > 1 ? (
            <Polyline points={trend.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')} fill="none" stroke={colors.accent} strokeWidth={2.5} />
          ) : null}
          <SvgText x={PAD.l} y={H - 4} fontSize={11} fill={colors.textMuted}>
            {short(points[0]!.date)}
          </SvgText>
          <SvgText x={w - PAD.r} y={H - 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
            {short(points[points.length - 1]!.date)}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}
