/**
 * Local safety checks that run on the phone before anything is sent to the AI.
 * They never block the user; they make sure the right help is shown immediately,
 * even when the AI is offline, slow or gives a poor answer.
 */
export type SafetyFlag = 'crisis' | 'emergency';

const CRISIS = [
  /\bsuicid/i,
  /\bkill(ing)? my ?self\b/i,
  /\bend (it all|my life)\b/i,
  /\bwant(ed)? to die\b/i,
  /\bdon'?t want to live\b/i,
  /\bno reason to live\b/i,
  /\bself[- ]?harm/i,
  /\bhurt(ing)? my ?self\b/i,
  /\bcut(ting)? my ?self\b/i,
  /\bmar(na|jana) chahta\b/i,
  /ఆత్మహత్య/,
  /చనిపోవాల/,
  /చచ్చిపోవాల/,
  /బ్రతకాలని లేదు/,
];

const EMERGENCY = [
  /\bchest pain\b/i,
  /\bpain in (my )?chest\b/i,
  /\bcan'?t breathe\b/i,
  /\bcannot breathe\b/i,
  /\bhard to breathe\b/i,
  /\b(i )?fainted\b/i,
  /\bpassed out\b/i,
  /\bblacked out\b/i,
  /ఛాతీ నొప్పి/,
  /ఊపిరి ఆడటం లేదు/,
  /స్పృహ తప్పి/,
];

export function safetyFlags(text: string): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  if (CRISIS.some((r) => r.test(text))) flags.push('crisis');
  if (EMERGENCY.some((r) => r.test(text))) flags.push('emergency');
  return flags;
}

/** Indian helplines shown with a flag (verified November 2026). */
export const HELPLINES = {
  mentalHealth: { name: 'Tele-MANAS', number: '14416', alt: '1-800-891-4416' },
  emergency: { name: 'Emergency', number: '112' },
} as const;
