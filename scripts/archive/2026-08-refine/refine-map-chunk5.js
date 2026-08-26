/**
 * 热门角色未通过场景蓝图的【手工级逐场景深度重构映射表 - Chunk 6】
 * 覆盖：芙莉莲 (Frieren), 费伦 (Fern), 御坂美琴 (Mikoto), 爱蜜莉雅 (Emilia), 雷姆 (Rem), 初音未来 (Miku), 塞西莉亚 (Cecilia), 三森白夜 (Byakuya)
 */

module.exports = {
  // ─── 芙莉莲 (Frieren) ───────────────────────────────────────────────
  "frieren_magic_library": {
    promptTokens: [
      "safe", "1girl", "solo", "frieren", "green_eyes", "twin_twintails", "white_hair", "long_pointed_elf_ears", "gold_and_ruby_earrings",
      "sitting_cross-legged_atop_tall_pile_of_ancient_grimoires", "reading_glowing_magic_tome", "slight_childlike_curious_smile",
      "wearing_white_and_gold_mage_robe", "carrying_wooden_travel_staff", "towering_grand_magic_library", "floating_luminescent_spells_and_runes",
      "warm_sunlight_filtering_through_high_stained_glass", "dust_motes_dancing_in_light", "cinematic_medium_shot"
    ],
    promptProse: "Perched cross-legged atop a towering stack of ancient leather-bound grimoires inside a grand centuries-old magic library, Frieren inspects a glowing spellbook with a subtle, childlike sparkle of curiosity in her green eyes. Glowing golden and blue magical runes drift lazily through the dusty air as warm afternoon sunbeams pour through high stained-glass windows onto her white mage robes and long elf ears.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "modern room", "dark"]
  },

  // ─── 费伦 (Fern) ───────────────────────────────────────────────────
  "fern_mage_library_candle": {
    promptTokens: [
      "safe", "1girl", "solo", "fern_frieren", "purple_eyes", "long_purple_hair", "straight_bangs", "deadpan_pouting_expression",
      "sitting_at_wooden_library_table", "studying_under_flickering_candelabra", "wearing_long_black_mage_coat_over_white_dress",
      "holding_wooden_staff_resting_against_chair", "steaming_cup_of_tea_beside_open_scroll", "ancient_stone_library_at_night",
      "warm_candlelight_shadows", "depth_of_field", "cinematic_medium_shot"
    ],
    promptProse: "Studying diligently at a heavy oak table in the quiet stone archives late at night, Fern rests her chin on her hand with an adorable, deadpan pout as she reads by the warm glow of a flickering candelabra. Dressed in her modest black traveling cloak, her long purple hair drapes over the chair back with her wooden casting staff leaning within arm's reach.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "cheerful", "modern city"]
  },

  // ─── 御坂美琴 (Misaka Mikoto) ───────────────────────────────────────
  "misaka_mikoto_living_room": {
    promptTokens: [
      "safe", "1girl", "solo", "misaka_mikoto", "brown_eyes", "short_brown_hair", "signature_flower_hair_clip",
      "sitting_curled_up_on_tokiwadai_dorm_sofa", "hugging_giant_fluffy_gekota_frog_plushie_tightly", "flustered_embarrassed_blush",
      "wearing_casual_loose_t-shirt_and_shorts", "tiny_cyan_electric_sparks_crackling_from_bangs", "cozy_dormitory_room",
      "warm_evening_lamp_lighting", "gekota_merchandise_on_shelves", "cinematic_medium_shot"
    ],
    promptProse: "Curled up on the sofa in her Tokiwadai dormitory room in the evening, Mikoto hugs a giant green Gekota frog plushie tightly to her chest with a flustered, embarrassed blush across her cheeks. Tiny playful cyan electric sparks crackle harmlessly across her brown bangs as she looks away in adorable tsundere denial under the soft warm lamp light.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "school uniform", "battlefield", "harsh light"]
  },

  // ─── 爱蜜莉雅 (Emilia) ──────────────────────────────────────────────
  "emilia_rezero_r18_snow_spring": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "emilia_rezero", "adult", "purple_and_blue_gradient_eyes", "long_silver_hair", "long_pointed_half-elf_ears", "white_flower_hairpin",
      "nude", "completely_naked", "soft_shapely_breasts", "pink_nipples", "exposed_pussy", "slender_porcelain_waist",
      "soaking_in_steaming_outdoor_snow_hot_spring", "leaning_back_against_snow-dusted_hot_rocks", "wet_silver_hair_floating_on_water",
      "heavy_steamy_blush", "loving_gentle_smile", "roswaal_mansion_snowy_gardens", "soft_snowflakes_falling", "glowing_puck_spirit_orb_in_distance",
      "translucent_water_ripples", "medium_shot"
    ],
    nsfwProse: "Submerged in an outdoor natural hot spring surrounded by fresh snowy pine trees in the Roswaal estate gardens, Emilia leans back against warm mineral rocks, completely nude with her silken silver hair floating in the steaming water. Soft snowflakes melt against her flushed bare shoulders and shapely breasts as her radiant gradient violet-blue eyes gaze with pure, breathless love under the moonlight.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "clothes", "dress", "summer", "harsh light"]
  },

  // ─── 雷姆 (Rem) ─────────────────────────────────────────────────────
  "rem_rezero_moon_garden": {
    promptTokens: [
      "safe", "1girl", "solo", "rem_rezero", "blue_eyes", "short_blue_hair", "hair_covering_right_eye", "pink_flower_hairpin", "white_maid_headband",
      "wearing_iconic_roswaal_mansion_maid_uniform", "holding_large_spiked_morningstar_iron_flail_loosely_at_side", "gentle_devoted_smile",
      "standing_in_moonlit_rose_garden", "glowing_blue_mana_butterflies_fluttering", "stone_fountain_and_arched_rose_trellises",
      "silver_full_moon_backlighting", "cinematic_medium_shot"
    ],
    promptProse: "Standing amidst the blooming night roses of the Roswaal mansion courtyard under a silver full moon, Rem holds her spiked iron morningstar flail resting against the grass with tranquil grace. Her iconic maid uniform and blue hair flutter in the night breeze as glowing blue mana butterflies dance around her fingertips, her visible blue eye radiating absolute, tender devotion.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "demon horn", "blood", "daylight"]
  }
};
