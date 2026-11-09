import { CONCERN_NOTES, INGREDIENTS, KNOWLEDGE_REVIEWED, type Concern } from '@fitmate/skin';
import { checkinHistory, listPhotos } from '../../db/faceRepo';
import { getSetting } from '../../db/repositories';
import { getSkinProfile, listSteps } from '../../db/skinRepo';
import { addDays, localDate } from '../../lib/time';
import { averagePuffiness, PUFFINESS } from '../face/logic';
import { readObservation } from '../face/service';

/**
 * Face & Skin context for the coach. Each block says where the information
 * comes from (user-reported, AI visual estimate, reference library) so the
 * coach never mixes them up or presents an estimate as a fact.
 */
export const WELLNESS_RULES = [
  'Face & skin rules:',
  '- Facial puffiness ratings are USER-REPORTED; photo observations are AI VISUAL ESTIMATES (lighting and angle affect them); never present either as measurements.',
  '- Lifestyle patterns are possible associations only — never say sleep, salt or water CAUSED puffiness.',
  '- Never diagnose, never claim to measure swelling, water retention or facial fat, and never say a photo proves fat loss. Facial exercises do not burn facial fat.',
  '- Never recommend dehydration, severe salt restriction, drinking excessive water or crash diets for puffiness.',
  '- Persistent, painful, worsening, sudden or one-sided facial swelling: advise a doctor. Lip, tongue or throat swelling or breathing difficulty: tell them to call 112 now, and stop other advice.',
  '- Skincare: no medicines or prescriptions; one new active at a time with a patch test; no retinoids in pregnancy; suggest a dermatologist for persistent, severe or scarring skin problems.',
  '- When reference entries are given below, base ingredient facts on them and mention the source name. If something is not covered, say it is general guidance.',
  '- Do not guess a product’s ingredients from its name; ask for the ingredient list.',
].join('\n');

export function faceSkinContext(now: Date = new Date()): string | null {
  const lines: string[] = [];
  const shareFace = getSetting<boolean>('wellnessShareWithCoach', true);
  if (shareFace) {
    const today = localDate(now);
    const checkins = checkinHistory(addDays(today, -13));
    if (checkins.length) {
      const todayRow = checkins.find((c) => c.day === today);
      lines.push(
        `Face check-ins (user-reported, last 14 days): ${checkins.length} check-ins, average puffiness ${averagePuffiness(checkins)} on a 0–3 scale${
          todayRow ? `; today: ${PUFFINESS[todayRow.puffiness]}${todayRow.areas.length ? ` (${todayRow.areas.join(', ')})` : ''}${todayRow.timeOfDay ? `, ${todayRow.timeOfDay}` : ''}` : '; no check-in today'
        }.`,
      );
    }
    const latest = listPhotos().find((p) => p.aiObservation);
    const obs = latest ? readObservation(latest.aiObservation) : null;
    if (latest && obs) {
      lines.push(
        `Latest face photo AI visual estimate (${latest.takenOn}${latest.userVerdict ? `, user ${latest.userVerdict === 'agree' ? 'agreed' : 'disagreed'}` : ''}): ${[...obs.observations, obs.comparison].filter(Boolean).join(' ')}`,
      );
    }
  }
  const skin = getSkinProfile();
  if (skin?.shareWithCoach) {
    lines.push(
      `Skin profile (user-reported): ${skin.skinType}${skin.sensitive ? ', sensitive' : ''}; concerns: ${skin.concerns.join(', ') || 'none'}; experience: ${skin.experience}; budget: ${skin.budget}${skin.fragranceFree ? '; prefers fragrance-free' : ''}${skin.pregnant ? '; pregnant or breastfeeding' : ''}${skin.allergies ? `; product allergies: ${skin.allergies}` : ''}.`,
    );
    const steps = listSteps();
    if (steps.length) lines.push(`Current routine: AM ${steps.filter((s) => s.slot === 'am').map((s) => s.ingredient ?? s.step).join(' → ')}; PM ${steps.filter((s) => s.slot === 'pm').map((s) => s.ingredient ?? s.step).join(' → ')}.`);
  }
  return lines.length ? ['Face & skin information:', ...lines].join('\n') : null;
}

const CONCERN_WORDS: Record<Concern, RegExp> = {
  acne: /acne|pimple|breakout|zit|మొటిమ/i,
  dark_circles: /dark circle/i,
  under_eye_bags: /eye bag|under.?eye|puffy eye/i,
  pigmentation: /pigment|melasma/i,
  dark_spots: /dark spot|\bspots? on (my )?(face|skin)|acne marks|pimple marks/i,
  uneven_tone: /uneven (skin )?tone|skin tone/i,
  dryness: /dry skin|skin (is |feels )?dry|dryness|flaky/i,
  dullness: /dull (skin|face)|skin (looks |is )?dull|glow/i,
  excess_oil: /oily (skin|face|t-zone)|skin (is |gets )?oily|excess oil|sebum/i,
  pores: /\bpores?\b/i,
  redness: /\bredness\b|red (skin|patches|cheeks|face)|face (is |gets )?red/i,
  fine_lines: /fine line|wrinkle|ageing|aging/i,
};

/** Reference entries relevant to the question (retrieval from the curated library). */
export function knowledgeFor(question: string, max = 3): string | null {
  const q = question.toLowerCase();
  const hits = INGREDIENTS.filter((i) => q.includes(i.id.replace('_', ' ')) || i.aliases.some((a) => a.length > 3 && q.includes(a)) || q.includes(i.name.toLowerCase().split(' (')[0]!)).slice(0, max);
  const concerns = (Object.keys(CONCERN_WORDS) as Concern[]).filter((c) => CONCERN_WORDS[c].test(q)).slice(0, 2);
  if (!hits.length && !concerns.length) return null;
  const out = [`Reference (FitMate skincare library, reviewed ${KNOWLEDGE_REVIEWED}; educational, not a diagnosis):`];
  for (const i of hits) {
    out.push(
      `- ${i.name}: ${i.what} Use: ${i.howToUse} Start: ${i.start}. Precautions: ${i.precautions.join(' ') || 'none special'}${i.avoidWith.length ? ` Don't layer at the same time with: ${i.avoidWith.join(', ')}.` : ''} Pregnancy: ${i.pregnancy}. Sources: ${i.sources.map((s) => s.name).join('; ')}.`,
    );
  }
  for (const c of concerns) out.push(`- ${c}: ${CONCERN_NOTES[c].tip}${CONCERN_NOTES[c].seeProfessional ? ` ${CONCERN_NOTES[c].seeProfessional}` : ''}`);
  return out.join('\n');
}
