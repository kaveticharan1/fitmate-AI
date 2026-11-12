import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/**
 * FitMate's opening animation: the runner from the app logo jogging inside the
 * activity ring, with speed lines streaming behind. Arms and legs swing at the
 * joints (hip → knee, shoulder → elbow), driven on the native thread.
 * Uses fixed brand colours because it shows before the theme has loaded.
 */
const BG = '#0C0A1C';
const LIMB = '#F3FBFF';
const CYAN = '#7FF3FF';
const SIZE = 220;
const T = 13; // limb thickness
const RUN_MS = 680;

const STEPS = 24;
const INPUT = Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS);

/** Smooth periodic curve through keyframes [phase, value] (phase 0..1, first = last). */
function periodic(keys: [number, number][]) {
  return (p: number) => {
    for (let i = 0; i < keys.length - 1; i++) {
      const [p0, v0] = keys[i]!;
      const [p1, v1] = keys[i + 1]!;
      if (p >= p0 && p <= p1) {
        const k = (p - p0) / (p1 - p0);
        return v0 + (v1 - v0) * (1 - Math.cos(Math.PI * k)) / 2;
      }
    }
    return keys[0]![1];
  };
}

const shift = (fn: (p: number) => number, by: number) => (p: number) => fn((p + by) % 1);

// Angles in degrees; for a limb hanging down, positive swings it backwards.
const thigh = (p: number) => -36 * Math.cos(2 * Math.PI * p);
const shin = periodic([[0, 40], [0.25, 18], [0.5, 28], [0.75, 108], [1, 40]]);
const upperArm = (p: number) => 36 * Math.cos(2 * Math.PI * p);
const forearm = (p: number) => -82 + 10 * Math.sin(2 * Math.PI * p);
const bob = (p: number) => -4 * Math.abs(Math.sin(2 * Math.PI * p));

type AnimatedValue = Animated.Value;
const deg = (v: AnimatedValue, fn: (p: number) => number) => v.interpolate({ inputRange: INPUT, outputRange: INPUT.map((p) => `${fn(p).toFixed(2)}deg`) });
const num = (v: AnimatedValue, fn: (p: number) => number) => v.interpolate({ inputRange: INPUT, outputRange: INPUT.map((p) => fn(p)) });

/** A rounded limb hanging from its joint (top cap centre), rotating there; children hang from its far end. */
function Limb({ length, rotate, children, opacity = 1 }: { length: number; rotate: Animated.AnimatedInterpolation<string>; children?: React.ReactNode; opacity?: number }) {
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: -T / 2,
        top: -T / 2,
        width: T,
        height: length + T,
        borderRadius: T / 2,
        backgroundColor: LIMB,
        opacity,
        transformOrigin: [T / 2, T / 2, 0],
        transform: [{ rotate }],
      }}
    >
      <View style={{ position: 'absolute', left: T / 2, top: length + T / 2 }}>{children}</View>
    </Animated.View>
  );
}

function Runner({ run }: { run: AnimatedValue }) {
  const TORSO = 40;
  const lean = '16deg';
  return (
    <Animated.View style={{ position: 'absolute', left: SIZE / 2 - 6, top: SIZE / 2 + 4, transform: [{ translateY: num(run, bob) }] }}>
      {/* back leg + back arm first so the near limbs draw on top */}
      <Limb length={34} rotate={deg(run, shift(thigh, 0.5))} opacity={0.72}>
        <Limb length={32} rotate={deg(run, shift(shin, 0.5))} opacity={1} />
      </Limb>
      {/* torso: points up from the hip, leaning forward */}
      <View
        style={{
          position: 'absolute',
          left: -T / 2,
          top: -(TORSO + T / 2),
          width: T,
          height: TORSO + T,
          borderRadius: T / 2,
          backgroundColor: LIMB,
          transformOrigin: [T / 2, TORSO + T / 2, 0],
          transform: [{ rotate: lean }],
        }}
      >
        <View style={{ position: 'absolute', left: T / 2, top: T / 2 + 2 }}>
          <Limb length={23} rotate={deg(run, shift(upperArm, 0.5))} opacity={0.72}>
            <Limb length={20} rotate={deg(run, shift(forearm, 0.5))} />
          </Limb>
        </View>
        <View style={{ position: 'absolute', left: T / 2 - 12, top: -27, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' }} />
        <View style={{ position: 'absolute', left: T / 2, top: T / 2 + 2 }}>
          <Limb length={23} rotate={deg(run, upperArm)}>
            <Limb length={20} rotate={deg(run, forearm)} />
          </Limb>
        </View>
      </View>
      <Limb length={34} rotate={deg(run, thigh)}>
        <Limb length={32} rotate={deg(run, shin)} />
      </Limb>
    </Animated.View>
  );
}

function SpeedLines({ run }: { run: AnimatedValue }) {
  const lines = [
    { top: SIZE / 2 - 30, width: 18, delay: 0 },
    { top: SIZE / 2 - 4, width: 26, delay: 0.33 },
    { top: SIZE / 2 + 22, width: 16, delay: 0.66 },
  ];
  return (
    <>
      {lines.map((l, i) => {
        const x = (p: number) => -16 * ((p + l.delay) % 1);
        const o = (p: number) => Math.sin(Math.PI * ((p + l.delay) % 1));
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: SIZE / 2 - 40 - l.width,
              top: l.top,
              width: l.width,
              height: 7,
              borderRadius: 4,
              backgroundColor: CYAN,
              opacity: num(run, o),
              transform: [{ translateX: num(run, x) }],
            }}
          />
        );
      })}
    </>
  );
}

function Ring({ spin }: { spin: AnimatedValue }) {
  const r = 92;
  const c = SIZE / 2;
  const circ = 2 * Math.PI * r;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={13} fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={c} cy={c} r={r} stroke={CYAN} strokeOpacity={0.35} strokeWidth={13} strokeLinecap="round" fill="none" strokeDasharray={`${circ * 0.72} ${circ}`} transform={`rotate(-200 ${c} ${c})`} />
          <Circle cx={c} cy={c} r={r} stroke={CYAN} strokeWidth={13} strokeLinecap="round" fill="none" strokeDasharray={`${circ * 0.34} ${circ}`} transform={`rotate(-63.2 ${c} ${c})`} />
          <Circle cx={c + r * Math.cos((Math.PI / 180) * 59.2)} cy={c + r * Math.sin((Math.PI / 180) * 59.2)} r={10} fill="#FFFFFF" />
        </Svg>
      </Animated.View>
    </>
  );
}

export function BootLoader({ testID = 'boot-loader' }: { testID?: string }) {
  const [run] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loops = [
      Animated.loop(Animated.timing(run, { toValue: 1, duration: RUN_MS, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [run, spin]);

  return (
    <View testID={testID} style={styles.screen} accessible accessibilityRole="progressbar" accessibilityLabel="Loading FitMate">
      <View style={styles.stage}>
        <Ring spin={spin} />
        <SpeedLines run={run} />
        <Runner run={run} />
      </View>
      <Text style={styles.name}>FitMate</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', gap: 22 },
  stage: { width: SIZE, height: SIZE },
  name: { color: '#F3F1FF', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
});
