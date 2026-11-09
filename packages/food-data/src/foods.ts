import type { Allergen, Food, FoodCategory, FoodDiet, Measure, MeasureKey } from './types';

/**
 * Indian-first food database, v1.3 (Nov 2026).
 *
 * Values are per 100 g of the food as eaten. Raw staples follow the Indian Food
 * Composition Tables (IFCT 2017) or USDA FoodData Central where IFCT has no entry;
 * home-cooked dishes are typical home recipes (they include the cooking oil noted
 * in `oilPer100g`) and are APPROXIMATE — recipes vary from kitchen to kitchen.
 * Liquids are counted as 1 ml ≈ 1 g.
 */

type N = [kcal: number, protein: number, carbs: number, fat: number, fiber: number];

interface Opts {
  te?: string;
  aka?: string[];
  allergens?: Allergen[];
  oil?: number;
  raw?: Record<string, number>;
}

function food(
  id: string,
  name: string,
  category: FoodCategory,
  diet: FoodDiet,
  state: Food['state'],
  n: N,
  measures: [MeasureKey, number][],
  opts: Opts = {},
): Food {
  const ms: Measure[] = measures.map(([key, grams]) => ({ key, grams }));
  if (!ms.some((m) => m.key === 'g')) ms.push({ key: 'g', grams: 1 });
  return {
    id,
    name,
    nameTe: opts.te,
    aliases: opts.aka,
    category,
    diet,
    allergens: opts.allergens,
    state,
    per100g: { kcal: n[0], protein: n[1], carbs: n[2], fat: n[3], fiber: n[4] },
    measures: ms,
    defaultMeasure: ms[0]!.key,
    oilPer100g: opts.oil,
    raw: opts.raw ? Object.entries(opts.raw).map(([rid, g]) => ({ id: rid, g })) : undefined,
  };
}

const MILK: Allergen[] = ['milk'];
const WHEAT: Allergen[] = ['gluten'];

export const FOODS: Food[] = [
  // ── Raw staples (used for recipes and grocery lists) ─────────────────────
  food('rice_raw', 'Rice, white (raw)', 'raw', 'vegan', 'raw', [356, 7.9, 78.2, 0.5, 2.8], [['cup', 190], ['tbsp', 12]], { te: 'బియ్యం', aka: ['biyyam', 'chawal'] }),
  food('brown_rice_raw', 'Rice, brown (raw)', 'raw', 'vegan', 'raw', [360, 7.5, 76, 2.2, 4.4], [['cup', 190]]),
  food('atta', 'Wheat flour, whole (atta)', 'raw', 'vegan', 'raw', [341, 12.1, 69.4, 1.7, 11.4], [['cup', 120], ['tbsp', 8]], { te: 'గోధుమ పిండి', aka: ['godhuma pindi', 'wheat flour'], allergens: WHEAT }),
  food('rava', 'Semolina (rava/sooji)', 'raw', 'vegan', 'raw', [348, 10.4, 72.8, 0.8, 3.9], [['cup', 170], ['tbsp', 10]], { te: 'రవ్వ', aka: ['ravva', 'sooji', 'suji'], allergens: WHEAT }),
  food('oats', 'Oats, rolled (raw)', 'raw', 'vegan', 'raw', [379, 13.2, 67.7, 6.5, 10.1], [['cup', 80], ['tbsp', 5]], { allergens: WHEAT }),
  food('poha_raw', 'Poha / flattened rice (raw)', 'raw', 'vegan', 'raw', [346, 6.6, 77.3, 1.2, 2], [['cup', 60]], { te: 'అటుకులు', aka: ['atukulu', 'aval'] }),
  food('ragi_flour', 'Ragi flour', 'raw', 'vegan', 'raw', [328, 7.2, 66.8, 1.9, 11.2], [['cup', 120]], { te: 'రాగి పిండి', aka: ['ragi pindi', 'finger millet'] }),
  food('toor_dal_raw', 'Toor dal (raw)', 'raw', 'vegan', 'raw', [343, 22.3, 57.6, 1.7, 9.1], [['cup', 200], ['katori', 100]], { te: 'కందిపప్పు', aka: ['kandi pappu', 'arhar', 'tuvar'] }),
  food('moong_dal_raw', 'Moong dal, split (raw)', 'raw', 'vegan', 'raw', [348, 24.5, 59.9, 1.2, 8.2], [['cup', 200]], { te: 'పెసరపప్పు', aka: ['pesara pappu'] }),
  food('moong_whole_raw', 'Green gram, whole (raw)', 'raw', 'vegan', 'raw', [347, 23.9, 62.6, 1.2, 16.3], [['cup', 200]], { te: 'పెసలు', aka: ['pesalu', 'whole moong'] }),
  food('urad_dal_raw', 'Urad dal (raw)', 'raw', 'vegan', 'raw', [347, 24, 59.6, 1.4, 11], [['cup', 200]], { te: 'మినపప్పు', aka: ['minapa pappu', 'black gram'] }),
  food('chana_dal_raw', 'Chana dal (raw)', 'raw', 'vegan', 'raw', [360, 20.8, 59.8, 5.6, 12], [['cup', 200]], { te: 'శనగపప్పు', aka: ['senaga pappu'] }),
  food('chickpeas_raw', 'Chickpeas / kabuli chana (raw)', 'raw', 'vegan', 'raw', [364, 19.3, 60.6, 6, 17.4], [['cup', 200]], { aka: ['chole', 'kabuli'] }),
  food('rajma_raw', 'Rajma / kidney beans (raw)', 'raw', 'vegan', 'raw', [333, 22.5, 60, 0.8, 15.2], [['cup', 185]]),
  food('peanuts_raw', 'Peanuts (raw)', 'raw', 'vegan', 'raw', [567, 25.8, 16.1, 49.2, 8.5], [['handful', 30], ['tbsp', 9]], { te: 'వేరుశనగలు', aka: ['verusanagalu', 'groundnut', 'palli'], allergens: ['peanut'] }),
  food('oil', 'Cooking oil', 'raw', 'vegan', 'raw', [884, 0, 0, 100, 0], [['tsp', 5], ['tbsp', 14]], { te: 'నూనె', aka: ['nune', 'groundnut oil', 'sunflower oil'] }),
  food('ghee', 'Ghee', 'raw', 'vegetarian', 'raw', [876, 0.3, 0, 99.5, 0], [['tsp', 5], ['tbsp', 14]], { te: 'నెయ్యి', aka: ['neyyi'], allergens: MILK }),
  food('butter', 'Butter', 'raw', 'vegetarian', 'raw', [717, 0.9, 0.1, 81, 0], [['tsp', 5], ['tbsp', 14]], { allergens: MILK }),
  food('sugar', 'Sugar', 'raw', 'vegan', 'raw', [387, 0, 100, 0, 0], [['tsp', 4], ['tbsp', 12]], { te: 'చక్కెర', aka: ['chakkera', 'panchadara'] }),
  food('jaggery', 'Jaggery', 'raw', 'vegan', 'raw', [383, 0.4, 95, 0.1, 0], [['tbsp', 15]], { te: 'బెల్లం', aka: ['bellam', 'gud'] }),
  food('onion', 'Onion', 'raw', 'vegan', 'raw', [40, 1.1, 9.3, 0.1, 1.7], [['piece', 110]], { te: 'ఉల్లిపాయ', aka: ['ullipaya', 'pyaaz'] }),
  food('tomato', 'Tomato', 'raw', 'vegan', 'raw', [18, 0.9, 3.9, 0.2, 1.2], [['piece', 100]], { te: 'టమాటా', aka: ['tamata'] }),
  food('potato_raw', 'Potato (raw)', 'raw', 'vegan', 'raw', [77, 2, 17.5, 0.1, 2.2], [['piece', 150]], { te: 'బంగాళదుంప', aka: ['bangaladumpa', 'aloo'] }),
  food('spinach', 'Spinach / palak', 'raw', 'vegan', 'raw', [23, 2.9, 3.6, 0.4, 2.2], [['cup', 30]], { te: 'పాలకూర', aka: ['palakura', 'palak'] }),
  food('okra', 'Okra / bhindi', 'raw', 'vegan', 'raw', [33, 1.9, 7.5, 0.2, 3.2], [['cup', 100]], { te: 'బెండకాయ', aka: ['bendakaya', 'ladies finger'] }),
  food('cabbage', 'Cabbage', 'raw', 'vegan', 'raw', [25, 1.3, 5.8, 0.1, 2.5], [['cup', 90]], { te: 'క్యాబేజీ' }),
  food('brinjal', 'Brinjal / eggplant', 'raw', 'vegan', 'raw', [25, 1, 5.9, 0.2, 3], [['piece', 80]], { te: 'వంకాయ', aka: ['vankaya', 'baingan'] }),
  food('ivy_gourd', 'Ivy gourd / tindora', 'raw', 'vegan', 'raw', [18, 1.2, 3.1, 0.1, 1.6], [['cup', 100]], { te: 'దొండకాయ', aka: ['dondakaya', 'tondli'] }),
  food('mixed_veg_raw', 'Mixed vegetables (carrot, beans, peas)', 'raw', 'vegan', 'raw', [50, 2.5, 9.5, 0.3, 3], [['cup', 130]], { aka: ['vegetables'] }),
  food('coconut_fresh', 'Coconut, fresh', 'raw', 'vegan', 'raw', [354, 3.3, 15.2, 33.5, 9], [['tbsp', 10], ['cup', 80]], { te: 'కొబ్బరి', aka: ['kobbari'], allergens: ['tree_nut'] }),
  food('cucumber', 'Cucumber', 'raw', 'vegan', 'raw', [15, 0.7, 3.6, 0.1, 0.5], [['piece', 200]], { te: 'దోసకాయ', aka: ['kheera'] }),
  food('carrot', 'Carrot', 'raw', 'vegan', 'raw', [41, 0.9, 9.6, 0.2, 2.8], [['piece', 60]], { te: 'క్యారెట్' }),
  food('chicken_raw', 'Chicken, skinless (raw)', 'raw', 'nonveg', 'raw', [120, 22.5, 0, 2.6, 0], [['g', 1]], { te: 'కోడి మాంసం', aka: ['kodi', 'chicken'] }),
  food('mutton_raw', 'Mutton / goat (raw)', 'raw', 'nonveg', 'raw', [150, 20, 0, 7.6, 0], [['g', 1]], { te: 'మటన్', aka: ['mamsam', 'goat'] }),
  food('fish_raw', 'Fish, rohu (raw)', 'raw', 'nonveg', 'raw', [97, 16.6, 0, 2, 0], [['g', 1]], { te: 'చేప', aka: ['chepa'], allergens: ['fish'] }),
  food('prawns_raw', 'Prawns (raw)', 'raw', 'nonveg', 'raw', [85, 20, 0, 0.5, 0], [['g', 1]], { te: 'రొయ్యలు', aka: ['royyalu', 'shrimp'], allergens: ['shellfish'] }),
  food('tofu', 'Tofu, firm', 'dairy', 'vegan', 'ready', [144, 17.3, 2.8, 8.7, 2.3], [['piece', 50]], { allergens: ['soy'] }),
  food('whey', 'Whey protein powder', 'dairy', 'vegetarian', 'ready', [400, 78, 8, 6, 0], [['tbsp', 30]], { aka: ['protein powder', 'scoop'], allergens: MILK }),

  // ── Rice and grains (cooked) ─────────────────────────────────────────────
  food('rice_cooked', 'Rice, cooked', 'grains', 'vegan', 'cooked', [130, 2.7, 28.2, 0.3, 0.4], [['katori', 150], ['cup', 160], ['plate', 250]], { te: 'అన్నం', aka: ['annam', 'chawal', 'white rice', 'steamed rice'], raw: { rice_raw: 33 } }),
  food('brown_rice_cooked', 'Brown rice, cooked', 'grains', 'vegan', 'cooked', [123, 2.7, 25.6, 1, 1.6], [['katori', 150], ['cup', 160]], { raw: { brown_rice_raw: 33 } }),
  food('jeera_rice', 'Jeera rice', 'grains', 'vegan', 'cooked', [160, 3, 28, 4, 0.6], [['katori', 150], ['plate', 250]], { oil: 3, raw: { rice_raw: 31, oil: 3 } }),
  food('lemon_rice', 'Lemon rice / pulihora', 'grains', 'vegan', 'cooked', [175, 3.2, 27, 6, 1], [['katori', 150], ['plate', 250]], { te: 'పులిహోర', aka: ['pulihora', 'chitranna'], oil: 5, allergens: ['peanut'], raw: { rice_raw: 30, oil: 5, peanuts_raw: 3 } }),
  food('curd_rice', 'Curd rice', 'grains', 'vegetarian', 'cooked', [115, 3.2, 17, 3.6, 0.4], [['katori', 150], ['plate', 250]], { te: 'పెరుగన్నం', aka: ['perugu annam', 'daddojanam', 'thayir sadam'], allergens: MILK, raw: { rice_raw: 18, curd: 45 } }),
  food('veg_pulao', 'Vegetable pulao', 'grains', 'vegan', 'cooked', [150, 3.3, 24, 4.5, 1.5], [['katori', 150], ['plate', 250]], { aka: ['pulav'], oil: 4, raw: { rice_raw: 28, mixed_veg_raw: 20, oil: 4 } }),
  food('chicken_biryani', 'Chicken biryani', 'grains', 'nonveg', 'cooked', [175, 8.5, 20, 6.5, 0.7], [['plate', 300], ['katori', 150]], { te: 'చికెన్ బిర్యానీ', aka: ['biryani', 'dum biryani'], oil: 6, allergens: MILK, raw: { rice_raw: 25, chicken_raw: 25, onion: 10, curd: 5, oil: 6 } }),
  food('veg_biryani', 'Vegetable biryani', 'grains', 'vegetarian', 'cooked', [160, 3.5, 24, 5.5, 1.5], [['plate', 300], ['katori', 150]], { oil: 5, raw: { rice_raw: 27, mixed_veg_raw: 20, onion: 8, oil: 5 } }),
  food('ragi_mudde', 'Ragi mudde / ragi ball', 'grains', 'vegan', 'cooked', [110, 2.4, 23, 0.6, 3], [['piece', 150]], { te: 'రాగి సంగటి', aka: ['ragi sangati', 'ragi ball'], raw: { ragi_flour: 30 } }),
  food('oats_porridge', 'Oats porridge with milk', 'breakfast', 'vegetarian', 'cooked', [95, 4, 13, 2.8, 1.3], [['katori', 200], ['cup', 240]], { aka: ['oatmeal'], allergens: [...MILK, ...WHEAT], raw: { oats: 12, milk_toned: 75 } }),

  // ── Breads ───────────────────────────────────────────────────────────────
  food('phulka', 'Phulka / roti (no oil)', 'breads', 'vegan', 'cooked', [260, 9, 53, 1.5, 6], [['piece', 35]], { te: 'పుల్కా', aka: ['roti', 'pulka', 'chapathi plain'], allergens: WHEAT, raw: { atta: 70 } }),
  food('chapati', 'Chapati (with oil)', 'breads', 'vegan', 'cooked', [300, 8.5, 48, 8, 5.5], [['piece', 40]], { te: 'చపాతీ', aka: ['chapathi', 'chapatti'], oil: 5, allergens: WHEAT, raw: { atta: 68, oil: 5 } }),
  food('paratha', 'Paratha, plain', 'breads', 'vegan', 'cooked', [330, 7, 45, 13.5, 4.5], [['piece', 80]], { aka: ['parota', 'parantha'], oil: 12, allergens: WHEAT, raw: { atta: 62, oil: 12 } }),
  food('aloo_paratha', 'Aloo paratha', 'breads', 'vegan', 'cooked', [230, 5, 33, 8.5, 3.5], [['piece', 120]], { oil: 7, allergens: WHEAT, raw: { atta: 40, potato_raw: 35, oil: 7 } }),
  food('puri', 'Puri', 'breads', 'vegan', 'cooked', [350, 6.5, 40, 18, 3], [['piece', 25]], { te: 'పూరీ', aka: ['poori'], allergens: WHEAT, raw: { atta: 60, oil: 18 } }),
  food('bread_white', 'Bread, white', 'breads', 'vegan', 'ready', [265, 9, 49, 3.2, 2.7], [['slice', 25]], { allergens: WHEAT }),
  food('bread_brown', 'Bread, brown/whole wheat', 'breads', 'vegan', 'ready', [250, 10, 43, 3.5, 6], [['slice', 28]], { allergens: WHEAT }),

  // ── South Indian breakfast ───────────────────────────────────────────────
  food('idli', 'Idli', 'breakfast', 'vegan', 'cooked', [130, 4, 27, 0.5, 1.5], [['piece', 40]], { te: 'ఇడ్లీ', aka: ['idly', 'iddly'], raw: { rice_raw: 30, urad_dal_raw: 10 } }),
  food('dosa', 'Dosa, plain', 'breakfast', 'vegan', 'cooked', [165, 3.9, 25, 5.5, 1.2], [['piece', 80]], { te: 'దోశ', aka: ['dosai', 'attu', 'plain dosa'], oil: 4, raw: { rice_raw: 28, urad_dal_raw: 9, oil: 4 } }),
  food('masala_dosa', 'Masala dosa', 'breakfast', 'vegan', 'cooked', [180, 3.6, 26, 7, 2], [['piece', 200]], { te: 'మసాలా దోశ', oil: 6, raw: { rice_raw: 18, urad_dal_raw: 6, potato_raw: 30, onion: 8, oil: 6 } }),
  food('pesarattu', 'Pesarattu (moong dosa)', 'breakfast', 'vegan', 'cooked', [160, 8, 22, 4.5, 4], [['piece', 90]], { te: 'పెసరట్టు', aka: ['pesaratu', 'moong dosa'], oil: 4, raw: { moong_whole_raw: 30, onion: 5, oil: 4 } }),
  food('upma', 'Upma (rava)', 'breakfast', 'vegan', 'cooked', [150, 3.8, 22, 5, 1.5], [['katori', 150], ['plate', 220]], { te: 'ఉప్మా', aka: ['uppittu'], oil: 4, allergens: WHEAT, raw: { rava: 25, onion: 8, oil: 4 } }),
  food('poha', 'Poha', 'breakfast', 'vegan', 'cooked', [165, 3, 27, 5, 1.5], [['katori', 150], ['plate', 200]], { te: 'అటుకుల ఉప్మా', aka: ['atukula upma', 'aval upma'], oil: 4, allergens: ['peanut'], raw: { poha_raw: 30, onion: 8, peanuts_raw: 3, oil: 4 } }),
  food('pongal', 'Pongal (ven pongal)', 'breakfast', 'vegetarian', 'cooked', [160, 4.5, 20, 7, 1], [['katori', 150]], { te: 'పొంగలి', aka: ['pongali', 'khara pongal'], allergens: MILK, raw: { rice_raw: 20, moong_dal_raw: 7, ghee: 6 } }),
  food('vada', 'Medu vada', 'breakfast', 'vegan', 'cooked', [290, 9, 25, 17, 5], [['piece', 45]], { te: 'వడ', aka: ['garelu', 'vadai', 'gare'], raw: { urad_dal_raw: 35, oil: 15 } }),
  food('uttapam', 'Uttapam', 'breakfast', 'vegan', 'cooked', [160, 4, 24, 5, 1.5], [['piece', 120]], { te: 'ఊతప్పం', aka: ['uthappam'], oil: 4, raw: { rice_raw: 25, urad_dal_raw: 8, onion: 10, tomato: 5, oil: 4 } }),

  // ── Dals, sambar, rasam ──────────────────────────────────────────────────
  food('pappu', 'Dal / pappu (toor, cooked)', 'dals', 'vegan', 'cooked', [110, 6, 15, 3, 3], [['katori', 150], ['ladle', 60]], { te: 'పప్పు', aka: ['dal', 'daal', 'kandi pappu'], oil: 2, raw: { toor_dal_raw: 22, oil: 2 } }),
  food('tomato_pappu', 'Tomato pappu', 'dals', 'vegan', 'cooked', [100, 5.5, 13, 3, 3], [['katori', 150], ['ladle', 60]], { te: 'టమాటా పప్పు', oil: 2, raw: { toor_dal_raw: 18, tomato: 15, oil: 2 } }),
  food('dal_tadka', 'Dal tadka', 'dals', 'vegan', 'cooked', [120, 6.5, 15, 4, 3], [['katori', 150], ['ladle', 60]], { aka: ['dal fry'], oil: 3, raw: { moong_dal_raw: 10, toor_dal_raw: 8, onion: 5, tomato: 5, oil: 3 } }),
  food('sambar', 'Sambar', 'dals', 'vegan', 'cooked', [70, 3, 9, 2.5, 2.5], [['katori', 150], ['ladle', 60]], { te: 'సాంబారు', aka: ['sambhar', 'sambaru'], oil: 2, raw: { toor_dal_raw: 7, mixed_veg_raw: 15, tomato: 8, oil: 2 } }),
  food('rasam', 'Rasam', 'dals', 'vegan', 'cooked', [35, 1, 4.5, 1.5, 0.6], [['katori', 150], ['ladle', 60]], { te: 'చారు', aka: ['charu', 'saaru'], oil: 1, raw: { toor_dal_raw: 2, tomato: 10, oil: 1 } }),
  food('rajma_curry', 'Rajma curry', 'dals', 'vegan', 'cooked', [140, 6, 17, 5, 5], [['katori', 150]], { oil: 4, raw: { rajma_raw: 30, onion: 10, tomato: 10, oil: 4 } }),
  food('chole', 'Chole / chana masala', 'dals', 'vegan', 'cooked', [160, 7, 20, 6, 6], [['katori', 150]], { aka: ['chana masala', 'chickpea curry'], oil: 5, raw: { chickpeas_raw: 33, onion: 10, tomato: 10, oil: 5 } }),
  food('sprouts', 'Moong sprouts', 'dals', 'vegan', 'cooked', [30, 3, 6, 0.2, 1.8], [['katori', 100]], { te: 'మొలకెత్తిన పెసలు', aka: ['molakalu', 'sprouts salad'], raw: { moong_whole_raw: 40 } }),

  // ── Vegetable dishes ─────────────────────────────────────────────────────
  food('palak_paneer', 'Palak paneer', 'vegetables', 'vegetarian', 'cooked', [150, 7, 6, 11, 2], [['katori', 150]], { oil: 5, allergens: MILK, raw: { spinach: 50, paneer: 25, onion: 8, oil: 5 } }),
  food('paneer_butter_masala', 'Paneer butter masala', 'vegetables', 'vegetarian', 'cooked', [230, 8, 9, 18, 1.5], [['katori', 150]], { aka: ['paneer curry'], oil: 8, allergens: MILK, raw: { paneer: 35, tomato: 25, butter: 3, onion: 8, oil: 8 } }),
  food('mixed_veg_curry', 'Mixed vegetable curry', 'vegetables', 'vegan', 'cooked', [100, 2.5, 10, 6, 3], [['katori', 150]], { aka: ['veg curry', 'kurma'], oil: 5, raw: { mixed_veg_raw: 70, onion: 10, tomato: 10, oil: 5 } }),
  food('aloo_fry', 'Potato fry', 'vegetables', 'vegan', 'cooked', [150, 2, 19, 7.5, 2], [['katori', 100], ['tbsp', 20]], { te: 'బంగాళదుంప వేపుడు', aka: ['aloo fry', 'bangaladumpa vepudu'], oil: 7, raw: { potato_raw: 85, oil: 7 } }),
  food('bhindi_fry', 'Bhindi / bendakaya fry', 'vegetables', 'vegan', 'cooked', [120, 2.5, 10, 8, 4], [['katori', 100], ['tbsp', 20]], { te: 'బెండకాయ వేపుడు', aka: ['bendakaya fry', 'okra fry'], oil: 7, raw: { okra: 90, oil: 7 } }),
  food('cabbage_curry', 'Cabbage koora / poriyal', 'vegetables', 'vegan', 'cooked', [80, 2, 7, 5, 3], [['katori', 100], ['tbsp', 20]], { te: 'క్యాబేజీ కూర', aka: ['cabbage koora', 'poriyal'], oil: 4, raw: { cabbage: 90, oil: 4 } }),
  food('brinjal_curry', 'Brinjal curry (gutti vankaya)', 'vegetables', 'vegan', 'cooked', [130, 2.5, 10, 9, 3.5], [['katori', 150]], { te: 'గుత్తి వంకాయ', aka: ['vankaya kura', 'baingan'], oil: 8, allergens: ['peanut'], raw: { brinjal: 80, onion: 8, peanuts_raw: 3, oil: 8 } }),
  food('dondakaya_fry', 'Ivy gourd / dondakaya fry', 'vegetables', 'vegan', 'cooked', [110, 2, 8, 8, 3], [['katori', 100], ['tbsp', 20]], { te: 'దొండకాయ వేపుడు', aka: ['tindora fry'], oil: 7, raw: { ivy_gourd: 90, oil: 7 } }),
  food('salad', 'Salad (cucumber, tomato, onion)', 'vegetables', 'vegan', 'raw', [20, 0.8, 4, 0.2, 1.2], [['katori', 100], ['plate', 150]], { aka: ['kachumber'], raw: { cucumber: 35, tomato: 35, onion: 30 } }),

  // ── Chutneys ─────────────────────────────────────────────────────────────
  food('coconut_chutney', 'Coconut chutney', 'chutneys', 'vegan', 'cooked', [190, 3, 8, 16, 4], [['tbsp', 15]], { te: 'కొబ్బరి చట్నీ', aka: ['kobbari pachadi'], allergens: ['tree_nut'], raw: { coconut_fresh: 50, chana_dal_raw: 8, oil: 2 } }),
  food('peanut_chutney', 'Peanut chutney', 'chutneys', 'vegan', 'cooked', [270, 10, 12, 21, 4], [['tbsp', 15]], { te: 'పల్లీ చట్నీ', aka: ['palli chutney', 'verusanaga pachadi'], allergens: ['peanut'], raw: { peanuts_raw: 45, oil: 2 } }),
  food('tomato_chutney', 'Tomato chutney', 'chutneys', 'vegan', 'cooked', [90, 1.5, 9, 5.5, 1.5], [['tbsp', 15]], { te: 'టమాటా పచ్చడి', aka: ['tamata pachadi'], oil: 5, raw: { tomato: 80, oil: 5 } }),

  // ── Non-veg dishes ───────────────────────────────────────────────────────
  food('chicken_curry', 'Chicken curry', 'nonveg', 'nonveg', 'cooked', [150, 14, 4, 9, 0.8], [['katori', 150], ['ladle', 80]], { te: 'కోడి కూర', aka: ['kodi kura', 'chicken gravy'], oil: 6, raw: { chicken_raw: 55, onion: 15, tomato: 10, oil: 6 } }),
  food('chicken_fry', 'Chicken fry (dry)', 'nonveg', 'nonveg', 'cooked', [220, 22, 5, 13, 0.5], [['katori', 100], ['piece', 40]], { te: 'చికెన్ వేపుడు', aka: ['chicken vepudu', 'chicken 65'], oil: 9, raw: { chicken_raw: 80, oil: 9 } }),
  food('tandoori_chicken', 'Tandoori chicken', 'nonveg', 'nonveg', 'cooked', [150, 24, 3, 5, 0], [['piece', 120], ['g', 1]], { allergens: MILK, raw: { chicken_raw: 90, curd: 10 } }),
  food('grilled_chicken', 'Chicken breast, grilled', 'nonveg', 'nonveg', 'cooked', [165, 31, 0, 3.6, 0], [['piece', 120], ['g', 1]], { raw: { chicken_raw: 130 } }),
  food('mutton_curry', 'Mutton curry', 'nonveg', 'nonveg', 'cooked', [188, 15, 4, 12.5, 0.8], [['katori', 150]], { te: 'మటన్ కూర', aka: ['mamsam kura', 'gosht'], oil: 7, raw: { mutton_raw: 55, onion: 15, tomato: 10, oil: 7 } }),
  food('fish_curry', 'Fish curry / pulusu', 'nonveg', 'nonveg', 'cooked', [120, 13, 4, 6, 0.6], [['katori', 150]], { te: 'చేపల పులుసు', aka: ['chepala pulusu', 'fish gravy'], oil: 5, allergens: ['fish'], raw: { fish_raw: 50, onion: 10, tomato: 10, oil: 5 } }),
  food('fish_fry', 'Fish fry', 'nonveg', 'nonveg', 'cooked', [200, 18, 6, 11, 0.3], [['piece', 80]], { te: 'చేపల వేపుడు', aka: ['chepa fry'], oil: 9, allergens: ['fish'], raw: { fish_raw: 85, oil: 9 } }),
  food('prawn_curry', 'Prawn curry', 'nonveg', 'nonveg', 'cooked', [120, 13, 4, 6, 0.6], [['katori', 150]], { te: 'రొయ్యల కూర', aka: ['royyala kura'], oil: 5, allergens: ['shellfish'], raw: { prawns_raw: 50, onion: 10, tomato: 10, oil: 5 } }),

  // ── Eggs ─────────────────────────────────────────────────────────────────
  food('egg_raw', 'Egg, whole (raw)', 'raw', 'egg', 'raw', [143, 12.6, 0.7, 9.5, 0], [['piece', 50]], { te: 'గుడ్డు', aka: ['guddu', 'anda'], allergens: ['egg'] }),
  food('boiled_egg', 'Egg, boiled', 'eggs', 'egg', 'cooked', [155, 12.6, 1.1, 10.6, 0], [['piece', 50]], { te: 'ఉడికించిన గుడ్డు', aka: ['guddu', 'anda', 'boiled egg'], allergens: ['egg'], raw: { egg_raw: 100 } }),
  food('egg_white', 'Egg white, boiled', 'eggs', 'egg', 'cooked', [52, 11, 0.7, 0.2, 0], [['piece', 33]], { allergens: ['egg'], raw: { egg_raw: 150 } }),
  food('omelette', 'Omelette', 'eggs', 'egg', 'cooked', [190, 11, 1.5, 15.5, 0.3], [['piece', 60]], { te: 'ఆమ్లెట్', aka: ['omlet', 'egg omelette'], oil: 6, allergens: ['egg'], raw: { egg_raw: 85, onion: 5, oil: 6 } }),
  food('egg_bhurji', 'Egg bhurji', 'eggs', 'egg', 'cooked', [200, 11, 3, 16, 0.5], [['katori', 100]], { aka: ['egg scramble', 'guddu porutu'], oil: 8, allergens: ['egg'], raw: { egg_raw: 80, onion: 10, oil: 8 } }),
  food('egg_curry', 'Egg curry', 'eggs', 'egg', 'cooked', [142, 8, 5, 10, 1], [['katori', 150]], { te: 'గుడ్డు కూర', aka: ['guddu kura', 'anda curry'], oil: 6, allergens: ['egg'], raw: { egg_raw: 50, onion: 15, tomato: 15, oil: 6 } }),

  // ── Dairy ────────────────────────────────────────────────────────────────
  food('paneer', 'Paneer', 'dairy', 'vegetarian', 'ready', [265, 18.3, 1.2, 20.8, 0], [['piece', 25], ['g', 1]], { te: 'పనీర్', allergens: MILK }),
  food('milk_toned', 'Milk, toned (3% fat)', 'dairy', 'vegetarian', 'ready', [58, 3.1, 4.7, 3, 0], [['glass', 250], ['cup', 150]], { te: 'పాలు', aka: ['paalu', 'doodh'], allergens: MILK }),
  food('milk_full', 'Milk, full cream (6% fat)', 'dairy', 'vegetarian', 'ready', [86, 3.2, 4.8, 6, 0], [['glass', 250], ['cup', 150]], { aka: ['whole milk', 'buffalo milk'], allergens: MILK }),
  food('curd', 'Curd / yogurt', 'dairy', 'vegetarian', 'ready', [60, 3.1, 4.4, 3.1, 0], [['katori', 100], ['cup', 200]], { te: 'పెరుగు', aka: ['perugu', 'dahi', 'yogurt'], allergens: MILK }),
  food('buttermilk', 'Buttermilk (spiced)', 'drinks', 'vegetarian', 'ready', [25, 1.4, 2, 1.1, 0], [['glass', 250]], { te: 'మజ్జిగ', aka: ['majjiga', 'chaas'], allergens: MILK, raw: { curd: 30 } }),
  food('lassi_sweet', 'Lassi, sweet', 'drinks', 'vegetarian', 'ready', [90, 3, 14, 2.5, 0], [['glass', 250]], { allergens: MILK, raw: { curd: 50, sugar: 8 } }),

  // ── Drinks ───────────────────────────────────────────────────────────────
  food('tea', 'Tea with milk and sugar', 'drinks', 'vegetarian', 'ready', [55, 1.5, 8, 1.8, 0], [['cup', 120]], { te: 'టీ', aka: ['chai', 'chaay'], allergens: MILK, raw: { milk_toned: 45, sugar: 6 } }),
  food('coffee', 'Filter coffee with milk and sugar', 'drinks', 'vegetarian', 'ready', [60, 2, 8, 2, 0], [['cup', 120]], { te: 'కాఫీ', aka: ['kaapi'], allergens: MILK, raw: { milk_toned: 60, sugar: 6 } }),
  food('black_coffee', 'Black coffee / tea, no sugar', 'drinks', 'vegan', 'ready', [2, 0.1, 0.3, 0, 0], [['cup', 150]]),
  food('coconut_water', 'Coconut water', 'drinks', 'vegan', 'ready', [19, 0.7, 3.7, 0.2, 1.1], [['glass', 250]], { te: 'కొబ్బరి నీళ్లు', aka: ['kobbari neellu', 'tender coconut'] }),
  food('cola', 'Soft drink (cola)', 'drinks', 'vegan', 'ready', [42, 0, 10.6, 0, 0], [['glass', 250], ['piece', 330]], { aka: ['coke', 'pepsi', 'cool drink'] }),

  // ── Fruits ───────────────────────────────────────────────────────────────
  food('banana', 'Banana', 'fruits', 'vegan', 'raw', [89, 1.1, 22.8, 0.3, 2.6], [['piece', 100]], { te: 'అరటిపండు', aka: ['arati pandu', 'kela'] }),
  food('apple', 'Apple', 'fruits', 'vegan', 'raw', [52, 0.3, 13.8, 0.2, 2.4], [['piece', 150]], { te: 'ఆపిల్' }),
  food('mango', 'Mango', 'fruits', 'vegan', 'raw', [60, 0.8, 15, 0.4, 1.6], [['piece', 200], ['cup', 165]], { te: 'మామిడిపండు', aka: ['mamidi pandu', 'aam'] }),
  food('papaya', 'Papaya', 'fruits', 'vegan', 'raw', [43, 0.5, 10.8, 0.3, 1.7], [['cup', 145]], { te: 'బొప్పాయి', aka: ['boppayi'] }),
  food('guava', 'Guava', 'fruits', 'vegan', 'raw', [68, 2.6, 14.3, 1, 5.4], [['piece', 100]], { te: 'జామపండు', aka: ['jama pandu', 'amrood'] }),
  food('orange', 'Orange', 'fruits', 'vegan', 'raw', [47, 0.9, 11.8, 0.1, 2.4], [['piece', 130]], { te: 'కమలాపండు', aka: ['kamala pandu', 'santra'] }),
  food('watermelon', 'Watermelon', 'fruits', 'vegan', 'raw', [30, 0.6, 7.6, 0.2, 0.4], [['cup', 150]], { te: 'పుచ్చకాయ', aka: ['puchakaya'] }),
  food('pomegranate', 'Pomegranate seeds', 'fruits', 'vegan', 'raw', [83, 1.7, 18.7, 1.2, 4], [['katori', 100]], { te: 'దానిమ్మ', aka: ['danimma', 'anar'] }),
  food('grapes', 'Grapes', 'fruits', 'vegan', 'raw', [69, 0.7, 18, 0.2, 0.9], [['cup', 150]], { te: 'ద్రాక్ష', aka: ['draksha'] }),
  food('sapota', 'Sapota / chikoo', 'fruits', 'vegan', 'raw', [83, 0.4, 20, 1.1, 5.3], [['piece', 100]], { te: 'సపోటా', aka: ['chikoo'] }),

  // ── Snacks ───────────────────────────────────────────────────────────────
  food('roasted_chana', 'Roasted chana (putnalu)', 'snacks', 'vegan', 'ready', [370, 20, 58, 5.5, 15], [['handful', 30]], { te: 'పుట్నాలు', aka: ['putnalu', 'bhuna chana', 'roasted gram'] }),
  food('peanuts_roasted', 'Peanuts, roasted', 'snacks', 'vegan', 'ready', [585, 24, 21, 50, 8.5], [['handful', 30]], { te: 'వేయించిన పల్లీలు', aka: ['palli', 'groundnuts'], allergens: ['peanut'], raw: { peanuts_raw: 100 } }),
  food('almonds', 'Almonds', 'snacks', 'vegan', 'raw', [579, 21, 22, 50, 12.5], [['handful', 20], ['piece', 1.2]], { te: 'బాదం', aka: ['badam'], allergens: ['tree_nut'] }),
  food('samosa', 'Samosa', 'snacks', 'vegan', 'ready', [290, 5, 32, 16, 3], [['piece', 70]], { allergens: WHEAT }),
  food('mirchi_bajji', 'Mirchi bajji', 'snacks', 'vegan', 'ready', [230, 4, 22, 14, 3], [['piece', 50]], { te: 'మిర్చి బజ్జీ', aka: ['bajji', 'bhajji'] }),
  food('onion_pakoda', 'Onion pakoda', 'snacks', 'vegan', 'ready', [315, 7, 32, 18, 4], [['handful', 50], ['plate', 100]], { te: 'ఉల్లి పకోడి', aka: ['pakodi', 'pakora'] }),
  food('murukku', 'Murukku / chakli', 'snacks', 'vegan', 'ready', [500, 8, 55, 27, 3], [['piece', 15]], { te: 'జంతికలు', aka: ['janthikalu', 'chakli'] }),
  food('marie_biscuit', 'Marie biscuits', 'snacks', 'vegetarian', 'ready', [440, 7, 76, 12, 2], [['piece', 7]], { aka: ['biscuit'], allergens: [...WHEAT, ...MILK] }),
  food('veg_noodles', 'Veg noodles (hakka)', 'snacks', 'vegan', 'ready', [170, 4, 25, 6, 1.5], [['plate', 250]], { aka: ['chowmein'], allergens: WHEAT }),
  food('pizza', 'Pizza, cheese', 'snacks', 'vegetarian', 'ready', [266, 11, 33, 10, 2.3], [['slice', 100]], { allergens: [...WHEAT, ...MILK] }),
  food('veg_burger', 'Veg burger', 'snacks', 'vegetarian', 'ready', [240, 6, 33, 9, 2.5], [['piece', 150]], { allergens: [...WHEAT, ...MILK] }),

  // ── Sweets ───────────────────────────────────────────────────────────────
  food('gulab_jamun', 'Gulab jamun', 'sweets', 'vegetarian', 'ready', [320, 5, 50, 12, 0.5], [['piece', 40]], { allergens: [...MILK, ...WHEAT] }),
  food('payasam', 'Kheer / payasam', 'sweets', 'vegetarian', 'cooked', [140, 3.8, 20, 5, 0.3], [['katori', 150]], { te: 'పాయసం', aka: ['kheer', 'payasam'], allergens: MILK, raw: { milk_toned: 75, rice_raw: 5, sugar: 8 } }),
  food('besan_laddu', 'Besan laddu', 'sweets', 'vegetarian', 'ready', [460, 8, 55, 23, 3], [['piece', 40]], { te: 'లడ్డూ', aka: ['laddoo', 'laddu'], allergens: MILK }),
  // ── Regional dishes added in v1.3 (approximate home recipes) ─────────────
  food('gongura_pachadi', 'Gongura pachadi (sorrel chutney)', 'chutneys', 'vegan', 'cooked', [132, 2.5, 8, 10, 4], [['tbsp', 15]], { te: 'గోంగూర పచ్చడి', aka: ['gongura chutney', 'gongura pickle'], oil: 8 }),
  food('avakaya', 'Avakaya (mango pickle)', 'chutneys', 'vegan', 'ready', [192, 1.5, 6, 18, 3], [['tsp', 5], ['tbsp', 15]], { te: 'ఆవకాయ', aka: ['avakai', 'mango pickle', 'aavakaaya'] }),
  food('ragi_dosa', 'Ragi dosa', 'breakfast', 'vegan', 'cooked', [156, 4, 26, 4, 4], [['piece', 70]], { te: 'రాగి దోశ', aka: ['finger millet dosa'], oil: 3 }),
  food('rava_dosa', 'Rava dosa', 'breakfast', 'vegan', 'cooked', [191, 4, 28, 7, 1.5], [['piece', 80]], { te: 'రవ్వ దోశ', aka: ['ravva dosa'], allergens: ['gluten'], oil: 6 }),
  food('egg_dosa', 'Egg dosa', 'breakfast', 'egg', 'cooked', [209, 8, 24, 9, 1], [['piece', 100]], { te: 'ఎగ్ దోశ', aka: ['guddu dosa', 'egg dose'], allergens: ['egg'], oil: 5 }),
  food('punugulu', 'Punugulu', 'snacks', 'vegan', 'ready', [248, 5, 30, 12, 1.5], [['piece', 15], ['plate', 120]], { te: 'పునుగులు', aka: ['punukulu'] }),
  food('mysore_bonda', 'Mysore bonda', 'snacks', 'vegetarian', 'ready', [257, 5, 30, 13, 1.5], [['piece', 30]], { te: 'మైసూర్ బోండా', aka: ['mysore bajji', 'bonda'], allergens: ['gluten', 'milk'] }),
  food('appam', 'Appam', 'breakfast', 'vegan', 'cooked', [157, 2.5, 30, 3, 1], [['piece', 60]], { te: 'అప్పం', aka: ['aappam', 'hoppers'] }),
  food('idiyappam', 'Idiyappam (string hoppers)', 'breakfast', 'vegan', 'cooked', [146, 2.5, 33, 0.5, 1], [['piece', 40]], { te: 'ఇడియప్పం', aka: ['string hoppers', 'sevai'] }),
  food('kerala_parotta', 'Kerala parotta', 'breads', 'vegetarian', 'cooked', [343, 7, 45, 15, 2], [['piece', 80]], { te: 'పరోటా', aka: ['malabar parotta', 'porotta', 'barotta'], allergens: ['gluten'], oil: 10 }),
  food('bhatura', 'Bhatura', 'breads', 'vegetarian', 'cooked', [343, 7, 45, 15, 2], [['piece', 80]], { te: 'భటూరా', aka: ['bhature', 'chole bhature'], allergens: ['gluten', 'milk'], oil: 10 }),
  food('jowar_roti', 'Jowar roti (jonna rotte)', 'breads', 'vegan', 'cooked', [234, 7, 47, 2, 6], [['piece', 50]], { te: 'జొన్న రొట్టె', aka: ['jonna rotte', 'jowar bhakri'] }),
  food('bajra_roti', 'Bajra roti (sajja rotte)', 'breads', 'vegan', 'cooked', [244, 7, 45, 4, 7], [['piece', 50]], { te: 'సజ్జ రొట్టె', aka: ['sajja rotte', 'bajra bhakri'] }),
  food('thepla', 'Methi thepla', 'breads', 'vegetarian', 'cooked', [290, 8, 42, 10, 6], [['piece', 40]], { te: 'మెంతి థెప్లా', aka: ['thepla'], allergens: ['gluten', 'milk'], oil: 6 }),
  food('pav', 'Pav / bun', 'breads', 'vegetarian', 'ready', [272, 9, 50, 4, 2], [['piece', 35]], { te: 'పావ్', aka: ['ladi pav', 'bun'], allergens: ['gluten', 'milk'] }),
  food('tomato_rice', 'Tomato rice', 'grains', 'vegan', 'cooked', [165, 3, 27, 5, 1.2], [['katori', 150], ['plate', 250]], { te: 'టమాటా అన్నం', aka: ['tomato bath', 'thakkali sadam'], oil: 4 }),
  food('coconut_rice', 'Coconut rice', 'grains', 'vegan', 'cooked', [193, 3, 25, 9, 2], [['katori', 150], ['plate', 250]], { te: 'కొబ్బరి అన్నం', aka: ['kobbari annam', 'thengai sadam'], oil: 4 }),
  food('bagara_rice', 'Bagara rice', 'grains', 'vegan', 'cooked', [169, 3, 28, 5, 0.8], [['katori', 150], ['plate', 250]], { te: 'బగారా అన్నం', aka: ['bagara khana', 'bagaara rice'], oil: 4 }),
  food('khichdi', 'Khichdi (rice and moong dal)', 'grains', 'vegetarian', 'cooked', [117, 4.5, 18, 3, 2], [['katori', 200], ['plate', 300]], { te: 'కిచిడీ', aka: ['kichdi', 'khichri'], allergens: ['milk'] }),
  food('egg_fried_rice', 'Egg fried rice', 'grains', 'egg', 'cooked', [178, 6, 25, 6, 1], [['plate', 300], ['katori', 150]], { te: 'ఎగ్ ఫ్రైడ్ రైస్', aka: ['egg rice'], allergens: ['egg', 'soy'], oil: 5 }),
  food('chicken_fried_rice', 'Chicken fried rice', 'grains', 'nonveg', 'cooked', [182, 8, 24, 6, 1], [['plate', 300], ['katori', 150]], { te: 'చికెన్ ఫ్రైడ్ రైస్', allergens: ['egg', 'soy'], oil: 5 }),
  food('chicken_pulao', 'Chicken pulao', 'grains', 'nonveg', 'cooked', [187, 9, 22, 7, 1], [['plate', 300], ['katori', 150]], { te: 'కోడి పులావ్', aka: ['kodi pulao'], oil: 5 }),
  food('mutton_biryani', 'Mutton biryani', 'grains', 'nonveg', 'cooked', [205, 9, 22, 9, 1], [['plate', 350], ['katori', 150]], { te: 'మటన్ బిర్యానీ', aka: ['mutton biriyani'], allergens: ['milk'], oil: 6 }),
  food('egg_biryani', 'Egg biryani', 'grains', 'egg', 'cooked', [187, 7, 24, 7, 1], [['plate', 350], ['katori', 150]], { te: 'ఎగ్ బిర్యానీ', aka: ['anda biryani'], allergens: ['egg', 'milk'], oil: 5 }),
  food('pappu_charu', 'Pappu charu', 'dals', 'vegan', 'cooked', [46, 2, 5, 2, 1.5], [['katori', 150], ['ladle', 60]], { te: 'పప్పు చారు', aka: ['pappucharu', 'dal rasam'], oil: 1.5 }),
  food('ulava_charu', 'Ulava charu (horse gram soup)', 'dals', 'vegan', 'cooked', [87, 5, 10, 3, 3], [['katori', 150], ['ladle', 60]], { te: 'ఉలవ చారు', aka: ['ulavacharu', 'horse gram rasam'], oil: 2 }),
  food('dal_makhani', 'Dal makhani', 'dals', 'vegetarian', 'cooked', [139, 6, 13, 7, 4], [['katori', 150], ['ladle', 60]], { te: 'దాల్ మఖనీ', aka: ['dal makhni'], allergens: ['milk'] }),
  food('chana_chaat', 'Chana chaat', 'snacks', 'vegan', 'ready', [135, 7, 20, 3, 6], [['katori', 150]], { te: 'శనగల చాట్', aka: ['chickpea salad', 'chana salad'] }),
  food('majjiga_pulusu', 'Majjiga pulusu (buttermilk curry)', 'vegetables', 'vegetarian', 'cooked', [64, 2, 5, 4, 1], [['katori', 150], ['ladle', 60]], { te: 'మజ్జిగ పులుసు', aka: ['mor kuzhambu', 'majjiga charu'], allergens: ['milk'], oil: 3 }),
  food('kadhi_pakora', 'Kadhi pakora', 'vegetables', 'vegetarian', 'cooked', [100, 3.5, 8, 6, 1], [['katori', 150]], { te: 'కఢీ పకోడా', aka: ['kadhi'], allergens: ['milk'] }),
  food('aloo_gobi', 'Aloo gobi', 'vegetables', 'vegan', 'cooked', [112, 2.5, 12, 6, 3], [['katori', 150]], { te: 'ఆలూ గోబీ', aka: ['potato cauliflower curry'], oil: 5 }),
  food('baingan_bharta', 'Baingan bharta', 'vegetables', 'vegan', 'cooked', [94, 2, 8, 6, 3.5], [['katori', 150]], { te: 'వంకాయ భర్తా', aka: ['vankaya pachadi', 'brinjal mash'], oil: 5 }),
  food('matar_paneer', 'Matar paneer', 'vegetables', 'vegetarian', 'cooked', [159, 7, 8, 11, 2.5], [['katori', 150]], { te: 'మటర్ పనీర్', aka: ['mutter paneer'], allergens: ['milk'], oil: 5 }),
  food('mirchi_salan', 'Mirchi ka salan', 'vegetables', 'vegan', 'cooked', [174, 3, 9, 14, 3], [['katori', 100]], { te: 'మిర్చి కా సాలన్', aka: ['mirchi salan'], allergens: ['peanut', 'sesame'], oil: 8 }),
  food('avial', 'Avial', 'vegetables', 'vegetarian', 'cooked', [118, 2.5, 9, 8, 3], [['katori', 150]], { te: 'అవియల్', aka: ['aviyal'], allergens: ['milk'], oil: 3 }),
  food('veg_kurma', 'Vegetable kurma', 'vegetables', 'vegan', 'cooked', [129, 3, 9, 9, 2.5], [['katori', 150]], { te: 'వెజ్ కుర్మా', aka: ['veg korma', 'kurma'], oil: 5 }),
  food('pav_bhaji', 'Pav bhaji (bhaji only)', 'vegetables', 'vegetarian', 'cooked', [131, 3, 14, 7, 3], [['katori', 150]], { te: 'పావ్ భాజీ', aka: ['bhaji'], allergens: ['milk'] }),
  food('soya_curry', 'Soya chunks curry', 'vegetables', 'vegan', 'cooked', [134, 12, 8, 6, 4], [['katori', 150]], { te: 'సోయా కూర', aka: ['meal maker curry', 'soya chunks'], allergens: ['soy'], oil: 5 }),
  food('sweet_corn', 'Sweet corn, boiled', 'vegetables', 'vegan', 'cooked', [111, 3.4, 21, 1.5, 2.4], [['cup', 150]], { te: 'మొక్కజొన్న', aka: ['bhutta', 'corn', 'mokkajonna'] }),
  food('paneer_tikka', 'Paneer tikka', 'vegetables', 'vegetarian', 'cooked', [228, 15, 6, 16, 1], [['piece', 30], ['plate', 150]], { te: 'పనీర్ టిక్కా', allergens: ['milk'], oil: 4 }),
  food('gongura_mutton', 'Gongura mutton', 'nonveg', 'nonveg', 'cooked', [176, 13, 4, 12, 1.5], [['katori', 150], ['ladle', 80]], { te: 'గోంగూర మటన్', aka: ['gongura mamsam'], oil: 7 }),
  food('haleem', 'Haleem', 'nonveg', 'nonveg', 'cooked', [156, 9, 12, 8, 2], [['katori', 200]], { te: 'హలీం', aka: ['haleem hyderabadi'], allergens: ['gluten', 'milk'] }),
  food('chicken_65', 'Chicken 65', 'nonveg', 'nonveg', 'cooked', [229, 18, 10, 13, 0.5], [['katori', 100], ['piece', 20]], { te: 'చికెన్ 65', aka: ['chicken sixty five'], allergens: ['gluten', 'egg'] }),
  food('apollo_fish', 'Apollo fish', 'nonveg', 'nonveg', 'cooked', [212, 17, 9, 12, 0.5], [['katori', 100], ['piece', 25]], { te: 'అపోలో ఫిష్', allergens: ['fish', 'gluten', 'egg'] }),
  food('prawn_fry', 'Prawn fry (royyala vepudu)', 'nonveg', 'nonveg', 'cooked', [177, 20, 4, 9, 0.5], [['katori', 100]], { te: 'రొయ్యల వేపుడు', aka: ['royyala vepudu'], allergens: ['shellfish'], oil: 7 }),
  food('chicken_shawarma', 'Chicken shawarma roll', 'nonveg', 'nonveg', 'ready', [235, 12, 22, 11, 1.5], [['piece', 250]], { te: 'చికెన్ షవర్మా', aka: ['shawarma'], allergens: ['gluten', 'egg', 'sesame'] }),
  food('chicken_momos', 'Chicken momos (steamed)', 'nonveg', 'nonveg', 'cooked', [181, 9, 25, 5, 1], [['piece', 30], ['plate', 240]], { te: 'చికెన్ మోమోస్', allergens: ['gluten'] }),
  food('veg_momos', 'Veg momos (steamed)', 'snacks', 'vegan', 'cooked', [159, 5, 28, 3, 2], [['piece', 30], ['plate', 240]], { te: 'వెజ్ మోమోస్', aka: ['momo'], allergens: ['gluten'] }),
  food('vada_pav', 'Vada pav', 'snacks', 'vegetarian', 'ready', [283, 6, 40, 11, 3], [['piece', 130]], { te: 'వడా పావ్', aka: ['wada pav'], allergens: ['gluten', 'milk'] }),
  food('dhokla', 'Dhokla', 'snacks', 'vegan', 'ready', [152, 7, 22, 4, 2], [['piece', 30]], { te: 'ఢోక్లా', aka: ['khaman'] }),
  food('sabudana_khichdi', 'Sabudana khichdi', 'breakfast', 'vegan', 'cooked', [232, 2, 38, 8, 1], [['katori', 150]], { te: 'సగ్గుబియ్యం కిచిడీ', aka: ['saggubiyyam', 'sago khichdi'], allergens: ['peanut'] }),
  food('pani_puri', 'Pani puri / golgappa', 'snacks', 'vegan', 'ready', [195, 3, 30, 7, 3], [['piece', 25], ['plate', 150]], { te: 'పానీ పూరీ', aka: ['golgappa', 'puchka'], allergens: ['gluten'] }),
  food('bhel_puri', 'Bhel puri', 'snacks', 'vegan', 'ready', [232, 5, 35, 8, 3], [['plate', 150]], { te: 'భేల్ పూరీ', aka: ['bhel', 'bhelpuri'], allergens: ['peanut', 'gluten'] }),
  food('instant_noodles', 'Instant noodles, cooked', 'snacks', 'vegetarian', 'cooked', [148, 3.5, 20, 6, 1], [['plate', 260]], { te: 'నూడుల్స్', aka: ['maggi', 'maggie'], allergens: ['gluten'] }),
  food('veg_sandwich', 'Veg sandwich', 'snacks', 'vegetarian', 'ready', [198, 6, 30, 6, 3], [['piece', 130]], { te: 'వెజ్ శాండ్‌విచ్', aka: ['sandwich'], allergens: ['gluten', 'milk'] }),
  food('rasgulla', 'Rasgulla', 'sweets', 'vegetarian', 'ready', [192, 4, 36, 3.5, 0], [['piece', 50]], { te: 'రసగుల్లా', aka: ['rosogolla', 'rasagulla'], allergens: ['milk'] }),
  food('jalebi', 'Jalebi', 'sweets', 'vegetarian', 'ready', [387, 3, 60, 15, 0.5], [['piece', 25]], { te: 'జిలేబీ', aka: ['jilebi'], allergens: ['gluten'] }),
  food('kaju_katli', 'Kaju katli', 'sweets', 'vegetarian', 'ready', [465, 10, 50, 25, 1.5], [['piece', 15]], { te: 'కాజు కట్లీ', aka: ['kaju barfi'], allergens: ['tree_nut'] }),
  food('rava_kesari', 'Rava kesari / sooji halwa', 'sweets', 'vegetarian', 'ready', [300, 3, 45, 12, 0.5], [['katori', 100]], { te: 'రవ్వ కేసరి', aka: ['kesari bath', 'sheera'], allergens: ['gluten', 'milk', 'tree_nut'] }),
  food('gajar_halwa', 'Gajar halwa', 'sweets', 'vegetarian', 'ready', [248, 5, 30, 12, 2], [['katori', 100]], { te: 'క్యారెట్ హల్వా', aka: ['carrot halwa'], allergens: ['milk', 'tree_nut'] }),
  food('double_ka_meetha', 'Double ka meetha', 'sweets', 'vegetarian', 'ready', [339, 6, 45, 15, 1], [['katori', 100]], { te: 'డబుల్ కా మీఠా', aka: ['bread halwa'], allergens: ['gluten', 'milk', 'tree_nut'] }),
  food('bobbatlu', 'Bobbatlu / puran poli', 'sweets', 'vegetarian', 'ready', [338, 7, 55, 10, 4], [['piece', 70]], { te: 'బొబ్బట్లు', aka: ['obbattu', 'puran poli', 'polelu'], allergens: ['gluten', 'milk'] }),
  food('pootharekulu', 'Pootharekulu', 'sweets', 'vegetarian', 'ready', [387, 3, 60, 15, 1], [['piece', 30]], { te: 'పూతరేకులు', aka: ['putharekulu'], allergens: ['milk'] }),
  food('ariselu', 'Ariselu', 'sweets', 'vegan', 'ready', [414, 3, 60, 18, 1], [['piece', 40]], { te: 'అరిసెలు', aka: ['adhirasam', 'arisa'], allergens: ['sesame'] }),
  food('sakinalu', 'Sakinalu', 'snacks', 'vegan', 'ready', [446, 7, 55, 22, 3], [['piece', 20]], { te: 'సకినాలు', aka: ['chakinalu'], allergens: ['sesame'] }),
  food('mosambi', 'Sweet lime / mosambi', 'fruits', 'vegan', 'raw', [43, 0.8, 9.3, 0.3, 0.7], [['piece', 150]], { te: 'బత్తాయి', aka: ['battayi', 'sweet lime'] }),
  food('pineapple', 'Pineapple', 'fruits', 'vegan', 'raw', [55, 0.5, 13, 0.1, 1.4], [['cup', 165], ['slice', 80]], { te: 'అనాస', aka: ['anasa'] }),
];

const byId = new Map(FOODS.map((f) => [f.id, f]));

export function getFood(id: string): Food | undefined {
  return byId.get(id);
}

export function requireFood(id: string): Food {
  const f = byId.get(id);
  if (!f) throw new Error(`Unknown food: ${id}`);
  return f;
}
