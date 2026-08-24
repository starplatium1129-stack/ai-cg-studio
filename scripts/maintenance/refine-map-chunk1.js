/**
 * 热门角色 174 个未通过场景蓝图的【手工级逐场景深度重构映射表】
 * 每一个场景都基于角色官方设定、场景原版剧情 description 与镜头美学进行从头到尾的重写：
 * 包含：专属动作透视、场景特定道具与纵深、神态微表情、光影与解剖逻辑、完整英文 Prose。
 */

module.exports = {
  // ─── 玛奇玛 (Makima) 8 个场景 ─────────────────────────────────────
  "makima_office": {
    promptTokens: [
      "safe", "1girl", "solo", "makima", "yellow_eyes", "golden_ringed_eyes", "reddish_light_brown_hair", "loose_braid", "bangs",
      "leaning_forward_over_mahogany_desk", "hands_clasped_under_chin", "sharp_suit", "black_necktie", "crisp_white_collared_shirt",
      "chilling_condescending_smile", "intense_hypnotic_gaze", "tokyo_skyline_through_huge_windows", "late_afternoon_sunlight",
      "long_dramatic_shadows_on_wood_floor", "polished_desk_reflection", "volumetric_dust_motes", "cinematic_low_angle", "medium_shot"
    ],
    promptProse: "In a cinematic low-angle framing inside her spacious high-floor Public Safety office, Makima leans slightly forward over a polished dark mahogany desk with her gloved fingers lightly clasped beneath her chin. Her mesmerizing golden ringed eyes gaze down directly at the viewer with an unfathomable, chillingly calm smile of absolute authority. Behind her, floor-to-ceiling panoramic windows frame the hazy Tokyo skyline under golden dusk, casting long architectural shadows and warm ambient rim light across her tailored black suit and braided auburn hair.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "mutated hands", "cheerful", "child", "loli"]
  },
  "makima_cinema": {
    promptTokens: [
      "safe", "1girl", "solo", "makima", "yellow_eyes", "golden_ringed_eyes", "reddish_light_brown_hair", "loose_braid",
      "sitting_in_red_velvet_theater_seat", "holding_drink_cup_with_straw", "head_tilted_slightly", "teary_eyes_glistening",
      "gentle_melancholic_smile", "black_trench_coat", "dimly_lit_movie_theater", "blue_projector_beam_cutting_through_darkness",
      "silver_screen_glow_on_face", "cinematic_composition", "medium_close-up"
    ],
    promptProse: "Inside a dim, empty movie theater lit only by the flickering silver screen and blue projector beam, Makima sits poised in a plush crimson velvet seat holding a paper drink cup. A single translucent tear glimmers at the corner of her golden ringed eyes as she watches the film with a tender, uncharacteristically human melancholy, the cinematic light dancing across her porcelain skin and braided hair.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "crowd", "bright lighting"]
  },
  "makima_dog_park": {
    promptTokens: [
      "safe", "1girl", "solo", "makima", "yellow_eyes", "golden_ringed_eyes", "reddish_light_brown_hair", "long_braid",
      "crouching_down_on_green_lawn", "one_hand_gently_patting_golden_retriever_head", "warm_affectionate_smile",
      "casual_white_button_shirt", "black_slacks", "autumn_city_park", "golden_ginkgo_trees", "falling_yellow_leaves",
      "gentle_sunlight_filtering_through_trees", "soft_bokeh", "medium_shot"
    ],
    promptProse: "In a serene autumn park carpeted with golden ginkgo leaves, Makima crouches gracefully on the green grass gently stroking the head of a happy dog at her side. She looks up with a rare, genuine expression of gentle affection in her ringed amber eyes, warm dappled sunlight filtering through swaying tree branches onto her relaxed white shirt and long braid.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "gloomy", "dark shadows"]
  },
  "makima_dominion_night": {
    promptTokens: [
      "safe", "1girl", "solo", "makima", "yellow_eyes", "golden_ringed_eyes", "reddish_light_brown_hair", "long_braid",
      "standing_on_rooftop_helipad", "wind_blowing_long_black_coat", "one_hand_raised_in_pointing_gesture", "cold_commanding_expression",
      "rain_slicked_ground_reflecting_neon", "tokyo_night_cityscape", "flashing_red_warning_lights", "volumetric_searchlight_beams",
      "dramatic_low_angle_shot", "cinematic_action_key_visual"
    ],
    promptProse: "High atop a rain-swept skyscraper helipad overlooking the neon-drenched expanse of Tokyo at midnight, Makima stands tall with her black trench coat billowing wildly in the gale. Raising one slender hand in a chilling, deliberate pointing gesture, her glowing ringed eyes radiate supreme dominion under sweeping searchlight beams and blood-red warning beacons.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "daylight", "cheerful"]
  },
  "makima_home_dinner": {
    promptTokens: [
      "safe", "1girl", "solo", "makima", "yellow_eyes", "golden_ringed_eyes", "reddish_light_brown_hair", "loose_side_braid",
      "wearing_oversized_cream_knit_sweater", "sitting_cross-legged_on_living_room_rug", "holding_warm_ceramic_mug_with_both_hands",
      "soft_playful_smirk", "modern_minimalist_apartment", "warm_floor_lamp_lighting", "steaming_hot_pot_on_coffee_table",
      "cozy_intimate_atmosphere", "depth_of_field", "medium_shot"
    ],
    promptProse: "Inside her warm, dimly lit minimalist apartment, Makima relaxes cross-legged on a thick woolen rug wearing an oversized cream knit sweater slipping slightly off one collarbone. Cradling a steaming mug between both hands, she looks up toward the viewer with an inviting, softly predatory smile bathed in the amber glow of a nearby floor lamp.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "office", "harsh light"]
  },
  "makima_r18_apartment_bath": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "makima", "adult", "yellow_eyes", "golden_ringed_eyes", "reddish_light_brown_hair", "wet_hair_clinging_to_skin",
      "nude", "completely_naked", "bare_breasts", "pink_nipples", "exposed_pussy", "slender_waist", "wide_hips",
      "soaking_in_modern_black_marble_bathtub", "resting_arms_on_tub_rim", "translucent_water_ripples", "floating_soap_bubbles",
      "steam_haze_in_air", "flushed_cheeks", "teasing_condescending_smirk", "luxury_highrise_bathroom", "tokyo_night_view_through_glass",
      "warm_dim_recessed_lighting", "water_droplets_on_skin", "medium_shot"
    ],
    nsfwProse: "Completely naked immersed in a sleek black marble bathtub filled with warm steaming water, Makima rests her slender wet arms along the rim, her golden ringed eyes gleaming with dominant amusement through the rising steam. Water droplets trace over her porcelain collarbones and shapely bare breasts, while the sprawling neon lights of Tokyo shimmer through floor-to-ceiling glass in the background.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "bad breasts", "extra fingers", "clothes", "underwear", "bra"]
  },
  "makima_r18_bathrobe_morning": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "makima", "adult", "yellow_eyes", "golden_ringed_eyes", "reddish_light_brown_hair", "messy_morning_hair",
      "loosely_tied_white_silk_bathrobe", "open_robe", "robe_falling_off_both_shoulders", "bare_shoulders", "bare_breasts", "pink_nipples",
      "exposed_pussy", "slender_thighs", "sitting_on_edge_of_unmade_bed", "leaning_back_on_hands", "soft_morning_sunlight_filtering_through_blinds",
      "slatted_shadows_on_skin", "sleepy_provocative_smirk", "luxurious_apartment_bedroom", "cinematic_lighting"
    ],
    nsfwProse: "Sitting on the edge of a disheveled king-sized bed in the soft morning light, Makima wears an open white silk bathrobe slipping completely off her shoulders to reveal her delicate bare breasts, slender waist, and exposed thighs. Leaning back on her palms with slatted window blind shadows striping across her warm skin, she casts a languid, knowing glance from her golden ringed eyes.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "fully dressed", "closed robe"]
  },
  "makima_supermarket": {
    promptTokens: [
      "safe", "1girl", "solo", "makima", "yellow_eyes", "golden_ringed_eyes", "reddish_light_brown_hair", "neat_braid",
      "wearing_long_beige_wool_trench_coat", "black_turtleneck", "pushing_metal_shopping_cart", "holding_package_of_dog_treats",
      "turning_head_to_look_over_shoulder", "charming_calm_smile", "brightly_lit_supermarket_aisle", "neatly_stacked_food_shelves",
      "perspective_depth", "overhead_fluorescent_lights", "medium_full_shot"
    ],
    promptProse: "Walking down a brightly illuminated supermarket aisle late in the evening, Makima pushes a shopping cart while holding a selection of gourmet dog treats. Dressed in a tailored beige trench coat over a sleek black turtleneck, she glances back over her shoulder with an elegant, composed smile, the colorful grocery aisles stretching into crisp perspective depth behind her.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "crowd", "dark"]
  },

  // ─── 凯尔希 (Kal'tsit) 7 个场景 ────────────────────────────────────
  "kaltsit_arknights_archive_ledger": {
    promptTokens: [
      "safe", "1girl", "solo", "kaltsit_arknights", "green_eyes", "sharp_analytical_gaze", "short_light_green_hair", "cat_ears",
      "sitting_at_cluttered_wooden_archive_desk", "reading_thick_hardcover_ledger", "holding_vintage_fountain_pen", "faint_tired_sigh_expression",
      "wearing_rhodes_island_coat_over_shoulders", "green_dress", "black_stockings", "towering_archive_bookshelves_in_background",
      "floating_amber_holographic_data_screens", "warm_desk_lamp_illumination", "dust_motes_in_light_cone", "cinematic_medium_shot"
    ],
    promptProse: "Late at night inside the vast Rhodes Island central archives, Kal'tsit sits behind a heavy wooden desk covered with open dossiers, meticulously annotating a historical ledger with an old fountain pen. Her sharp emerald eyes reflect the faint glow of floating holographic data cubes and a warm desk lamp, her feline ears perked in quiet concentration amidst towering rows of ancient books.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "messy desk", "modern office"]
  },
  "kaltsit_arknights_desert_recon": {
    promptTokens: [
      "safe", "1girl", "solo", "kaltsit_arknights", "green_eyes", "short_light_green_hair", "cat_ears", "serious_stoic_expression",
      "standing_on_sand_dune_ridge", "holding_tactical_binoculars_at_waist", "long_white_tactical_cloak_billowing_in_desert_wind",
      "sargon_endless_sand_dunes", "harsh_blazing_desert_sun", "heat_haze_distortion", "ancient_originium_crust_formations_in_distance",
      "dramatic_backlighting", "cinematic_wide_shot"
    ],
    promptProse: "Standing atop a high desert sand dune in Sargon under a blazing midday sun, Kal'tsit surveys the shimmering wasteland horizon with tactical binoculars resting in her hand. Her white dust cloak snaps vigorously in the arid wind as heat haze distorts the jagged black originium spires rising from the distant dunes.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "indoor", "rain"]
  },
  "kaltsit_arknights_mon3tr_shadow": {
    promptTokens: [
      "safe", "1girl", "solo", "kaltsit_arknights", "glowing_green_eyes", "short_light_green_hair", "cat_ears",
      "dynamic_command_pose", "one_hand_extended_forward_with_originium_crystal_glow", "fierce_resolute_combat_gaze",
      "looming_massive_crystalline_mon3tr_silhouette_behind_her", "sharp_black_and_green_originium_spikes", "dark_ruined_corridor",
      "sparks_and_energy_particles", "dramatic_volumetric_lighting", "cinematic_action_shot"
    ],
    promptProse: "Inside a shattered underground ruin, Kal'tsit commands the battlefield with one gloved hand outstretched, channeling glowing green Originium energy. Towering behind her, the terrifying crystalline spine and glowing claws of Mon3tr manifest from dark shadows, their synchronized lethal presence illuminated by crackling energy sparks and harsh rim lighting.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "peaceful", "bright sunlight"]
  },
  "kaltsit_arknights_r18_desk_night": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "kaltsit_arknights", "adult", "green_eyes", "sharp_analytical_gaze", "short_light_green_hair", "cat_ears",
      "nude", "completely_naked", "bare_breasts", "pink_nipples", "exposed_pussy", "slender_waist", "black_elbow_gloves",
      "sheer_black_pantyhose", "sitting_on_edge_of_metal_medical_desk", "crossed_legs", "leaning_back_on_hands", "flushed_cheeks",
      "slight_smirk", "rhodes_island_medical_lab", "illuminated_by_warm_desk_lamp", "floating_mon3tr_crystalline_shadow_in_background",
      "scattered_medical_records", "floor_reflection", "intimate_shadows", "dramatic_rim_light", "medium_shot"
    ],
    nsfwProse: "Inside the quiet medical office late at night, Kal'tsit sits perched on the edge of the metal desk with her slender legs crossed in sheer black pantyhose, wearing only her long black surgical elbow gloves while her lab coat lies on a chair. Warm amber light from a desk lamp carves deep shadows across her pale bare breasts and delicate collarbones as she regards the viewer with a calculating, intimate smirk.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "fishnet", "fishnets", "split image", "2girls", "clothes"]
  },
  "kaltsit_arknights_r18_medical_bath": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "kaltsit_arknights", "adult", "green_eyes", "short_light_green_hair", "wet_hair", "cat_ears",
      "nude", "completely_naked", "bare_breasts", "pink_nipples", "exposed_pussy", "submerged_in_clear_mineral_recovery_bath",
      "leaning_head_back_on_tiled_headrest", "wet_skin", "water_droplets_on_shoulders", "relaxed_exhausted_blush",
      "high-tech_sterile_medical_recovery_bay", "soft_blue_and_warm_overhead_illumination", "steam_rising_from_water",
      "translucent_water_ripples", "medium_shot"
    ],
    nsfwProse: "Submerged in a high-tech warm mineral recovery bath inside the medical bay, Kal'tsit tilts her head back against the smooth tiled headrest, her cat ears drooping slightly in deep post-operation exhaustion. Clear warm water laps gently against her bare breasts and slender torso, tiny beads of moisture glistening on her flushed pale skin under soft ambient medical lighting.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "clothes", "swimsuit", "murky water"]
  },
  "kaltsit_arknights_r18_mon3tr_guard": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "kaltsit_arknights", "adult", "green_eyes", "short_light_green_hair", "cat_ears",
      "nude", "completely_naked", "bare_breasts", "pink_nipples", "exposed_pussy", "slender_body", "parted_legs",
      "reclining_on_dark_silk_futon", "propping_body_up_on_one_elbow", "mon3tr_curling_protectively_around_the_bed_in_shadows",
      "glowing_green_originium_spines", "intimate_dim_room", "subtle_green_ambient_glow", "heavy_blush", "vulnerable_gaze",
      "natural_gravity_body_deformation", "medium_shot"
    ],
    nsfwProse: "Reclining upon dark silk bedding in her private quarters, Kal'tsit props herself up on one elbow, completely nude with her fair breasts and vulnerable silhouette exposed to the viewer. In the surrounding gloom, the massive spine of Mon3tr curls protectively like a dark living barrier, its faint green crystalline glow highlighting the curve of her waist and blushing cheeks.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "clothes", "underwear", "bright daylight"]
  },
  "kaltsit_arknights_training_supervise": {
    promptTokens: [
      "safe", "1girl", "solo", "kaltsit_arknights", "green_eyes", "short_light_green_hair", "cat_ears", "arms_crossed_over_chest",
      "standing_behind_observation_glass", "strict_evaluative_expression", "rhodes_island_medical_coat", "black_turtleneck",
      "high-tech_training_hall_view_below", "holographic_performance_charts_floating", "cool_fluorescent_lighting",
      "reflective_floor_and_glass", "cinematic_medium_shot"
    ],
    promptProse: "Standing with arms crossed behind the reinforced observation window of the tactical training deck, Kal'tsit watches the combat drills below with strict, unyielding analytical focus. Floating cyan holographic telemetry charts illuminate her composed face and sharp green eyes against the sterile metallic architecture of Rhodes Island.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "messy", "warm sunlight"]
  }
};
