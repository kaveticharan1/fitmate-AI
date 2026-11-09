/**
 * Curated skincare knowledge, written for FitMate in plain words.
 * Educational only — not a diagnosis or a prescription.
 *
 * Every entry names its sources. Links were checked on the review date; where a
 * specific page wasn't verified, the organisation's main site is given instead.
 */
export const KNOWLEDGE_REVIEWED = '2026-11-10';

export type SkinType = 'oily' | 'dry' | 'combination' | 'sensitive' | 'normal' | 'unsure';
export type Concern =
  | 'acne'
  | 'dark_circles'
  | 'under_eye_bags'
  | 'pigmentation'
  | 'dark_spots'
  | 'uneven_tone'
  | 'dryness'
  | 'dullness'
  | 'excess_oil'
  | 'pores'
  | 'redness'
  | 'fine_lines';

export const CONCERNS: Concern[] = ['acne', 'dark_circles', 'under_eye_bags', 'pigmentation', 'dark_spots', 'uneven_tone', 'dryness', 'dullness', 'excess_oil', 'pores', 'redness', 'fine_lines'];

export interface Source {
  name: string;
  url: string;
}

export const SOURCES = {
  aadSunscreen: { name: 'American Academy of Dermatology — sunscreen FAQs', url: 'https://www.aad.org/media/stats-sunscreen' },
  aadAdultAcne: { name: 'American Academy of Dermatology — adult acne treatment', url: 'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment' },
  aadAcneWontClear: { name: 'American Academy of Dermatology — when acne won’t clear', url: 'https://www.aad.org/public/diseases/acne/diy/wont-clear' },
  nhsAcne: { name: 'NHS — acne treatment', url: 'https://www.nhs.uk/conditions/acne/treatment/' },
  aad: { name: 'American Academy of Dermatology (general skin care guidance)', url: 'https://www.aad.org' },
  nhs: { name: 'NHS (general health guidance)', url: 'https://www.nhs.uk' },
} satisfies Record<string, Source>;

export type Pregnancy = 'ok' | 'ask' | 'avoid';

export interface Ingredient {
  id: string;
  name: string;
  /** Ingredient-list (INCI) spellings and common names, lower case. */
  aliases: string[];
  kind: 'active' | 'hydrator' | 'barrier' | 'sunscreen' | 'cleanser';
  what: string;
  goodFor: Concern[];
  /** Skin types that should be more careful. */
  caution: SkinType[];
  irritation: 'low' | 'medium' | 'high';
  howToUse: string;
  /** Typical frequency when starting. */
  start: string;
  when: 'am' | 'pm' | 'any';
  precautions: string[];
  /** Ingredient ids not to layer at the same time (use at different times or days). */
  avoidWith: string[];
  pregnancy: Pregnancy;
  /** When to involve a professional. */
  seeProfessional?: string;
  sources: Source[];
}

const I = (i: Ingredient) => i;

export const INGREDIENTS: Ingredient[] = [
  I({
    id: 'sunscreen', name: 'Broad-spectrum sunscreen (SPF 30+)', kind: 'sunscreen',
    aliases: ['sunscreen', 'spf', 'avobenzone', 'octocrylene', 'bemotrizinol', 'bis-ethylhexyloxyphenol methoxyphenyl triazine', 'ethylhexyl triazone', 'diethylamino hydroxybenzoyl hexyl benzoate', 'octinoxate', 'ethylhexyl methoxycinnamate', 'homosalate', 'titanium dioxide'],
    what: 'Protects from UVA and UVB light, which cause sunburn, dark spots, uneven tone, early ageing and skin cancer. The most important daytime step for every skin type.',
    goodFor: ['pigmentation', 'dark_spots', 'uneven_tone', 'fine_lines', 'redness'], caution: [], irritation: 'low',
    howToUse: 'Last step every morning. Use enough to cover face, neck and ears (roughly two finger-lengths for the face). Reapply about every 2 hours outdoors, and after sweating or swimming.',
    start: 'Every morning', when: 'am',
    precautions: ['Choose “broad spectrum” and SPF 30 or higher.', 'Mineral (zinc oxide/titanium dioxide) types are often easier on sensitive skin.', 'A higher SPF does not let you stay out longer without reapplying.'],
    avoidWith: [], pregnancy: 'ok', sources: [SOURCES.aadSunscreen],
  }),
  I({
    id: 'zinc_oxide', name: 'Zinc oxide (mineral sunscreen)', kind: 'sunscreen', aliases: ['zinc oxide', 'ci 77947'],
    what: 'A mineral UV filter that gives broad protection and is usually well tolerated by sensitive skin. May leave a white cast.',
    goodFor: ['redness', 'pigmentation', 'dark_spots'], caution: [], irritation: 'low',
    howToUse: 'As your sunscreen, last step in the morning. Tinted versions also help with visible light, which can worsen dark spots.',
    start: 'Every morning', when: 'am', precautions: ['Check the label says broad spectrum, SPF 30+.'], avoidWith: [], pregnancy: 'ok', sources: [SOURCES.aadSunscreen],
  }),
  I({
    id: 'niacinamide', name: 'Niacinamide (vitamin B3)', kind: 'active', aliases: ['niacinamide', 'nicotinamide', 'vitamin b3'],
    what: 'A gentle multi-purpose ingredient that supports the skin barrier and can help with oiliness, the look of pores, redness and uneven tone.',
    goodFor: ['excess_oil', 'pores', 'redness', 'uneven_tone', 'acne', 'dullness'], caution: [], irritation: 'low',
    howToUse: 'A few drops of serum (or a moisturiser that contains it) after cleansing, morning or night.',
    start: 'Once a day, then twice if comfortable', when: 'any',
    precautions: ['Strong concentrations (over about 5%) can sting or cause redness in some people — start low.'],
    avoidWith: [], pregnancy: 'ok', sources: [SOURCES.aad],
  }),
  I({
    id: 'vitamin_c', name: 'Vitamin C (ascorbic acid)', kind: 'active', aliases: ['ascorbic acid', 'l-ascorbic acid', 'sodium ascorbyl phosphate', 'magnesium ascorbyl phosphate', 'ascorbyl glucoside', 'ethyl ascorbic acid', '3-o-ethyl ascorbic acid', 'tetrahexyldecyl ascorbate', 'vitamin c'],
    what: 'An antioxidant that can brighten dull skin and help fade the look of dark spots over time. Works well under sunscreen in the morning.',
    goodFor: ['dullness', 'dark_spots', 'pigmentation', 'uneven_tone', 'fine_lines'], caution: ['sensitive', 'dry'], irritation: 'medium',
    howToUse: 'A few drops after cleansing in the morning, before moisturiser and sunscreen.',
    start: 'Every other morning for 2 weeks, then daily', when: 'am',
    precautions: ['Pure L-ascorbic acid can sting; gentler forms (e.g. sodium ascorbyl phosphate) suit sensitive skin.', 'It oxidises: if the serum turns dark orange or brown, replace it.', 'Layering with strong acids or retinoids at the same time can irritate — use those at night.'],
    avoidWith: ['glycolic_acid', 'lactic_acid', 'retinoid', 'benzoyl_peroxide'], pregnancy: 'ok', sources: [SOURCES.aad],
  }),
  I({
    id: 'hyaluronic_acid', name: 'Hyaluronic acid', kind: 'hydrator', aliases: ['hyaluronic acid', 'sodium hyaluronate', 'hydrolyzed hyaluronic acid', 'sodium acetylated hyaluronate'],
    what: 'A humectant that draws water into the top layer of skin so it feels plumper and less tight. Suits almost everyone.',
    goodFor: ['dryness', 'dullness', 'fine_lines'], caution: [], irritation: 'low',
    howToUse: 'On slightly damp skin after cleansing, then seal in with moisturiser (in very dry air it works better under a cream).',
    start: 'Once or twice a day', when: 'any', precautions: [], avoidWith: [], pregnancy: 'ok', sources: [SOURCES.aad],
  }),
  I({
    id: 'ceramides', name: 'Ceramides', kind: 'barrier', aliases: ['ceramide np', 'ceramide ap', 'ceramide eop', 'ceramide ns', 'ceramide eos', 'ceramide', 'ceramides', 'phytosphingosine'],
    what: 'Fats that are a natural part of the skin barrier. Moisturisers with ceramides help dry, sensitive or irritated skin hold water and calm down.',
    goodFor: ['dryness', 'redness', 'dullness'], caution: [], irritation: 'low',
    howToUse: 'In your moisturiser, morning and night. Especially useful while using retinoids or acids.',
    start: 'Twice a day', when: 'any', precautions: [], avoidWith: [], pregnancy: 'ok', sources: [SOURCES.aad],
  }),
  I({
    id: 'salicylic_acid', name: 'Salicylic acid (BHA)', kind: 'active', aliases: ['salicylic acid', 'beta hydroxy acid', 'bha', 'betaine salicylate', 'willow bark extract'],
    what: 'An oil-soluble exfoliant that gets into pores, so it suits oily and acne-prone skin, blackheads and whiteheads.',
    goodFor: ['acne', 'excess_oil', 'pores'], caution: ['dry', 'sensitive'], irritation: 'medium',
    howToUse: 'As a face wash, or a leave-on product (often 0.5–2%) after cleansing at night.',
    start: '2–3 times a week, slowly increasing', when: 'pm',
    precautions: ['Can dry the skin — use a moisturiser.', 'Don’t combine with other exfoliating acids or a retinoid on the same night when starting.', 'If you are allergic to aspirin, ask a pharmacist first.', 'Wear sunscreen in the day.'],
    avoidWith: ['glycolic_acid', 'lactic_acid', 'retinoid'], pregnancy: 'ask',
    seeProfessional: 'If acne is deep, painful, leaves scars or dark marks, or hasn’t improved after 6–8 weeks, see a dermatologist.',
    sources: [SOURCES.aadAdultAcne, SOURCES.aadAcneWontClear],
  }),
  I({
    id: 'glycolic_acid', name: 'Glycolic acid (AHA)', kind: 'active', aliases: ['glycolic acid', 'alpha hydroxy acid', 'aha'],
    what: 'A water-soluble exfoliant that smooths the surface and can help dullness and uneven tone. Stronger and more irritating than lactic acid.',
    goodFor: ['dullness', 'uneven_tone', 'dark_spots', 'fine_lines'], caution: ['sensitive', 'dry'], irritation: 'high',
    howToUse: 'A low-strength toner or serum at night after cleansing, then moisturiser.',
    start: '1–2 nights a week', when: 'pm',
    precautions: ['Makes skin more sun-sensitive — sunscreen every day is essential.', 'Not on the same night as a retinoid or other acids.', 'Stop if skin burns, peels a lot or stays red.'],
    avoidWith: ['retinoid', 'salicylic_acid', 'lactic_acid', 'vitamin_c', 'benzoyl_peroxide'], pregnancy: 'ask', sources: [SOURCES.aad],
  }),
  I({
    id: 'lactic_acid', name: 'Lactic acid (AHA)', kind: 'active', aliases: ['lactic acid'],
    what: 'A gentler AHA exfoliant that also helps hydrate; a common first acid for dry or more sensitive skin.',
    goodFor: ['dullness', 'dryness', 'uneven_tone'], caution: ['sensitive'], irritation: 'medium',
    howToUse: 'Low-strength product at night after cleansing, then moisturiser.',
    start: '1–2 nights a week', when: 'pm',
    precautions: ['Daily sunscreen is essential.', 'Not on the same night as a retinoid or other acids.'],
    avoidWith: ['retinoid', 'salicylic_acid', 'glycolic_acid', 'vitamin_c'], pregnancy: 'ask', sources: [SOURCES.aad],
  }),
  I({
    id: 'retinoid', name: 'Retinoids (retinol, retinal, adapalene)', kind: 'active', aliases: ['retinol', 'retinal', 'retinaldehyde', 'retinyl palmitate', 'retinyl propionate', 'hydroxypinacolone retinoate', 'adapalene', 'tretinoin', 'retinoic acid'],
    what: 'Vitamin A relatives that speed up skin renewal. They help clogged pores and acne, and over months the look of fine lines and dark spots. Adapalene is an acne treatment available without prescription in many countries; tretinoin is prescription-only.',
    goodFor: ['acne', 'fine_lines', 'dark_spots', 'uneven_tone', 'pores'], caution: ['sensitive', 'dry'], irritation: 'high',
    howToUse: 'A pea-sized amount for the whole face, at night, on dry skin, then moisturiser.',
    start: '2 nights a week for 2 weeks, then every other night, then nightly if comfortable', when: 'pm',
    precautions: ['Expect some dryness or peeling at first; a ceramide moisturiser helps.', 'Use sunscreen every day; limit sun exposure.', 'Not on the same night as AHAs/BHAs when starting.', 'Do NOT use if pregnant, trying to get pregnant or breastfeeding without your doctor’s advice.'],
    avoidWith: ['glycolic_acid', 'lactic_acid', 'salicylic_acid', 'benzoyl_peroxide', 'vitamin_c'], pregnancy: 'avoid',
    seeProfessional: 'Prescription retinoids (tretinoin, tazarotene) need a doctor. See a dermatologist for acne that leaves scars or dark marks.',
    sources: [SOURCES.nhsAcne, SOURCES.aadAdultAcne],
  }),
  I({
    id: 'azelaic_acid', name: 'Azelaic acid', kind: 'active', aliases: ['azelaic acid', 'potassium azeloyl diglycinate'],
    what: 'Helps acne and can fade the dark marks acne leaves behind; often tolerated by more sensitive, redness-prone skin. Used as an alternative when other acne treatments irritate.',
    goodFor: ['acne', 'dark_spots', 'pigmentation', 'redness', 'uneven_tone'], caution: [], irritation: 'medium',
    howToUse: 'A thin layer after cleansing, once or twice a day.',
    start: 'Once a day', when: 'any',
    precautions: ['May tingle at first.', 'Higher strengths (15–20%) are usually prescription products.'],
    avoidWith: [], pregnancy: 'ok',
    seeProfessional: 'Ask a doctor about prescription-strength azelaic acid for persistent acne or pigmentation.',
    sources: [SOURCES.nhsAcne],
  }),
  I({
    id: 'benzoyl_peroxide', name: 'Benzoyl peroxide', kind: 'active', aliases: ['benzoyl peroxide'],
    what: 'An antiseptic acne treatment that reduces acne bacteria and inflammation; good for red, inflamed pimples.',
    goodFor: ['acne'], caution: ['sensitive', 'dry'], irritation: 'medium',
    howToUse: 'Start with 2.5%. Apply a thin layer to all acne-prone areas (not just the spots) after washing, or use as a short-contact wash.',
    start: 'Once a day (or every other day)', when: 'any',
    precautions: ['Common: dryness, stinging, redness and peeling — use sparingly and moisturise.', 'Bleaches towels, pillowcases, clothes and hair.', 'Give it 6–8 weeks before judging, and don’t keep switching products.', 'Use at a different time from retinoids unless your doctor prescribed a combination.'],
    avoidWith: ['retinoid', 'vitamin_c', 'glycolic_acid'], pregnancy: 'ask',
    seeProfessional: 'See a doctor for acne that is deep, painful, scarring, leaves dark marks, or doesn’t improve with non-prescription products.',
    sources: [SOURCES.nhsAcne, SOURCES.aadAdultAcne, SOURCES.aadAcneWontClear],
  }),
  I({
    id: 'gentle_cleanser', name: 'Gentle cleanser', kind: 'cleanser', aliases: ['cleanser', 'face wash'],
    what: 'A mild, non-soap, fragrance-free wash removes sweat, sunscreen and oil without stripping the skin.',
    goodFor: ['acne', 'excess_oil', 'dryness', 'redness'], caution: [], irritation: 'low',
    howToUse: 'Lukewarm water, fingertips only, 30–60 seconds, pat dry. Twice a day and after sweating — not more.',
    start: 'Twice a day', when: 'any',
    precautions: ['Avoid scrubs and harsh soaps; scrubbing worsens acne-prone skin.'],
    avoidWith: [], pregnancy: 'ok', sources: [SOURCES.aadAcneWontClear],
  }),
];

/** Common irritants / sensitisers worth pointing out (not "bad" — just worth knowing for sensitive skin). */
export const IRRITANTS: { id: string; label: string; aliases: string[] }[] = [
  { id: 'fragrance', label: 'Fragrance', aliases: ['fragrance', 'parfum', 'perfume', 'aroma'] },
  { id: 'essential_oils', label: 'Essential oils', aliases: ['lavender oil', 'lavandula angustifolia oil', 'tea tree oil', 'melaleuca alternifolia leaf oil', 'peppermint oil', 'mentha piperita oil', 'eucalyptus oil', 'citrus aurantium dulcis peel oil', 'lemon peel oil', 'citrus limon peel oil', 'bergamot oil', 'clove oil'] },
  { id: 'drying_alcohol', label: 'Drying alcohol', aliases: ['alcohol denat', 'alcohol denat.', 'denatured alcohol', 'sd alcohol', 'isopropyl alcohol', 'ethanol', 'alcohol'] },
  { id: 'fragrance_allergens', label: 'Fragrance allergens', aliases: ['limonene', 'linalool', 'citronellol', 'geraniol', 'eugenol', 'cinnamal', 'coumarin', 'citral'] },
  { id: 'menthol', label: 'Menthol / cooling agents', aliases: ['menthol', 'camphor', 'menthyl lactate'] },
  { id: 'harsh_surfactant', label: 'Harsh cleansing agent', aliases: ['sodium lauryl sulfate', 'sls'] },
];

/** Plain-language notes on skin concerns, used by the coach and the routine builder. */
export const CONCERN_NOTES: Record<Concern, { tip: string; seeProfessional?: string }> = {
  acne: { tip: 'Use one acne ingredient (adapalene, benzoyl peroxide or salicylic acid) for 6–8 weeks before adding another; apply to the whole area, don’t pick, wash twice a day.', seeProfessional: 'Deep, painful or scarring acne, or acne leaving dark marks, needs a dermatologist.' },
  dark_circles: { tip: 'Often due to genetics, thin skin or shadows; sleep, sun protection and a gentle eye moisturiser help a little. No cream removes them completely.' },
  under_eye_bags: { tip: 'Often worse in the morning, after short sleep or salty food; cool compresses and sleep help. Sudden or one-sided swelling should be checked by a doctor.' },
  pigmentation: { tip: 'Daily sunscreen is the base; vitamin C, niacinamide or azelaic acid can help slowly over months.', seeProfessional: 'New, changing or very dark patches — see a dermatologist.' },
  dark_spots: { tip: 'Sunscreen every day stops them darkening; azelaic acid, niacinamide or vitamin C can help them fade over 2–3 months.', seeProfessional: 'A spot that changes in size, shape or colour, bleeds or itches must be checked by a doctor.' },
  uneven_tone: { tip: 'Sunscreen plus one gentle brightening ingredient (niacinamide or vitamin C).' },
  dryness: { tip: 'Gentle cleanser, lukewarm water, and a ceramide moisturiser on damp skin; avoid hot water and foaming washes.' },
  dullness: { tip: 'Sleep, sunscreen and a gentle exfoliant (lactic acid) once or twice a week.' },
  excess_oil: { tip: 'Don’t over-wash; a light moisturiser still helps. Niacinamide or salicylic acid can reduce the look of oiliness.' },
  pores: { tip: 'Pore size is mostly genetic; salicylic acid, niacinamide and retinoids can make them look smaller.' },
  redness: { tip: 'Keep it simple and fragrance-free; ceramides, niacinamide and mineral sunscreen are usually tolerated.', seeProfessional: 'Persistent facial redness with bumps or flushing may be rosacea — see a doctor.' },
  fine_lines: { tip: 'Sunscreen every day is the most proven step; a retinoid at night helps over months.' },
};

export const getIngredient = (id: string) => INGREDIENTS.find((i) => i.id === id);
