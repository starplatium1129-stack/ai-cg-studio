/**
 * Batch4: 继续扩服饰多样性 + 单人+大腿/丝袜细化
 */
const fs=require('fs'), path=require('path')
const ROOT=path.resolve(__dirname,'../..')
const fixes={
  sc011:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, black_headband, wearing_smart_casual_college_knit_cardigan_over_white_blouse_and_checkered_pleated_miniskirt, sheer_black_tights_with_glossy_opaque_thigh_sheen_and_subtle_garter_line, smooth_thighs_at_hem_with_soft_pressure_line, entire_legs_and_feet_fully_visible_in_frame, dark_brown_loafers_under_tiered_lecture_hall_desk, sitting_at_wooden_tiered_desk_by_tall_arched_window_holding_pen_above_open_notebook, turning_head_with_startled_tsundere_blush, brilliant_morning_sunbeams_slicing_through_windows_with_floating_dust_motes, tiered_classroom_with_chalkboard_background, cinematic_depth_of_field, slender_waist_and_graceful_neck, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","university_classroom","knit_cardigan","checkered_skirt","sheer_black_tights","smooth_thighs","window_light","full_body","loafers","depth_of_field"],
    animaCaption:"Sitting at the tiered lecture hall desk by the tall arched window, Shiki Natsume turns with a startled tsundere blush, pen above her notebook. Glossy black tights hug smooth thighs at the checkered hem, brown loafers under the desk, morning sunbeams slicing through windows with dust motes.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc025:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, two_pink_hair_ribbons, wearing_cute_white_sundress_with_puff_sleeves_and_sheer_white_thighhigh_stockings_with_lace_trim, silky_white_stockings_hugging_smooth_thighs_with_thigh_gap_and_garter_crease, entire_legs_and_feet_fully_visible_in_frame, white_mary_jane_shoes_on_aquarium_glass_tunnel_floor, standing_inside_glass_aquarium_tunnel_looking_up_as_whale_shark_glides_overhead, hands_pressing_against_glass_with_joyful_blush, deep_blue_aquarium_light_with_rippling_water_reflections_on_hair_and_dress, cinematic_depth_of_field, slender_waist_and_delicate_collarbone, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","sundress","sheer_white_thighhigh_stockings","smooth_thighs","aquarium","whale_shark","full_body","mary_jane","depth_of_field"],
    animaCaption:"Inside the glass aquarium tunnel, Ayachi Nene in a white sundress and lace-top white thighhighs looks up as a whale shark glides overhead. Silky white stockings hug smooth thighs with a thigh gap, Mary Jane shoes on the tunnel floor, deep blue rippling light reflecting on hair.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc026:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, black_headband, wearing_navy_gym_track_jacket_over_white_t_shirt_and_navy_gym_shorts_with_white_sheer_tights, glossy_white_tights_hugging_smooth_thighs_with_knee_contours_and_subtle_sheen, entire_legs_and_feet_fully_visible_in_frame, white_sneakers_on_gym_wooden_floor, trapped_in_narrow_gym_storage_room_standing_close_to_viewer_with_back_against_shelf, checking_door_lock_with_composed_expression_then_blushing_as_distance_closes, high_window_slanted_light_with_dust_motes_and_shadows, cinematic_depth_of_field, slender_waist_and_graceful_neck, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","gym_track_jacket","gym_shorts","white_tights","smooth_thighs","storage_room","full_body","sneakers","depth_of_field"],
    animaCaption:"Trapped in the narrow gym storage room, Shiki Natsume in a navy track jacket and gym shorts shows glossy white tights hugging smooth thighs, white sneakers on the wooden floor, high window light slanting with dust motes as she blushes at the close distance.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc033:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, black_headband, wearing_cozy_cream_knit_sweater_over_plaid_miniskirt_with_sheer_black_thighhigh_stockings, matte_black_thighhighs_hugging_smooth_thighs_with_faint_garter_line, entire_legs_and_feet_fully_visible_in_frame, brown_ankle_boots_on_apartment_entrance_floor, hiding_behind_apartment_entrance_door_holding_small_birthday_cake_with_single_candle, peeking_with_heavy_blush_as_candlelight_flickers, dim_entrance_shadows_vs_warm_candle_bokeh, cinematic_depth_of_field, slender_hands_and_waist, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","knit_sweater","plaid_skirt","sheer_black_thighhigh_stockings","smooth_thighs","birthday_cake","entrance","full_body","ankle_boots","depth_of_field"],
    animaCaption:"Hiding behind the apartment entrance door holding a small birthday cake with a single candle, Shiki Natsume in a cream sweater and plaid skirt shows matte black thighhighs hugging smooth thighs, brown ankle boots on the floor, candlelight flickering against dim shadows.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc034:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, two_pink_hair_ribbons, wearing_loose_white_art_smock_over_pastel_pink_dress_with_bare_legs_and_paint_splattered_socks, slender_bare_legs_with_smooth_thigh_contours_sitting_cross_legged_on_wooden_floor, barefoot_with_paint_smudged_toes_on_canvas_drop_cloth, sitting_cross_legged_holding_fine_paintbrush_over_large_starry_sky_canvas, sleepy_blush_with_paint_on_hair_and_cheeks, soft_blue_dawn_light_with_golden_twilight_through_skylights, cinematic_depth_of_field, delicate_collarbone_and_slender_fingers, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","art_smock","pastel_dress","bare_legs","smooth_thighs","art_room","barefoot","paint_splatter","full_body","depth_of_field"],
    animaCaption:"Sitting cross-legged on the wooden art studio floor in a loose white smock over a pink dress, Ayachi Nene holds a fine paintbrush over a large starry sky canvas. Slender bare legs with smooth thigh contours, bare feet with paint-smudged toes on the drop cloth, soft blue dawn light with golden twilight.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, stockings, thighhighs, upper_body"
  },
  sc037:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, black_headband, wearing_smart_casual_trench_coat_over_dark_pleated_miniskirt_with_sheer_black_tights, glossy_black_tights_with_smooth_thigh_sheen_and_calf_contours, entire_legs_and_feet_fully_visible_in_frame, brown_ankle_boots_on_mossy_stone_steps, standing_on_mossy_temple_stone_steps_holding_small_omamori_charm_extended_toward_viewer, misty_morning_light_with_faint_sun_through_fog_and_dew_on_hair, cinematic_depth_of_field, slender_waist_and_graceful_hands, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","trench_coat","pleated_skirt","sheer_black_tights","smooth_thighs","temple","omamori","full_body","ankle_boots","depth_of_field"],
    animaCaption:"Standing on mossy temple stone steps holding a small omamori charm toward the viewer, Shiki Natsume in a trench coat and pleated skirt shows glossy black tights with smooth thigh sheen, brown ankle boots on the steps, misty morning light through fog.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc038:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, two_pink_hair_ribbons, wearing_warm_beige_duffle_coat_over_navy_pleated_miniskirt_with_sheer_black_tights, glossy_black_tights_hugging_smooth_thighs_with_knee_contours_and_thigh_gap, entire_legs_and_feet_fully_visible_in_frame, brown_loafers_on_wet_rainy_street, standing_under_streetlamp_in_rain_holding_umbrella_tightly_with_both_hands_and_turning_back_with_teary_blush, rain_droplets_on_coat_and_hair_with_puddle_reflections, soft_overcast_light_with_lamp_glow_and_bokeh, cinematic_depth_of_field, slender_waist_and_collarbone, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","duffle_coat","pleated_skirt","sheer_black_tights","smooth_thighs","rain","streetlamp","umbrella","full_body","loafers","depth_of_field"],
    animaCaption:"Standing under a streetlamp in the rain holding an umbrella tightly, Ayachi Nene in a beige duffle coat and pleated skirt shows glossy black tights hugging smooth thighs with a thigh gap, brown loafers on the wet street, rain droplets on hair with lamp bokeh.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, sunny, upper_body"
  },
  sc058:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_white_silk_sleep_robe_half_open_over_pink_lace_lingerie_with_sheer_white_thighhigh_stockings, soft_white_stockings_with_lace_trim_hugging_smooth_thighs_and_thigh_gap, entire_legs_and_feet_fully_visible_in_frame, white_slippers_on_bedroom_carpet, standing_before_bedroom_full_length_mirror_holding_smartphone_behind_back_and_robe_at_chest, heavy_blush_with_morning_light_through_sheer_curtains, cinematic_depth_of_field, delicate_collarbone_and_shoulder, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","silk_robe","lace_lingerie","sheer_white_thighhigh_stockings","smooth_thighs","bedroom_mirror","full_body","slippers","depth_of_field"],
    animaCaption:"Standing before the bedroom full-length mirror in a white silk robe half-open over pink lace lingerie, Ayachi Nene's sheer white thighhighs with lace trim hug smooth thighs with a gap, white slippers on the carpet, heavy blush with morning light through sheer curtains.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body, smartphone_text"
  },
  sc059:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_oversized_white_mens_shirt_with_two_top_buttons_undone_as_sleepwear, slender_bare_legs_with_smooth_thigh_and_calf_lines_standing_in_kitchen, barefoot_with_detailed_toes_on_kitchen_tiles, standing_in_kitchen_holding_steaming_coffee_mug_with_both_hands_half_hiding_face, shy_blush_with_morning_window_light_and_steam, cinematic_depth_of_field, delicate_collarbone_and_shoulder, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","white_shirt","oversized_shirt","bare_legs","smooth_thighs","kitchen","barefoot","full_body","depth_of_field"],
    animaCaption:"Standing in the kitchen in an oversized white men's shirt with two top buttons undone, Shiki Natsume shows slender bare legs with smooth thigh lines, bare feet with detailed toes on tiles, holding a steaming coffee mug half-hiding her shy blush in morning window light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, stockings, thighhighs, tights, upper_body"
  },
  sc061:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, black_headband, wearing_white_bath_towel_wrapped_around_body_with_sheer_white_thighhigh_stockings_visible_below, soft_thighs_with_lace_trim_and_thigh_gap, entire_legs_and_feet_fully_visible_in_frame, white_slippers_on_bathroom_tiles, stumbling_into_viewer_arms_at_bathroom_doorway_with_one_hand_holding_towel_at_chest, heavy_blush_with_steam_and_warm_bathroom_light, cinematic_depth_of_field, slender_shoulder_and_collarbone, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","bath_towel","bathroom","sheer_white_thighhigh_stockings","smooth_thighs","full_body","slippers","depth_of_field"],
    animaCaption:"Stumbling into the viewer's arms at the bathroom doorway wrapped in a white towel, Shiki Natsume's sheer white thighhighs visible below the towel hug soft thighs with lace trim and a gap, white slippers on tiles, heavy blush with steam and warm light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc062:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_soft_pink_pajama_short_set_with_white_lace_trim, slender_bare_legs_with_smooth_thigh_contours_lying_under_blanket, barefoot_with_soft_toes_peeking_from_blanket, lying_in_bed_with_blanket_pulled_to_waist_holding_viewer_wrist_against_cheek, sleepy_blush_with_morning_light_through_sheer_curtains, cinematic_soft_light_and_depth_of_field, delicate_collarbone_and_shoulder, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","pajamas","bare_legs","smooth_thighs","bedroom","blanket","barefoot","full_body","depth_of_field"],
    animaCaption:"Lying in bed with the blanket pulled to her waist in a soft pink pajama set, Ayachi Nene holds the viewer's wrist against her cheek. Slender bare legs with smooth thigh contours, bare feet peeking from the blanket, sleepy blush with morning light through sheer curtains.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, stockings, thighhighs, upper_body"
  },
  sc063:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_soft_grey_off_shoulder_sweater_with_pajama_shorts, slender_bare_legs_with_smooth_thigh_lines_tucked_on_bed, barefoot_with_detailed_toes_on_bedsheets, lying_prone_on_bed_with_chin_resting_on_viewer_chest_looking_up_with_teary_blush, warm_morning_light_with_soft_shadows, cinematic_depth_of_field, delicate_collarbone_and_shoulder, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","off_shoulder_sweater","pajama_shorts","bare_legs","smooth_thighs","bedroom","barefoot","full_body","depth_of_field"],
    animaCaption:"Lying prone on the bed with her chin resting on the viewer's chest looking up with a teary blush, Shiki Natsume in a soft grey off-shoulder sweater and pajama shorts shows slender bare legs with smooth thigh lines, bare feet with detailed toes on the bedsheets under warm morning light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, stockings, thighhighs, upper_body"
  },
  sc065:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_beige_blouse_and_plaid_miniskirt_with_sheer_black_thighhigh_stockings, matte_black_thighhighs_hugging_smooth_thighs_with_faint_garter_line, entire_legs_and_feet_fully_visible_in_frame, brown_loafers_on_library_carpet, sitting_at_library_window_table_holding_book_up_to_half_cover_blushing_face, peeking_over_book_edge_with_shy_gaze, warm_window_light_with_dust_motes_and_bokeh, cinematic_depth_of_field, slender_hands_and_waist, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","blouse","plaid_skirt","sheer_black_thighhigh_stockings","smooth_thighs","library","window_light","full_body","loafers","depth_of_field"],
    animaCaption:"Sitting at the library window table holding a book half-covering her blushing face, Shiki Natsume in a beige blouse and plaid skirt shows matte black thighhighs hugging smooth thighs with a faint garter line, brown loafers on the carpet, warm window light with dust motes.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, side_profile, upper_body"
  },
  sc067:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_three_distinct_date_outfits_layered_nene_style_for_try_on_fitting_room, sheer_black_thighhigh_stockings_with_glossy_weave_visible_under_miniskirt_hem, smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, brown_ankle_boots_on_fitting_room_carpet, standing_in_fitting_room_holding_hanger_with_third_outfit_and_adjusting_hairclip_with_shy_expectant_gaze_toward_viewer, bright_fitting_room_mirror_lights_with_bokeh, cinematic_depth_of_field, slender_waist_and_collarbone, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","fitting_room","date_outfit","sheer_black_thighhigh_stockings","smooth_thighs","full_body","ankle_boots","depth_of_field"],
    animaCaption:"Standing in the fitting room holding a hanger with her third date outfit, Shiki Natsume's glossy black thighhighs hug smooth thighs with a thigh gap under the miniskirt hem, brown ankle boots on the carpet, bright mirror lights with a shy expectant gaze.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc070:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_light_pink_silk_nightgown_with_lace_trim_and_sheer_white_thighhigh_stockings, soft_white_stockings_with_lace_top_hugging_smooth_thighs_and_thigh_gap, entire_legs_and_feet_fully_visible_in_frame, white_slippers_on_bedroom_floor, standing_by_floor_to_ceiling_window_with_sheer_curtain_backlit_by_golden_sunset, silhouette_with_sheer_fabric_transparency_and_lace_details, shy_blush_with_hands_holding_curtain, cinematic_backlight_and_depth_of_field, delicate_collarbone_and_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","silk_nightgown","sheer_white_thighhigh_stockings","smooth_thighs","bedroom_window","sunset","backlight","full_body","slippers","depth_of_field"],
    animaCaption:"Standing by the floor-to-ceiling window with sheer curtains backlit by golden sunset, Ayachi Nene in a light pink silk nightgown shows soft white thighhighs with lace top hugging smooth thighs and a gap, white slippers on the floor, silhouette with sheer fabric transparency.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc071:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_dark_jacket_over_plaid_miniskirt_with_sheer_black_tights, glossy_black_tights_with_smooth_thigh_sheen_and_calf_contours, entire_legs_and_feet_fully_visible_in_frame, brown_ankle_boots_on_mountain_ground, sitting_outside_tent_under_starlit_sky_holding_flashlight_pointing_at_constellation, gentle_composed_gaze_with_subtle_blush, starlight_and_moonlight_with_camp_lamp_warm_glow, cinematic_depth_of_field, slender_hands_and_waist, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","jacket","plaid_skirt","sheer_black_tights","smooth_thighs","camping","starry_sky","full_body","ankle_boots","depth_of_field"],
    animaCaption:"Sitting outside the tent under the starlit sky holding a flashlight pointing at a constellation, Shiki Natsume in a dark jacket and plaid skirt shows glossy black tights with smooth thigh sheen, brown ankle boots on the mountain ground, starlight and camp lamp glow.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc073:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_light_pink_yukata_with_white_floral_pattern_and_obijime, slender_bare_legs_with_smooth_thigh_and_calf_lines_sitting_on_ryokan_engawa, barefoot_with_detailed_toes_on_wooden_veranda, sitting_on_ryokan_engawa_holding_cold_milk_bottle_with_both_hands_after_bath, gentle_blush_with_lantern_light_and_snow_reflections, evening_snow_with_warm_lantern_bokeh, cinematic_depth_of_field, delicate_collarbone_and_shoulder, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","yukata","bare_legs","smooth_thighs","ryokan","barefoot","full_body","depth_of_field"],
    animaCaption:"Sitting on the ryokan engawa after a bath in a light pink yukata, Shiki Natsume holds a cold milk bottle with both hands. Slender bare legs with smooth thigh lines, bare feet with detailed toes on the wooden veranda, lantern light with snow reflections.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, stockings, thighhighs, upper_body"
  },
  sc074:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_cute_casual_white_blouse_with_pleated_beige_miniskirt, sheer_white_thighhigh_stockings_with_silky_luster_and_faint_garter_band, smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, brown_loafers_on_amusement_park_pavement, running_toward_viewer_holding_cotton_candy_and_ferris_wheel_ticket_with_joyful_blush, evening_sunset_light_with_ferris_wheel_bokeh, cinematic_depth_of_field, slender_waist_and_hands, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","blouse","pleated_skirt","sheer_white_thighhigh_stockings","smooth_thighs","amusement_park","cotton_candy","full_body","loafers","depth_of_field"],
    animaCaption:"Running toward the viewer holding cotton candy and a Ferris wheel ticket, Ayachi Nene in a white blouse and beige pleated skirt shows silky white thighhighs with a faint garter band, smooth thighs with a gap, brown loafers on the amusement park pavement at sunset bokeh.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc075:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_navy_blouse_and_pleated_miniskirt_with_sheer_black_tights, glossy_black_tights_hugging_smooth_thighs_with_subtle_garter_line, entire_legs_and_feet_fully_visible_in_frame, brown_loafers_on_aquarium_floor, standing_before_huge_aquarium_glass_wall_looking_up_at_school_of_fish_with_calm_gaze, blue_water_ripples_reflecting_on_hair_and_clothes, cinematic_depth_of_field, slender_waist_and_neck, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","blouse","pleated_skirt","sheer_black_tights","smooth_thighs","aquarium","full_body","loafers","depth_of_field"],
    animaCaption:"Standing before the huge aquarium glass wall looking up at a school of fish, Shiki Natsume in a navy blouse and pleated skirt shows glossy black tights hugging smooth thighs, brown loafers on the floor, blue water ripples reflecting on hair.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc077:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_elegant_dark_blue_kimono_with_white_obijime, slender_bare_legs_with_subtle_knee_line_sitting_seiza_on_tatami, white_tabi_socks_with_split_toe_on_tatami_mat, kneeling_on_tatami_holding_tea_bowl_with_both_hands_extended_toward_viewer, gentle_composed_gaze_with_subtle_blush, soft_window_light_with_tatami_bokeh, cinematic_depth_of_field, delicate_hands_and_collarbone, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","kimono","tatami","tea_bowl","white_tabi_socks","bare_legs","full_body","depth_of_field"],
    animaCaption:"Kneeling seiza on tatami in an elegant dark blue kimono, Shiki Natsume holds a tea bowl with both hands extended toward the viewer. Slender bare legs with subtle knee line, white tabi socks with split toes on the tatami mat, soft window light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, stockings, thighhighs, upper_body"
  }
}
const shards=['nene-core.json','nene-after-story.json','natsume-core.json','natsume-after-story.json','shared.json']
let total=0
for(const shard of shards){
  const p=path.join(ROOT,'data/scenes',shard)
  const arr=JSON.parse(fs.readFileSync(p,'utf8'))
  let cnt=0
  for(const s of arr){
    const fix=fixes[s.id]
    if(fix){
      s.prompt=fix.prompt; s.tags=fix.tags; s.animaCaption=fix.animaCaption; s.negative=fix.negative
      s.auditRevision='audit-v25-2026-08-26-batch4'
      cnt++; total++
    }
  }
  if(cnt){fs.writeFileSync(p,JSON.stringify(arr,null,2)+'\n','utf8'); console.log(`patched ${shard} ${cnt}`)}
}
const {loadSceneShards, writeAggregate}=require(path.join(ROOT,'scripts/runtime/scene-store'))
const {scenes, sources}=loadSceneShards()
writeAggregate(scenes)
console.log(`rebuilt aggregate ${scenes.length} ${sources.map(s=>s.entry.file+'='+s.scenes.length).join(', ')}`)
let writeShard=(name,list)=>{fs.writeFileSync(path.join(ROOT,'data',name),JSON.stringify(list,null,2)+'\n','utf8'); console.log(`regen ${name} ${list.length}`)}
const idx=JSON.parse(fs.readFileSync(path.join(ROOT,'data/scenes-index.json'),'utf8'))
writeShard('scenes-nene.json', scenes.filter(s=>s.char==='nene'))
writeShard('scenes-natsume.json', scenes.filter(s=>s.char==='natsume'))
writeShard('scenes-shared.json', scenes.filter(s=>s.char==='triad'||s.char==='shared'))
const coreIds=(idx.tiers&&idx.tiers.core)||[]
writeShard('scenes-core.json', coreIds.map(id=>scenes.find(s=>s.id===id)).filter(Boolean))
require(path.join(ROOT,'scripts/maintenance/precompress'))
console.log(`APPLIED batch4 ${total}`)
