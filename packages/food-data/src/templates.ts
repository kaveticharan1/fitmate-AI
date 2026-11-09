/**
 * Meal templates: common Indian plates with a base portion (grams) sized for
 * roughly a 1,800 kcal day. The planner scales them to each person's target.
 */
export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export interface MealTemplate {
  id: string;
  slot: MealSlot;
  items: [foodId: string, grams: number][];
  /** Takes 15 minutes or less to prepare. */
  quick?: boolean;
  /** Costlier ingredients (mutton, prawns, paneer dishes); skipped on a tight budget. */
  premium?: boolean;
}

export const TEMPLATES: MealTemplate[] = [
  // Breakfast
  { id: 'b_idli_sambar', slot: 'breakfast', items: [['idli', 120], ['sambar', 150], ['coconut_chutney', 15]] },
  { id: 'b_pesarattu', slot: 'breakfast', items: [['pesarattu', 180], ['peanut_chutney', 15]] },
  { id: 'b_upma', slot: 'breakfast', items: [['upma', 200], ['peanut_chutney', 15]], quick: true },
  { id: 'b_poha_curd', slot: 'breakfast', items: [['poha', 200], ['curd', 100]], quick: true },
  { id: 'b_dosa_sambar', slot: 'breakfast', items: [['dosa', 160], ['sambar', 150], ['coconut_chutney', 15]] },
  { id: 'b_oats_banana', slot: 'breakfast', items: [['oats_porridge', 240], ['banana', 100]], quick: true },
  { id: 'b_eggs_toast', slot: 'breakfast', items: [['boiled_egg', 100], ['bread_brown', 56], ['banana', 100]], quick: true },
  { id: 'b_omelette_chapati', slot: 'breakfast', items: [['omelette', 120], ['phulka', 70]], quick: true },
  { id: 'b_pongal_sambar', slot: 'breakfast', items: [['pongal', 180], ['sambar', 100]] },
  { id: 'b_aloo_paratha_curd', slot: 'breakfast', items: [['aloo_paratha', 120], ['curd', 100]] },
  { id: 'b_uttapam', slot: 'breakfast', items: [['uttapam', 240], ['tomato_chutney', 15]] },
  { id: 'b_sprouts_eggs', slot: 'breakfast', items: [['sprouts', 150], ['boiled_egg', 100], ['phulka', 35]], quick: true },

  // Lunch
  { id: 'l_rice_pappu', slot: 'lunch', items: [['rice_cooked', 200], ['pappu', 150], ['cabbage_curry', 100], ['curd', 100]] },
  { id: 'l_rice_sambar_bhindi', slot: 'lunch', items: [['rice_cooked', 200], ['sambar', 150], ['bhindi_fry', 80], ['curd', 100]] },
  { id: 'l_rice_chicken', slot: 'lunch', items: [['rice_cooked', 200], ['chicken_curry', 180], ['salad', 100]] },
  { id: 'l_chapati_dal_veg', slot: 'lunch', items: [['phulka', 105], ['dal_tadka', 150], ['mixed_veg_curry', 120], ['curd', 100]] },
  { id: 'l_chapati_palak_paneer', slot: 'lunch', items: [['phulka', 105], ['palak_paneer', 180], ['salad', 100]], premium: true },
  { id: 'l_rajma_rice', slot: 'lunch', items: [['rice_cooked', 180], ['rajma_curry', 180], ['salad', 100]] },
  { id: 'l_rice_fish', slot: 'lunch', items: [['rice_cooked', 200], ['fish_curry', 180], ['cabbage_curry', 80]] },
  { id: 'l_rice_egg_curry', slot: 'lunch', items: [['rice_cooked', 200], ['egg_curry', 150], ['rasam', 150]] },
  { id: 'l_chicken_biryani', slot: 'lunch', items: [['chicken_biryani', 300], ['curd', 100], ['salad', 80]] },
  { id: 'l_chapati_chole', slot: 'lunch', items: [['phulka', 105], ['chole', 180], ['salad', 100]] },
  { id: 'l_tomato_pappu', slot: 'lunch', items: [['rice_cooked', 200], ['tomato_pappu', 150], ['dondakaya_fry', 80], ['buttermilk', 250]] },
  { id: 'l_ragi_chicken', slot: 'lunch', items: [['ragi_mudde', 200], ['chicken_curry', 180]] },
  { id: 'l_rice_mutton', slot: 'lunch', items: [['rice_cooked', 180], ['mutton_curry', 150], ['salad', 100]], premium: true },

  // Snacks
  { id: 's_sprouts', slot: 'snack', items: [['sprouts', 150]], quick: true },
  { id: 's_chana_tea', slot: 'snack', items: [['roasted_chana', 30], ['tea', 120]], quick: true },
  { id: 's_fruit_guava', slot: 'snack', items: [['guava', 200]], quick: true },
  { id: 's_fruit_papaya', slot: 'snack', items: [['papaya', 250]], quick: true },
  { id: 's_curd_banana', slot: 'snack', items: [['curd', 150], ['banana', 100]], quick: true },
  { id: 's_buttermilk_peanuts', slot: 'snack', items: [['buttermilk', 250], ['peanuts_roasted', 20]], quick: true },
  { id: 's_boiled_eggs', slot: 'snack', items: [['boiled_egg', 100]], quick: true },
  { id: 's_almonds_tea', slot: 'snack', items: [['almonds', 15], ['tea', 120]], quick: true },
  { id: 's_paneer', slot: 'snack', items: [['paneer', 50], ['salad', 100]], quick: true, premium: true },
  { id: 's_milk', slot: 'snack', items: [['milk_toned', 250]], quick: true },

  // Dinner
  { id: 'd_chapati_dal_veg', slot: 'dinner', items: [['phulka', 105], ['pappu', 150], ['mixed_veg_curry', 120]] },
  { id: 'd_chapati_chicken', slot: 'dinner', items: [['phulka', 105], ['chicken_curry', 180], ['salad', 100]] },
  { id: 'd_pesarattu', slot: 'dinner', items: [['pesarattu', 180], ['tomato_chutney', 15], ['curd', 100]] },
  { id: 'd_chapati_palak_paneer', slot: 'dinner', items: [['phulka', 105], ['palak_paneer', 150]], premium: true },
  { id: 'd_grilled_chicken', slot: 'dinner', items: [['grilled_chicken', 150], ['phulka', 70], ['salad', 150]], quick: true },
  { id: 'd_curd_rice_egg', slot: 'dinner', items: [['curd_rice', 250], ['boiled_egg', 50]] },
  { id: 'd_idli_sambar', slot: 'dinner', items: [['idli', 160], ['sambar', 150]] },
  { id: 'd_ragi_sambar', slot: 'dinner', items: [['ragi_mudde', 200], ['sambar', 200]] },
  { id: 'd_chapati_bhurji', slot: 'dinner', items: [['phulka', 105], ['egg_bhurji', 120], ['salad', 100]], quick: true },
  { id: 'd_rice_rasam_cabbage', slot: 'dinner', items: [['rice_cooked', 150], ['rasam', 150], ['cabbage_curry', 100], ['curd', 100]] },
  { id: 'd_chapati_fish', slot: 'dinner', items: [['phulka', 105], ['fish_fry', 80], ['salad', 100]] },
  { id: 'd_tofu_veg', slot: 'dinner', items: [['phulka', 105], ['tofu', 100], ['mixed_veg_curry', 150]] },
];
