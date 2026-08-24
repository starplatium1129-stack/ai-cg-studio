/**
 * 热门角色未通过场景蓝图的【手工级逐场景深度重构映射表 - Chunk 3】
 * 覆盖：雪之下雪乃 (Yukino), 由比滨结衣 (Yui), 楪祈 (Inori), 森蚺 (Eunectes), 伊莉雅 (Illyasviel), 澄闪 (Goldenglow), 蕾缪安 (Lemuen), 泥岩 (Mudrock), 铃兰 (Suzuran), 佩丽卡 (Perlica), 莱瓦汀 (Laevatain), 羽毛笔 (Quillpen), 艾莉莎 (Alya), 芙莉莲/费伦 (Frieren/Fern)
 */

module.exports = {
  // ─── 雪之下雪乃 (Yukinoshita Yukino) 5 个场景 ────────────────────────
  "yukinoshita_yukino_kotatsu_winter": {
    promptTokens: [
      "safe", "1girl", "solo", "yukinoshita_yukino", "blue_eyes", "straight_black_hair", "long_hair", "twin_side_braids_with_red_ribbons",
      "wearing_oversized_white_knit_cardigan", "sitting_tucked_inside_warm_wooden_kotatsu", "resting_chin_on_fluffy_kotatsu_blanket",
      "holding_sleeping_calico_cat_in_arms", "faint_soft_relaxed_smile", "sobun_high_school_service_club_room", "snow_falling_outside_window",
      "steaming_mug_of_black_tea_on_table", "warm_indoor_lighting", "cinematic_medium_shot"
    ],
    promptProse: "Tucked comfortably inside a warm wooden kotatsu inside the service club room on a snowy winter afternoon, Yukino rests her chin against the fluffy blanket while gently cradling a sleeping cat. Her cool blue eyes soften into a rare, unguarded expression of pure contentment, snowflakes drifting gently past the frosted windowpanes behind her.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "summer", "harsh lighting"]
  },
  "yukinoshita_yukino_r18_library_closed": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "yukinoshita_yukino", "adult", "blue_eyes", "straight_black_hair", "red_hair_ribbons",
      "nude", "completely_naked", "slender_petite_breasts", "pink_nipples", "exposed_pussy", "slender_waist", "black_thighhigh_socks",
      "sitting_on_study_table_between_tall_wooden_bookshelves", "leaning_forward_with_hands_gripping_table_edge", "heavy_flustered_blush",
      "shy_trembling_gaze", "closed_high_school_library_at_dusk", "sunset_amber_light_filtering_through_tall_windows",
      "long_dramatic_shadows_between_aisles", "medium_shot"
    ],
    nsfwProse: "Sitting perched on a study table inside the locked school library at dusk, Yukino is completely nude except for her black thigh-high stockings. Gripping the wooden edge with both hands as her slender, fair curves catch the flaming amber rays of sunset through tall library windows, her porcelain face blushes deeply with uncharacteristic vulnerability and racing breath.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "fishnet", "school uniform", "daylight"]
  },

  // ─── 楪祈 (Yuzuriha Inori) 5 个场景 ────────────────────────────────
  "yuzuriha_inori_stage": {
    promptTokens: [
      "safe", "1girl", "solo", "yuzuriha_inori", "red_eyes", "pink_hair_gradient", "twin_pigtails_with_red_clips",
      "wearing_iconic_egoist_red_and_orange_swallowtail_dress", "holding_vintage_microphone_stand_with_both_hands", "singing_with_eyes_closed_and_parted_lips",
      "passionate_expressive_performance", "futuristic_concert_stage", "floating_glowing_red_data_particles", "volumetric_spotlight_beams_cutting_through_darkness",
      "translucent_floating_ribbons", "cinematic_action_key_visual"
    ],
    promptProse: "Under brilliant stage spotlights at an EGOIST concert, Inori sings with eyes closed and parted lips, gripping the silver microphone stand with both hands as floating crystalline red data particles swirl around her billowing red-and-orange swallowtail dress. The stage darkness is illuminated by cutting volumetric beams and glowing holographic waves resonating with her melody.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "empty room", "flat lighting"]
  },
  "yuzuriha_inori_r18_sofa_night": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "yuzuriha_inori", "adult", "red_eyes", "pink_gradient_hair", "red_hair_clips",
      "nude", "completely_naked", "soft_shapely_breasts", "pink_nipples", "exposed_pussy", "slender_waist",
      "reclining_on_white_leather_couch", "leaning_back_on_cushions", "holding_red_string_tied_to_fingers", "dreamy_gentle_smile",
      "soft_blush", "funeral_parlor_hideout_room", "dim_cyan_and_magenta_neon_glow_from_monitors", "translucent_holographic_particles_in_air",
      "intimate_soft_shadows", "medium_shot"
    ],
    nsfwProse: "Reclining gracefully across a white leather sofa inside the dim Funeral Parlor headquarters, Inori is completely nude with her soft pink gradient hair spilling over the cushions. Holding a single red thread between her delicate fingers, her crimson eyes look up with a dreamy, tender gaze, soft cyan and magenta monitor glows outlining her pale curves.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "clothes", "dress", "bright daylight"]
  },

  // ─── 森蚺 (Eunectes / Zumama) 6 个场景 ─────────────────────────────
  "eunectes_arknights_mech_garage": {
    promptTokens: [
      "safe", "1girl", "solo", "eunectes_arknights", "golden_eyes", "long_green_hair", "thick_green_snake_tail_curled_on_floor",
      "wearing_black_sports_crop_top", "cargo_shorts", "heavy_leather_tool_belt", "holding_large_metal_wrench_over_shoulder",
      "smudged_engine_oil_on_cheek", "proud_confident_smile", "underground_high-tech_jungle_garage", "massive_metal_big_ugly_robot_chassis_in_background",
      "flying_welding_sparks", "warm_industrial_work_lights", "cinematic_medium_shot"
    ],
    promptProse: "Standing proud in her subterranean jungle workshop with a smudge of grease across her cheek, Eunectes rests a heavy steel wrench across her bare shoulder, her thick green reptile tail coiling along the diamond-plate floor. Behind her, the towering metal chassis of the Big Ugly robot is illuminated by flying welding sparks and warm overhead halogen lamps.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "modern clean room", "fragile"]
  },
  "eunectes_arknights_r18_mech_seat": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "eunectes_arknights", "adult", "golden_eyes", "long_green_hair", "snake_tail_wrapping_around_pilot_chair",
      "nude", "completely_naked", "large_shapely_breasts", "pink_nipples", "exposed_pussy", "toned_athletic_body", "fit_abs",
      "sitting_spread-legged_in_steel_mech_cockpit_chair", "hands_resting_on_control_joysticks", "sweaty_glistening_skin",
      "intense_flustered_pant", "blushing", "dim_cockpit_illuminated_by_glowing_green_and_amber_instrument_dials",
      "dramatic_cockpit_lighting", "medium_shot"
    ],
    nsfwProse: "Sitting completely naked inside the steel pilot seat of her mech, Eunectes grips the dual control sticks with her strong green tail wrapped snugly around the chair base. Glistening beads of sweat trace down her toned abs and ample bare breasts as the glowing amber and green instrument dials illuminate her flushed, breathless face in the intimate heat of the cockpit.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "clothes", "swimsuit", "outdoor daylight"]
  },

  // ─── 泥岩 (Mudrock) 6 个场景 ───────────────────────────────────────
  "mudrock_arknights_ruins_shelter": {
    promptTokens: [
      "safe", "1girl", "solo", "mudrock_arknights", "crimson_red_eyes", "short_white_hair", "obsidian_gargoyle_horns",
      "wearing_casual_black_tactical_turtleneck", "sitting_on_rubble_by_campfire", "holding_warm_tin_cup", "gentle_tired_smile",
      "massive_heavy_power_armor_resting_beside_her_in_shadows", "ruined_concrete_bunker_shelter", "blizzard_howling_outside_broken_wall",
      "warm_campfire_embers_glow", "cinematic_medium_shot"
    ],
    promptProse: "Resting beside a small crackling campfire inside a ruined concrete shelter while a blizzard rages outside, Mudrock sits without her massive armor, holding a tin cup of hot soup. Her delicate white hair and dark horns catch the flickering firelight as her crimson eyes offer a gentle, weary smile of relief, her colossal black power suit standing guard like a silent sentinel in the background shadows.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "fully armored", "modern city"]
  },
  "mudrock_arknights_r18_hammer_rest": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "mudrock_arknights", "adult", "crimson_red_eyes", "white_hair", "gargoyle_horns",
      "nude", "completely_naked", "large_bare_breasts", "pink_nipples", "exposed_pussy", "curvaceous_fair_skinned_body",
      "leaning_body_against_giant_warhammer_shaft", "hands_resting_on_hammer_pommel", "heavy_post-battle_blush", "parted_lips",
      "dim_stone_chamber", "magical_earth_crystal_amber_glow", "floor_rubble_and_dust_motes", "dramatic_sculptural_lighting"
    ],
    nsfwProse: "Standing completely nude in a secluded subterranean stone chamber, Mudrock leans her voluptuous, fair-skinned body against the vertical shaft of her colossal warhammer. Her cheeks glow with a heavy post-combat blush as warm amber crystal veins in the cavern walls illuminate her ample bare breasts, slender waist, and curved horns with dramatic sculptural depth.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "armor", "clothes", "daylight"]
  },

  // ─── 澄闪 (Goldenglow / Susie) 4 个场景 ───────────────────────────
  "goldenglow_arknights_r18_bath_flowers": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "goldenglow_arknights", "adult", "blue_eyes", "fluffy_pink_hair", "pink_cat_ears", "pink_cat_tail",
      "nude", "completely_naked", "petite_soft_breasts", "pink_nipples", "exposed_pussy", "slender_waist",
      "soaking_in_wooden_tub_filled_with_floating_yellow_flowers", "resting_fluffy_wet_tail_on_tub_rim", "tiny_static_electricity_sparks_dancing_on_water",
      "flustered_embarrassed_blush", "shy_pout", "warm_cozy_bathroom", "amber_lantern_light", "translucent_water_ripples"
    ],
    nsfwProse: "Soaking inside a steaming cedar tub filled with floating yellow blossoms, Goldenglow is completely nude with tiny sparks of pink static electricity dancing across the warm water's surface. Her fluffy pink cat ears twitch nervously as her cheeks flush deep crimson, resting her wet tail over the rim while looking away in flustered, adorable modesty.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "clothes", "swimsuit", "harsh lighting"]
  }
};
