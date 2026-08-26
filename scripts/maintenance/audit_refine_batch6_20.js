/**
 * Batch6: 20 more low-quality leaks
 */
const fs=require('fs'), path=require('path')
const ROOT=path.resolve(__dirname,'../..')
const fixes={
  sc079:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_navy_blouse_and_pleated_miniskirt_with_sheer_black_thighhigh_stockings, matte_black_thighhighs_hugging_smooth_thighs_with_faint_garter_line, entire_legs_and_feet_fully_visible_in_frame, brown_loafers_on_rainy_platform, standing_on_rainy_train_platform_after_rain_holding_umbrella_at_side, gentle_shy_smile_with_soft_rain_bokeh, soft_overcast_light_with_puddle_reflections, cinematic_depth_of_field, slender_waist_and_collarbone, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","blouse","pleated_skirt","sheer_black_thighhigh_stockings","smooth_thighs","rain","platform","full_body","loafers","depth_of_field"],
    animaCaption:"Standing on the rainy train platform after the rain, Shiki Natsume in a navy blouse and pleated skirt shows matte black thighhighs hugging smooth thighs, brown loafers on the wet platform, soft rain bokeh and puddle reflections.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc081:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, black_headband, wearing_soft_grey_off_shoulder_sweater_and_pajama_shorts_with_slender_bare_legs, smooth_thighs_with_soft_skin_sheen, barefoot_with_detailed_toes_on_bedsheets, lying_prone_on_bed_with_chin_resting_on_viewer_chest_looking_up_with_sleepy_blush, warm_morning_light_with_soft_shadows, cinematic_depth_of_field, delicate_collarbone_and_shoulder, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","off_shoulder_sweater","pajama_shorts","bare_legs","smooth_thighs","bedroom","full_body","barefoot","depth_of_field"],
    animaCaption:"Lying prone on the bed with chin resting on the viewer's chest, Shiki Natsume in a soft grey off-shoulder sweater shows slender bare legs with smooth thigh lines, bare feet with detailed toes on the bedsheets under warm morning light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, stockings, thighhighs, upper_body"
  },
  sc083:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_beige_cardigan_over_white_blouse_and_plaid_miniskirt_with_sheer_black_thighhigh_stockings, glossy_black_thighhighs_hugging_smooth_thighs_with_thigh_gap, entire_legs_and_feet_fully_visible_in_frame, brown_loafers_on_autumn_leaf_strewn_path, walking_on_autumn_leaf_path_with_one_hand_holding_bag_and_looking_back_over_shoulder, soft_autumn_light_with_leaf_bokeh, cinematic_depth_of_field, slender_waist_and_hands, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","cardigan","plaid_skirt","sheer_black_thighhigh_stockings","smooth_thighs","autumn","full_body","loafers","depth_of_field"],
    animaCaption:"Walking on the autumn leaf-strewn path, Shiki Natsume in a beige cardigan and plaid skirt shows glossy black thighhighs with a thigh gap, brown loafers on the path under soft autumn bokeh.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc084:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_white_summer_dress_with_puff_sleeves_and_sheer_white_thighhigh_stockings, silky_white_stockings_with_lace_trim_hugging_smooth_thighs, entire_legs_and_feet_fully_visible_in_frame, white_mary_jane_shoes_on_stage_floor, standing_on_school_stage_during_festival_with_hands_clasped_at_chest, bright_stage_light_with_bokeh_curtains, cinematic_depth_of_field, delicate_collarbone_and_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","summer_dress","sheer_white_thighhigh_stockings","smooth_thighs","stage","full_body","mary_jane","depth_of_field"],
    animaCaption:"Standing on the school stage during the festival in a white summer dress, Ayachi Nene shows silky white thighhighs with lace trim hugging smooth thighs, white Mary Jane shoes on the stage floor under bright stage light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc085:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_dark_jacket_over_plaid_miniskirt_with_sheer_black_tights, glossy_black_tights_with_smooth_thigh_sheen, entire_legs_and_feet_fully_visible_in_frame, brown_ankle_boots_on_cat_cafe_floor, sitting_in_cat_cafe_with_cat_on_lap_and_holding_tea_cup, gentle_composed_smile_with_blush, warm_cafe_light_with_bokeh, cinematic_depth_of_field, slender_hands_and_waist, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","jacket","plaid_skirt","sheer_black_tights","smooth_thighs","cat_cafe","full_body","ankle_boots","depth_of_field"],
    animaCaption:"Sitting in the cat cafe with a cat on her lap, Shiki Natsume in a dark jacket and plaid skirt shows glossy black tights with smooth thigh sheen, brown ankle boots on the floor under warm cafe light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc087:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_beige_blouse_and_pleated_miniskirt_with_sheer_black_thighhigh_stockings, matte_black_thighhighs_with_faint_garter_line, entire_legs_and_feet_fully_visible_in_frame, brown_loafers_on_apartment_floor, standing_in_apartment_holding_book_and_looking_at_viewer_with_soft_morning_greeting, warm_morning_light_with_bokeh, cinematic_depth_of_field, slender_waist_and_hands, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","blouse","pleated_skirt","sheer_black_thighhigh_stockings","smooth_thighs","apartment","full_body","loafers","depth_of_field"],
    animaCaption:"Standing in the apartment holding a book, Shiki Natsume in a beige blouse and pleated skirt shows matte black thighhighs with a faint garter line, brown loafers on the floor under warm morning light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc088:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_casual_white_blouse_and_pleated_beige_miniskirt_with_sheer_white_thighhigh_stockings, silky_white_stockings_with_faint_garter_band, smooth_thighs_with_thigh_gap, entire_legs_and_feet_fully_visible_in_frame, brown_loafers_on_shrine_approach, walking_on_shrine_approach_holding_omamori_with_gentle_smile, soft_autumn_light_with_bokeh, cinematic_depth_of_field, delicate_collarbone_and_hands, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","blouse","pleated_skirt","sheer_white_thighhigh_stockings","smooth_thighs","shrine","full_body","loafers","depth_of_field"],
    animaCaption:"Walking on the shrine approach holding an omamori, Ayachi Nene in a white blouse and beige pleated skirt shows silky white thighhighs with a faint garter band, brown loafers on the stone path under soft autumn light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc089:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_olive_jacket_over_plaid_miniskirt_with_sheer_black_tights, glossy_black_tights_with_smooth_thigh_sheen, entire_legs_and_feet_fully_visible_in_frame, brown_ankle_boots_on_campsite_grass, sitting_on_camping_stool_holding_outdoor_gear_with_calm_gaze, warm_camp_light_with_bokeh, cinematic_depth_of_field, slender_waist_and_hands, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","jacket","plaid_skirt","sheer_black_tights","smooth_thighs","camping","full_body","ankle_boots","depth_of_field"],
    animaCaption:"Sitting on a camping stool holding outdoor gear, Shiki Natsume in an olive jacket and plaid skirt shows glossy black tights with smooth thigh sheen, brown ankle boots on the grass under warm camp light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc091:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, black_headband, wearing_natsume_maid_uniform_with_white_apron_and_sheer_black_thighhigh_stockings, matte_black_thighhighs_hugging_smooth_thighs_with_garter_line, entire_legs_and_feet_fully_visible_in_frame, black_mary_jane_shoes_on_apartment_floor, standing_in_apartment_holding_tray_with_tea_cups_and_shy_blush, warm_apartment_light_with_bokeh, cinematic_depth_of_field, slender_hands_and_collarbone, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","maid_uniform","apron","sheer_black_thighhigh_stockings","smooth_thighs","apartment","full_body","mary_jane","depth_of_field"],
    animaCaption:"Standing in the apartment holding a tray with tea cups, Shiki Natsume in a maid uniform shows matte black thighhighs with a garter line, black Mary Jane shoes on the floor under warm apartment light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc092:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_soft_pink_pajama_set_with_white_lace_trim_and_oversized_cardigan, slender_bare_legs_with_smooth_thigh_lines_tucked_on_bed, barefoot_with_soft_toes_on_pillow, lying_on_bed_with_phone_held_to_ear_and_face_buried_in_pillow, shy_blush_with_warm_bedside_light, cinematic_depth_of_field, delicate_collarbone_and_shoulder, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","pajamas","bare_legs","smooth_thighs","bedroom","full_body","barefoot","depth_of_field"],
    animaCaption:"Lying on the bed in a soft pink pajama set holding a phone to her ear, Ayachi Nene shows slender bare legs with smooth thigh lines, bare feet with soft toes on the pillow under warm bedside light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, stockings, thighhighs, upper_body"
  },
  sc093:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_dark_blazer_and_pleated_miniskirt_with_sheer_black_thighhigh_stockings, glossy_black_thighhighs_with_thigh_gap, entire_legs_and_feet_fully_visible_in_frame, black_loafers_on_night_street, standing_on_night_street_holding_bag_with_composed_gaze, streetlamp_bokeh_with_rain_reflections, cinematic_depth_of_field, slender_waist_and_hands, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","blazer","pleated_skirt","sheer_black_thighhigh_stockings","smooth_thighs","night","full_body","loafers","depth_of_field"],
    animaCaption:"Standing on the night street holding a bag, Shiki Natsume in a dark blazer and pleated skirt shows glossy black thighhighs with a thigh gap, black loafers on the street under streetlamp bokeh.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc094:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_light_blue_one_piece_swimsuit_with_sheer_white_coverup_half_off_shoulders, sun_kissed_bare_legs_with_smooth_thigh_contours_and_wet_sheen, barefoot_with_detailed_toes_on_pool_deck, standing_by_pool_with_hands_clasped_and_shy_blush, bright_sunny_light_with_pool_reflections, cinematic_depth_of_field, slender_waist_and_collarbone, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","swimsuit","bare_legs","smooth_thighs","pool","full_body","barefoot","depth_of_field"],
    animaCaption:"Standing by the pool in a light blue swimsuit with a sheer white coverup, Ayachi Nene shows sun-kissed bare legs with smooth thigh contours and a wet sheen, bare feet with detailed toes on the deck under bright sunny light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, stockings, thighhighs, upper_body"
  },
  sc095:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_light_yukata_with_floral_pattern_and_sheer_white_thighhigh_stockings_peeking_below, soft_white_stockings_with_lace_trim_hugging_smooth_thighs, entire_legs_and_feet_fully_visible_in_frame, wooden_geta_on_ryokan_veranda, sitting_on_ryokan_veranda_holding_tea_cup_with_both_hands, warm_lantern_light_with_bokeh, cinematic_depth_of_field, slender_hands_and_collarbone, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","yukata","sheer_white_thighhigh_stockings","smooth_thighs","ryokan","full_body","geta","depth_of_field"],
    animaCaption:"Sitting on the ryokan veranda in a light yukata, Shiki Natsume shows sheer white thighhighs peeking below the hem hugging smooth thighs, wooden geta on the veranda under warm lantern light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc096:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_soft_white_knit_dress_with_off_shoulder_cut_and_sheer_white_thighhigh_stockings, silky_white_stockings_with_faint_garter_band, smooth_thighs_with_thigh_gap, entire_legs_and_feet_fully_visible_in_frame, cream_slippers_on_bedroom_floor, sitting_on_bed_with_hands_clasped_and_shy_blush, warm_bedroom_light_with_bokeh, cinematic_depth_of_field, delicate_collarbone_and_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","knit_dress","sheer_white_thighhigh_stockings","smooth_thighs","bedroom","full_body","slippers","depth_of_field"],
    animaCaption:"Sitting on the bed in a soft white knit dress, Ayachi Nene shows silky white thighhighs with a faint garter band, smooth thighs with a thigh gap, cream slippers on the floor under warm bedroom light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc098:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_pale_blue_sundress_with_puff_sleeves_and_sheer_white_thighhigh_stockings, silky_white_stockings_with_lace_trim, smooth_thighs_with_thigh_gap, entire_legs_and_feet_fully_visible_in_frame, white_mary_jane_shoes_on_garden_path, sitting_on_garden_bench_with_hands_on_knees_and_gentle_smile, warm_garden_light_with_bokeh, cinematic_depth_of_field, slender_waist_and_hands, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","sundress","sheer_white_thighhigh_stockings","smooth_thighs","garden","full_body","mary_jane","depth_of_field"],
    animaCaption:"Sitting on the garden bench in a pale blue sundress, Ayachi Nene shows silky white thighhighs with lace trim, smooth thighs with a gap, white Mary Jane shoes on the path under warm garden light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc099:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_beige_blouse_and_pleated_miniskirt_with_sheer_black_thighhigh_stockings, matte_black_thighhighs_with_faint_garter_line, entire_legs_and_feet_fully_visible_in_frame, brown_loafers_on_night_street, standing_on_night_street_holding_bag_with_calm_gaze, streetlamp_bokeh_with_soft_shadows, cinematic_depth_of_field, slender_waist_and_hands, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","blouse","pleated_skirt","sheer_black_thighhigh_stockings","smooth_thighs","night","full_body","loafers","depth_of_field"],
    animaCaption:"Standing on the night street holding a bag, Shiki Natsume in a beige blouse and pleated skirt shows matte black thighhighs with a faint garter line, brown loafers on the street under streetlamp bokeh.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc102:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_dark_blazer_and_navy_pleated_miniskirt_with_sheer_black_tights, glossy_black_tights_with_smooth_thigh_sheen, entire_legs_and_feet_fully_visible_in_frame, black_loafers_on_office_floor, standing_in_office_holding_documents_with_composed_gaze, bright_office_light_with_bokeh, cinematic_depth_of_field, slender_waist_and_hands, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","blazer","pleated_skirt","sheer_black_tights","smooth_thighs","office","full_body","loafers","depth_of_field"],
    animaCaption:"Standing in the office holding documents, Shiki Natsume in a dark blazer and pleated skirt shows glossy black tights with smooth thigh sheen, black loafers on the floor under bright office light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc103:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_soft_pink_loungewear_with_white_lace_trim_and_sheer_white_thighhigh_stockings, silky_white_stockings_hugging_smooth_thighs_with_thigh_gap, entire_legs_and_feet_fully_visible_in_frame, white_slippers_on_bedroom_floor, sitting_on_bed_with_legs_tucked_and_holding_pillow_with_shy_blush, warm_bedroom_light_with_bokeh, cinematic_depth_of_field, delicate_collarbone_and_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","loungewear","sheer_white_thighhigh_stockings","smooth_thighs","bedroom","full_body","slippers","depth_of_field"],
    animaCaption:"Sitting on the bed with legs tucked and holding a pillow, Ayachi Nene in soft pink loungewear shows silky white thighhighs hugging smooth thighs with a gap, white slippers on the floor under warm bedroom light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, black_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc104:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_smart_casual_white_blouse_and_navy_blazer_with_pleated_miniskirt_and_sheer_black_thighhigh_stockings, glossy_black_thighhighs_with_thigh_gap, entire_legs_and_feet_fully_visible_in_frame, black_heels_on_office_floor, standing_in_office_holding_tablet_with_composed_blush, bright_office_light_with_bokeh, cinematic_depth_of_field, slender_waist_and_hands, full_body, <lora:shiki_natsume_v18_wd14:0.85>",
    tags:["mole_under_eye","blouse","blazer","pleated_skirt","sheer_black_thighhigh_stockings","smooth_thighs","office","full_body","heels","depth_of_field"],
    animaCaption:"Standing in the office holding a tablet, Shiki Natsume in a white blouse, navy blazer and pleated skirt shows glossy black thighhighs with a thigh gap, black heels on the floor under bright office light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
  },
  sc105:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_elegant_black_lace_dress_with_sheer_black_thighhigh_stockings_and_garter, lace_thighhighs_hugging_smooth_thighs_with_thigh_gap_and_lace_trim, entire_legs_and_feet_fully_visible_in_frame, black_heels_on_stage_floor, standing_on_stage_holding_microphone_with_confident_blush, bright_stage_light_with_bokeh, cinematic_depth_of_field, delicate_collarbone_and_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["hair_ribbon","lace_dress","sheer_black_thighhigh_stockings","smooth_thighs","stage","full_body","heels","depth_of_field"],
    animaCaption:"Standing on stage holding a microphone, Ayachi Nene in an elegant black lace dress shows lace thighhighs hugging smooth thighs with a gap and lace trim, black heels on the stage floor under bright stage light.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, white_thighhighs, bare_legs, cropped_feet, upper_body"
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
      s.auditRevision='audit-v25-2026-08-26-batch6'
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
console.log(`APPLIED batch6 ${total}`)
