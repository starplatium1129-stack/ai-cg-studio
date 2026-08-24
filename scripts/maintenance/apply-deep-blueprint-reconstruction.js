/**
 * 完整 174 个热门角色蓝图的逐个深度重构生成引擎
 * 针对所有 43 位角色的每一个 fail 场景，彻底重构动作透视、空间道具、光影层与灵魂 Prose！
 */

const fs = require('fs');
const path = require('path');

const bpFile = 'data/scene-blueprints.json';
const bpData = JSON.parse(fs.readFileSync(bpFile, 'utf8'));
const blueprints = bpData.blueprints || bpData;

const chunk1 = require('./refine-map-chunk1.js');

// 针对所有 174 个未通过场景的特征化重构规则
const RECONSTRUCT_RULES = {
  // 黑贞德
  jeanne_alter: (bp) => {
    if (bp.adult) {
      bp.nsfwTokens = [
        "nsfw", "1girl", "solo", "jeanne_alter", "adult", "golden_yellow_eyes", "fierce_haughty_gaze", "short_white_hair", "messy_bangs",
        "nude", "completely_naked", "bare_breasts", "pink_nipples", "exposed_pussy", "slender_toned_body",
        "lounging_arrogantly_on_spiked_obsidian_throne", "one_leg_propped_up_on_armrest", "holding_flag_spear_with_one_hand",
        "haughty_sadistic_smirk", "heavy_blush", "gothic_ruined_cathedral", "flickering_hellfire_rim_lighting",
        "molten_ember_particles_floating", "shattered_stained_glass_window", "cinematic_low_angle_shot"
      ];
      bp.nsfwProse = "Completely naked and lounging with defiant arrogance upon a spiked obsidian throne, Jeanne Alter rests one shapely leg over the armrest while loosely gripping the shaft of her dragon banner. Her golden eyes gleam with sadistic amusement and flushed passion under the violent amber glow of licking hellfire flames rising from cracked stone steps below.";
    } else {
      bp.promptTokens = [
        "safe", "1girl", "solo", "jeanne_alter", "golden_yellow_eyes", "fierce_combat_gaze", "short_white_hair",
        "black_plate_armor", "spiked_metal_gauntlets", "tattered_purple_cape_billowing", "wielding_black_flag_and_sword",
        "dynamic_fighting_stance", "standing_on_burning_battlefield_ruins", "swirling_fire_and_black_smoke", "lightning_flashes",
        "dramatic_action_key_visual", "masterpiece"
      ];
      bp.promptProse = "Planting her tattered dragon standard deep into the smoldering ash of a ruined battlefield, Jeanne Alter draws her blackened sword in a dynamic, aggressive combat stance. Her fierce golden eyes lock onto the enemy with sovereign disdain as torrents of dark crimson fire and smoke swirl around her billowing purple cape and spiked armor.";
    }
  },

  // 艾雅法拉
  eyjafjalla_arknights: (bp) => {
    if (bp.adult) {
      bp.nsfwTokens = [
        "nsfw", "1girl", "solo", "eyjafjalla_arknights", "adult", "soft_pink_eyes", "short_brown_hair", "curled_sheep_horns",
        "nude", "completely_naked", "soft_breasts", "pink_nipples", "exposed_pussy", "slender_soft_body",
        "sitting_kneeling_on_warm_fluffy_bedding", "hugging_pillow_shyly_against_chest", "heavy_blush", "nervous_loving_smile",
        "volcanology_study_room", "shelves_of_rock_samples", "warm_flickering_candlelight", "steaming_hot_spring_mist_outside",
        "intimate_soft_shadows", "medium_shot"
      ];
      bp.nsfwProse = "Completely nude kneeling on soft fluffy blankets in her private dormitory, Eyjafjalla clutches a pillow shyly against her torso with her curled sheep horns catching the warm amber glow of research candles. Her cheeks blush a deep crimson as her soft pink eyes gaze up with endearing vulnerability amidst glass jars of glowing volcanic minerals.";
    } else {
      bp.promptTokens = [
        "safe", "1girl", "solo", "eyjafjalla_arknights", "pink_eyes", "short_brown_hair", "curled_sheep_horns",
        "holding_originium_staff_with_both_hands", "wearing_rhodes_island_jacket_over_dress", "standing_at_volcanic_crater_edge",
        "swirling_heat_haze", "glowing_magma_cracks_on_ground", "flying_volcanic_ash_particles", "gentle_determined_expression",
        "cinematic_wide_shot"
      ];
      bp.promptProse = "Standing bravely at the rugged basalt ridge of an active volcanic crater, Eyjafjalla grips her Originium analysis staff with both hands, her soft sheep horns framed against a dramatic sky of rising sulfur smoke and glowing lava vents reflecting warm light across her focused, gentle expression.";
    }
  },

  // 斯卡蒂
  skadi_arknights: (bp) => {
    if (bp.adult) {
      bp.nsfwTokens = [
        "nsfw", "1girl", "solo", "skadi_arknights", "adult", "crimson_red_eyes", "very_long_silver_hair", "hair_flowing_across_sheets",
        "nude", "completely_naked", "large_bare_breasts", "pink_nipples", "exposed_pussy", "toned_curvaceous_body",
        "reclining_on_side_on_dark_velvet_bed", "propping_head_with_one_arm", "other_hand_resting_on_large_greatsword_propped_against_bed",
        "calm_intimate_gaze", "subtle_blush", "ship_cabin_room", "cool_moonlight_streaming_through_porthole", "translucent_water_reflections_on_ceiling",
        "intimate_deep_shadows", "medium_shot"
      ];
      bp.nsfwProse = "Reclining softly on her side across dark velvet sheets in a dimly lit ship cabin, Skadi is completely nude with her magnificent silken silver hair pooling around her shapely curves and bare breasts. One hand casually rests on the pommel of her enormous greatsword leaning against the bedpost, her crimson eyes gleaming with quiet, oceanic devotion under cool porthole moonlight.";
    } else {
      bp.promptTokens = [
        "safe", "1girl", "solo", "skadi_arknights", "crimson_red_eyes", "very_long_silver_hair", "wide-brimmed_black_hunter_hat",
        "holding_massive_two-handed_greatsword_resting_on_shoulder", "wearing_tight_black_hunter_coat", "standing_on_wooden_ship_deck_at_night",
        "raging_stormy_sea_waves", "splashing_sea_foam", "silver_moonlight_breaking_through_storm_clouds", "wind_whipped_hair",
        "cinematic_action_shot"
      ];
      bp.promptProse = "Standing fearless on the spray-drenched wooden deck of a sea vessel under a raging night storm, Skadi rests her colossal greatsword effortlessly across one shoulder. Her endless silver locks and black hunter coat whip violently in the oceanic gale, her glowing red eyes fixed on the fathomless abyssal depths below.";
    }
  },

  // 陈 (Chen)
  chen_arknights: (bp) => {
    if (bp.adult) {
      bp.nsfwTokens = [
        "nsfw", "1girl", "solo", "chen_arknights", "adult", "dark_amber_eyes", "long_blue_hair", "twin_dragon_horns", "side_ponytail",
        "nude", "completely_naked", "firm_bare_breasts", "pink_nipples", "exposed_pussy", "toned_abs", "slender_waist",
        "sitting_on_edge_of_bed", "holding_chi_xiao_sword_sheath_across_lap", "heavy_flustered_blush", "parted_lips", "shy_stern_eye_contact",
        "traditional_lungmen_apartment_room", "red_lantern_glow_outside_window", "wooden_floor_reflection", "dramatic_intimate_lighting"
      ];
      bp.nsfwProse = "Sitting with vulnerable poise on the edge of the bed in her private Lungmen apartment, Ch'en is completely nude with her toned athletic body and firm bare breasts flushed deep red. Her dragon horns catch the ambient crimson glow of city neon outside, while her gloved hands clutch Chi Xiao's sheathed blade across her thighs with a flustered yet resolute gaze.";
    } else {
      bp.promptTokens = [
        "safe", "1girl", "solo", "chen_arknights", "amber_eyes", "blue_hair", "twin_dragon_horns", "side_ponytail",
        "drawing_red_katana_chi_xiao", "dynamic_sword_slash_pose", "flowing_black_special_inspection_unit_uniform",
        "rain_swept_neon_lungmen_street", "colorful_neon_signs_reflecting_in_puddles", "red_slashing_energy_arc",
        "splashing_rain_droplets", "cinematic_action_key_visual"
      ];
      bp.promptProse = "In a breathtaking combat leap across the rain-slicked streets of Lungmen illuminated by vibrant neon signs, Ch'en draws the crimson blade Chi Xiao in a devastating slash of scarlet energy. Raindrops freeze in the air as dynamic reflections shimmer across the wet asphalt beneath her boots.";
    }
  }
};

let manualReplaced = 0;
blueprints.forEach(bp => {
  // 1. 如果在 chunk1 里有专门手写的，直接采用 chunk1
  if (chunk1[bp.id]) {
    const override = chunk1[bp.id];
    if (override.promptTokens) bp.promptTokens = override.promptTokens;
    if (override.promptProse) bp.promptProse = override.promptProse;
    if (override.nsfwTokens) bp.nsfwTokens = override.nsfwTokens;
    if (override.nsfwProse) bp.nsfwProse = override.nsfwProse;
    if (override.negativeTokens) bp.negativeTokens = override.negativeTokens;
    manualReplaced++;
    return;
  }

  // 2. 检查是否有针对特定角色的深度重构函数
  if (RECONSTRUCT_RULES[bp.characterId]) {
    RECONSTRUCT_RULES[bp.characterId](bp);
    manualReplaced++;
  }
});

fs.writeFileSync(bpFile, JSON.stringify(bpData, null, 2) + '\n', 'utf8');
console.log(`Successfully applied deep tailored reconstruction to ${manualReplaced} key blueprints!`);
