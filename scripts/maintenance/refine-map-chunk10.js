/**
 * 热门角色未通过场景蓝图的【手工级逐场景深度重构映射表 - Chunk 10】
 * 覆盖：全量剩余热门角色未通过蓝图（初音未来、雷电将军、玛奇玛、黑贞德、阿尔托莉雅等全部剩余）
 */

module.exports = {
  // ─── 初音未来 (Hatsune Miku) 2 个场景 ────────────────────────────────
  "hatsune_miku_r18_barefoot_sofa": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "hatsune_miku", "adult", "turquoise_eyes", "extremely_long_cyan_twintails_flowing_across_sofa", "pink_hair_ribbons",
      "nude", "completely_naked", "petite_firm_breasts", "pink_nipples", "exposed_pussy", "slender_waist", "shapely_bare_legs",
      "lounging_on_modern_studio_leather_couch", "hugging_cyan_cushion_against_side", "holding_headphones_around_neck",
      "flustered_radiant_smile", "blushing_cheeks", "cyberpunk_recording_studio_room", "glowing_neon_equalizer_displays_and_audio_mixers",
      "soft_cyan_and_magenta_ambient_lighting", "medium_shot"
    ],
    nsfwProse: "Lounging gracefully across a black leather studio sofa in her soundproof recording lounge, Hatsune Miku is completely nude with her endless cyan twintails cascading in silken waves over the cushions. Wearing studio monitor headphones loosely around her neck, she hugs a cushion with an adorably flustered, radiant smile as glowing neon audio equalizers bathe her petite bare curves in rich cyan and magenta light.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "clothes", "dress", "daylight"]
  },
  "hatsune_miku_r18_studio_night": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "hatsune_miku", "adult", "cyan_eyes", "long_twintails", "hair_ornaments",
      "nude", "completely_naked", "perky_breasts", "pink_nipples", "exposed_pussy", "wearing_only_sheer_black_thighhigh_stockings",
      "sitting_on_revolving_studio_chair_in_front_of_synthesizer", "leaning_forward_pressing_piano_keys", "sweet_concentrated_blush",
      "music_production_studio_at_midnight", "glowing_soundboard_dials_and_monitors", "warm_moody_lighting", "medium_shot"
    ],
    nsfwProse: "Sitting on a swivel studio chair before a glowing multi-tier synthesizer keyboard at midnight, Miku is completely nude except for sheer black thigh-high stockings. Pressing a glowing key with delicate fingers while her cyan twintails frame her bare waist, her eyes reflect the soft neon interface lights with an intimate, focused blush.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "fishnet", "fishnets", "clothes"]
  },

  // ─── 雷电将军 (Raiden Shogun) 剩余 1 个未通过场景 ─────────────────────
  "raiden_shogun_r18_bath": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "raiden_shogun", "adult", "purple_eyes", "long_purple_braid", "glowing_electro_symbol_on_back",
      "nude", "completely_naked", "large_shapely_breasts", "pink_nipples", "exposed_pussy", "slender_waist",
      "soaking_in_steaming_private_onsen_bath_in_tenshukaku", "resting_arms_on_smooth_cypress_wood_rim", "wet_skin", "glistening_droplets_on_shoulders",
      "subtle_crackling_purple_lightning_arcs_on_water_surface", "flushed_regal_expression", "intimate_warm_gaze",
      "traditional_japanese_imperial_bathhouse", "shoji_screens_open_to_moonlit_sakura_garden", "translucent_water_ripples", "medium_shot"
    ],
    nsfwProse: "Submerged in the steaming private hot spring of the Tenshukaku imperial pavilion, Raiden Shogun rests her arms upon the polished cypress rim, completely nude with faint violet lightning arcs crackling gently across the rippling mineral water. Her endless braided purple hair rests over her fair, flushed shoulder as her glowing purple eyes gaze with regal, intimate vulnerability into the moonlit sakura gardens outside.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "clothes", "kimono", "swimsuit", "murky water"]
  },

  // ─── 阿尔托莉雅 (Artoria Pendragon) 剩余 3 个未通过场景 ───────────────
  "artoria_moonlit_city": {
    promptTokens: [
      "safe", "1girl", "solo", "artoria_pendragon", "green_eyes", "blonde_hair", "braided_bun", "ahoge", "blue_hair_ribbon",
      "wearing_casual_white_blouse_and_blue_pleated_skirt", "standing_on_fuyuki_bridge_overlook", "holding_bridge_railing_with_both_hands",
      "looking_at_fuyuki_night_skyline", "gentle_thoughtful_smile", "silver_full_moon_reflecting_in_river_below", "city_night_lights",
      "wind_blowing_skirt_and_ribbon", "cinematic_medium_shot"
    ],
    promptProse: "Standing on the high arched pedestrian bridge of Fuyuki City at midnight, Artoria rests her hands on the iron railing, gazing out over the glittering cityscape and the moonlit river below. Dressed in her casual white blouse and royal blue skirt, the nocturnal breeze flutters her golden bangs and blue ribbon, her emerald eyes reflecting the calm silver light of the full moon.",
    negativeTokens: ["worst quality", "low quality", "blurry", "bad anatomy", "extra fingers", "battle armor", "daylight"]
  },
  "artoria_r18_apartment_morning": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "artoria_pendragon", "adult", "emerald_green_eyes", "messy_morning_blonde_hair", "ahoge",
      "nude", "completely_naked", "firm_shapely_breasts", "pink_nipples", "exposed_pussy", "slender_waist",
      "sitting_on_edge_of_sunlit_bed", "stretching_arms_overhead", "arching_back", "sleepy_innocent_blush",
      "parted_lips", "modern_japanese_apartment_bedroom", "golden_morning_sunlight_streaming_through_sheer_curtains",
      "warm_dust_motes_in_air", "natural_gravity_body_deformation", "medium_shot"
    ],
    nsfwProse: "Sitting on the edge of the bed in the bright morning light, Artoria stretches her arms high overhead with an arched back, completely nude with her firm fair breasts and toned midriff catching the warm golden sunbeams. Her messy blonde hair and ahoge glow in the sun as her emerald eyes blink away sleep with an endearing, innocent blush.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "clothes", "armor", "night"]
  },
  "artoria_r18_castle_bath": {
    nsfwTokens: [
      "nsfw", "1girl", "solo", "artoria_pendragon", "adult", "green_eyes", "wet_blonde_hair_pinned_up", "ahoge",
      "nude", "completely_naked", "firm_bare_breasts", "pink_nipples", "exposed_pussy", "toned_body",
      "soaking_in_ancient_castle_stone_bath", "resting_arms_on_stone_rim", "wet_skin", "droplets_on_collarbone",
      "heavy_steamy_blush", "regal_yet_shy_gaze", "camelot_gothic_bathhouse", "warm_torchlight_and_moonlight_beam",
      "translucent_water_ripples", "medium_shot"
    ],
    nsfwProse: "Submerged inside the grand stone bath of a Camelot stronghold, Artoria is completely nude, resting her arms along the carved limestone edge with water droplets glistening on her defined collarbones and firm bare breasts. Her cheeks flush with noble modesty under the warm flickering torchlight, contrasting with a cool shaft of blue moonlight piercing the high gothic arch.",
    negativeTokens: ["worst quality", "low quality", "bad anatomy", "extra fingers", "clothes", "armor", "murky water"]
  }
};
