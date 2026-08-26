/**
 * 热门角色未通过场景蓝图的【手工级逐场景深度重构映射表 - Chunk 13】
 * 覆盖：全量剩余热门角色未通过蓝图（让 174 个热门角色蓝图 100% 全部完成手写重构覆盖！）
 */

module.exports = {
  // ─── 剩余未通过的蓝图补充 ──────────────────────────────────────────
  "eunectes_arknights_jungle_ruins": {
    promptTokens: [
      "safe", "1girl", "solo", "eunectes_arknights", "golden_eyes", "green_hair", "snake_tail_coiled_on_stone",
      "wearing_safari_tunic_and_shorts", "holding_wrench_and_surveyor_scope", "sitting_on_ancient_mossy_stone_ruins",
      "curious_bright_smile", "deep_acahualla_jungle_ruins", "towering_stone_temple_arches_overgrown_with_vines",
      "warm_morning_sunbeams_cutting_through_mist", "floating_spores_and_leaves", "cinematic_wide_shot"
    ],
    promptProse: "Sitting on a carved mossy stone slab in the heart of the Acahualla jungle ruins, Eunectes studies an ancient mechanical relic with a wrench in hand. Her emerald hair and thick snake tail rest gracefully amidst climbing vines and mist as radiant golden sunbeams pierce through towering temple arches.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "modern city", "night"]
  },
  "goldenglow_arknights_dorm_sofa": {
    promptTokens: [
      "safe", "1girl", "solo", "goldenglow_arknights", "blue_eyes", "fluffy_pink_hair", "pink_cat_ears", "pink_cat_tail",
      "wearing_oversized_knitted_cream_sweater_and_shorts", "sitting_curled_up_on_dorm_couch", "holding_steaming_hot_chocolate_mug",
      "radiant_sweet_gentle_smile", "rhodes_island_dormitory_interior", "fairy_lights_strung_on_wall", "warm_ambient_lighting", "medium_shot"
    ],
    promptProse: "Curled up comfortably on the plush dormitory sofa in an oversized cream knit sweater, Goldenglow cradles a steaming mug of hot chocolate between both hands with a gentle, heartwarming smile. Her fluffy pink cat ears perk up happily under the soft amber twinkle of decorative fairy lights.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "gloomy", "battlefield"]
  },
  "misaka_mikoto_tokiwadai_rooftop": {
    promptTokens: [
      "safe", "1girl", "solo", "misaka_mikoto", "brown_eyes", "short_brown_hair", "flower_hairclip",
      "wearing_tokiwadai_school_uniform_vest_and_skirt", "standing_on_tokiwadai_academy_rooftop_at_sunset", "flipping_arcade_coin_with_thumb",
      "tiny_crackling_cyan_lightning_arcs_on_coin", "confident_smirk", "academy_city_wind_turbines_and_sunset_skyline",
      "strong_golden_hour_rim_light", "cinematic_medium_shot"
    ],
    promptProse: "Standing on the sun-drenched rooftop of Tokiwadai Middle School at sunset, Mikoto flips an arcade coin into the air with her thumb, tiny cyan lightning arcs crackling across the metal surface. Her brown hair and uniform vest flutter in the breeze against the sprawling silhouette of Academy City wind turbines under a fiery golden sky.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "gloomy", "rain"]
  },
  "yukino_clubroom_window_sunset": {
    promptTokens: [
      "safe", "1girl", "solo", "yukinoshita_yukino", "blue_eyes", "long_black_hair", "red_hair_ribbons",
      "wearing_sobu_high_school_uniform_and_blazer", "sitting_at_service_club_table_by_window", "reading_paperback_book",
      "looking_up_with_cool_intellectual_gaze", "subtle_soft_smile", "sobu_high_service_clubroom", "golden_sunset_streaming_through_blinds",
      "tea_set_on_table", "floating_dust_motes", "cinematic_medium_shot"
    ],
    promptProse: "Sitting at the wooden table in the quiet Service Clubroom after school, Yukinoshita Yukino looks up from her paperback book as golden sunset rays filter through the window blinds. Dressed in her neat Sobu High uniform, her long black hair and red ribbons catch the warm amber light as her sharp blue eyes soften with quiet, intellectual poise.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "noisy crowd", "messy"]
  }
};
