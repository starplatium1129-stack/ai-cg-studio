/**
 * 热门角色未通过场景蓝图的【手工级逐场景深度重构映射表 - Chunk 6】
 * 覆盖：时崎狂三 (Kurumi), 樱岛麻衣 (Mai), 远坂凛 (Rin), 间桐樱 (Sakura), 约尔 (Yor), 由比滨结衣 (Yui)
 */

module.exports = {
  // ─── 时崎狂三 (Tokisaki Kurumi) ─────────────────────────────────────
  "tokisaki_kurumi_old_bookstore": {
    promptTokens: [
      "safe", "1girl", "solo", "tokisaki_kurumi", "crimson_and_gold_clock_eyes", "asymmetrical_twintails", "gothic_lolita_dress",
      "sitting_on_antique_wooden_library_ladder", "reading_leather_grimoire_with_one_hand", "flirty_mysterious_smirk",
      "dimly_lit_vintage_european_bookstore", "towering_wooden_bookcases_reaching_ceiling", "warm_amber_candelabra_glow",
      "floating_golden_clock_gears_and_dust_motes", "cinematic_medium_shot"
    ],
    promptProse: "Perched high on a sliding wooden ladder in a shadowy, antique European bookstore, Kurumi holds an open leather grimoire with graceful poise. Her asymmetrical black twintails frame her face as her radiant golden clock-eye and crimson right eye gleam with an alluring, enigmatic smirk under the flickering amber glow of brass candelabras.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "modern office", "daylight"]
  },
  "tokisaki_kurumi_frozen_ruins": {
    promptTokens: [
      "safe", "1girl", "solo", "tokisaki_kurumi", "clock_eye", "crimson_eye", "asymmetrical_twintails", "astral_dress_elo_elohim",
      "wielding_antique_flintlock_pistol_and_musket", "dynamic_spinning_combat_stance", "crimson_energy_bursts", "floating_golden_zaphkiel_clock_dial_behind_her",
      "ruined_frost-covered_city_square", "shattered_gothic_clocktower_rubble", "dramatic_crimson_and_gold_particle_storm", "cinematic_action_key_visual"
    ],
    promptProse: "In the middle of a frozen, ruined city square before a shattered clocktower, Kurumi unleashes Zaphkiel in a breathtaking combat spin, aiming her vintage flintlock pistol and musket outward. A colossal translucent golden Roman clock dial materializes in the dark sky behind her, surrounded by swirling vortexes of crimson energy and floating frost motes.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "peaceful room", "daylight"]
  },

  // ─── 樱岛麻衣 (Sakurajima Mai) ─────────────────────────────────────
  "sakurajima_mai_bookstore": {
    promptTokens: [
      "safe", "1girl", "solo", "sakurajima_mai", "purple_eyes", "long_black_hair", "white_bunny_hairclip",
      "wearing_casual_autumn_beige_trench_coat_and_black_turtleneck", "standing_between_bookstore_aisles", "holding_novel_open_with_both_hands",
      "gentle_teasing_smile", "blushing", "cozy_neighborhood_bookstore", "warm_interior_lighting", "shallow_depth_of_field", "cinematic_medium_shot"
    ],
    promptProse: "Standing between quiet wooden bookshelves in a cozy neighborhood bookstore, Mai browses a novel with both hands, dressed in an elegant beige trench coat and black turtleneck. Turning her head toward the viewer with a gentle, teasing smile and a touch of warmth in her purple eyes, soft ambient lighting highlights her delicate bunny hairclip.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "bunny suit", "crowd"]
  },
  "sakurajima_mai_r18_hotel": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "sakurajima_mai", "adult", "purple_eyes", "long_black_hair_flowing_on_tatami", "bunny_hairclip",
      "nude", "completely_naked", "shapely_bare_breasts", "pink_nipples", "exposed_pussy", "slender_waist", "sheer_black_thighhigh_socks",
      "kneeling_on_traditional_ryokan_futon", "unbuttoning_yukata_draped_open_over_arms", "intense_flustered_blush", "parted_lips", "shy_loving_gaze",
      "traditional_japanese_hot_spring_inn_room", "sliding_paper_shoji_doors", "soft_warm_paper_lantern_lighting", "natural_gravity_body_deformation"
    ],
    nsfwProse: "Kneeling upon a plush futon inside a private hot spring ryokan room, Mai lets her patterned yukata slide completely off her shoulders, completely nude except for her sheer black thigh-high stockings. Her long silken hair cascades over her fair breasts and slender waist as her purple eyes look up with a breathless, loving blush under the gentle glow of paper lanterns.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "fishnet", "fishnets", "western bedroom"]
  },

  // ─── 由比滨结衣 (Yuigahama Yui) ────────────────────────────────────
  "yui_tennis_court_afternoon": {
    promptTokens: [
      "safe", "1girl", "solo", "yuigahama_yui", "amber_eyes", "peach_pink_hair", "side_bun_hairstyle",
      "wearing_white_and_pink_school_tennis_sportswear", "pleated_tennis_skirt", "holding_tennis_racket_over_shoulder",
      "wiping_sweat_from_forehead_with_back_of_hand", "radiant_energetic_smile", "high_school_tennis_court",
      "golden_hour_afternoon_sunlight", "chain-link_fence_and_green_trees_in_background", "cinematic_medium_shot"
    ],
    promptProse: "Resting on the green school tennis court after a practice match, Yui holds her tennis racket over one shoulder while wiping a bead of sweat from her forehead with a radiant, cheerful smile. Dressed in her sporty white-and-pink tennis outfit, the golden afternoon sun casts a warm rim light across her signature peach-pink side bun.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "gloomy", "winter"]
  },
  "yui_r18_bedroom_soles_black_socks": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "yuigahama_yui", "adult", "amber_eyes", "peach_pink_hair", "side_bun",
      "nude", "completely_naked", "large_shapely_breasts", "pink_nipples", "exposed_pussy", "curvaceous_thighs", "wearing_only_black_ankle_socks",
      "lying_on_stomach_on_fluffy_pink_bed", "propping_chin_on_pillows", "kicking_feet_in_air", "heavy_blush", "nervous_sweet_smile",
      "cozy_girly_bedroom", "fairy_lights_and_warm_bedside_lamp", "soft_shadows", "medium_shot"
    ],
    nsfwProse: "Lying comfortably on her stomach across a fluffy pink bed in her private room, Yui is completely nude except for her cute black ankle socks. Propping her chin on her hands with her feet playfully kicking in the air, her full bare breasts press softly into the pillows as she looks up with an endearing, flustered blush in the warm fairy-light glow.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "bad feet", "extra toes", "clothes"]
  }
};
