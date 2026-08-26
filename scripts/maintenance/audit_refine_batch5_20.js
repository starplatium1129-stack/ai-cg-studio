/** Batch5: 扩服饰多样性 + 单人+大腿/丝袜 **/
const fs=require('fs'), path=require('path')
const ROOT=path.resolve(__dirname,'../..')
const fixes={
  sc079:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_natsume_school_uniform_with_navy_blazer_and_pleated_miniskirt, sheer_black_thighhigh_stockings_with_glossy_weave_hugging_smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, black_loafers_on_旧书店_floor, 书架间侧面中景_at_旧书店_during_afternoon, 【夏目_·_旧书店梯子上的停顿】秋日下午_action_with_shy_blush, warm_旧书店秋日下午窗光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["sitting", "volumetric_lighting", "sunset", "depth_of_field", "mole_under_eye", "thigh_gap", "window_light", "smooth_thighs", "full_body"],
    animaCaption:"At 旧书店 during afternoon, Shiki Natsume in natsume school uniform with navy blazer and pleated miniskirt shows sheer black thighhigh stockings with glossy weave hugging smooth thighs, black loafers fully visible, story moment: 【夏目 · 旧书店梯子上的停顿】秋日下午，夏目站在旧书店的木梯上翻找绝版书，黑色长发垂过肩侧。你在下方扶住梯子，她低头道 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc081:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_natsume_official_qipao_with_side_slit_and_floral_print, sheer_black_thighhigh_stockings_with_lace_top_hugging_smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, black_heels_on_和室_floor, 全身中景_at_和室_during_afternoon, 【夏目_·_和室午睡的无声许可】春日下午_action_with_shy_blush, warm_窗光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["sunbeam", "volumetric_lighting", "depth_of_field", "mole_under_eye", "casual_clothes", "thigh_gap", "lying", "smooth_thighs", "full_body"],
    animaCaption:"At 和室 during afternoon, Shiki Natsume in natsume official qipao with side slit and floral print shows sheer black thighhigh stockings with lace top hugging smooth thighs, black heels fully visible, story moment: 【夏目 · 和室午睡的无声许可】春日下午，夏目在和室整理旅行资料，不知不觉枕着坐垫睡着。纸门漏进细长阳光，你替她盖上薄毯 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc083:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_natsume_maid_uniform_with_white_apron_and_frills, sheer_black_thighhigh_stockings_with_matte_finish_hugging_smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, mary_jane_shoes_on_枫叶步道_floor, 全身远景_at_枫叶步道_during_afternoon, 【夏目_·_枫叶路上的确认】秋日下午，夏_action_with_shy_blush, warm_阳光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["looking_back", "volumetric_lighting", "walking", "sunset", "depth_of_field", "mole_under_eye", "thigh_gap", "smooth_thighs", "full_body"],
    animaCaption:"At 枫叶步道 during afternoon, Shiki Natsume in natsume maid uniform with white apron and frills shows sheer black thighhigh stockings with matte finish hugging smooth thighs, mary jane shoes fully visible, story moment: 【夏目 · 枫叶路上的确认】秋日下午，夏目沿着铺满枫叶的石板路走在前面，每隔一段就会不动声色地回头确认你的位置。你故意停 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc084:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_nene_blue_pajamas_with_cat_print, bare_legs_with_smooth_thigh_contours_hugging_smooth_thighs_with_smooth_thighs_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, barefoot_with_soft_toes_on_祭典会场_floor, 全身远景_at_祭典会场_during_night, 【宁宁_·_花火大会的侧脸】夏夜祭典上，_action_with_shy_blush, warm_灯笼光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["volumetric_lighting", "depth_of_field", "yukata", "night", "smile", "hair_ribbon", "smooth_thighs", "full_body"],
    animaCaption:"At 祭典会场 during night, Ayachi Nene in nene blue pajamas with cat print shows bare legs with smooth thigh contours hugging smooth thighs, barefoot with soft toes fully visible, story moment: 【宁宁 · 花火大会的侧脸】夏夜祭典上，宁宁穿着浴衣站在灯笼与人群之间，仰头等待下一束烟花。绚烂光影在她紫色眼睛里一层层 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc085:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_casual_date_outfit_with_beige_blouse_and_plaid_miniskirt, sheer_white_thighhigh_stockings_with_silky_sheen_hugging_smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, ankle_boots_on_猫咖啡_floor, 半身中景_at_猫咖啡_during_afternoon, 【夏目_·_猫咪替她说出的喜欢】冬日下午_action_with_shy_blush, warm_窗光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["sitting", "volumetric_lighting", "depth_of_field", "mole_under_eye", "thigh_gap", "window_light", "smooth_thighs", "sweater", "full_body"],
    animaCaption:"At 猫咖啡 during afternoon, Shiki Natsume in casual date outfit with beige blouse and plaid miniskirt shows sheer white thighhigh stockings with silky sheen hugging smooth thighs, ankle boots fully visible, story moment: 【夏目 · 猫咪替她说出的喜欢】冬日下午的猫咖里，一只猫蜷在夏目腿上睡得很熟。她表面嫌弃无法起身，手指却一直轻轻梳理猫毛 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc087:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_oversized_white_shirt_as_sleepwear, slender_bare_legs_with_smooth_thigh_lines_hugging_smooth_thighs_with_smooth_thighs_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, barefoot_with_detailed_toes_on_宿舍_floor, 半身中景_at_宿舍_during_morning, 【夏目_·_宿舍清晨的第一句话】春日清晨_action_with_shy_blush, warm_窗光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["sitting", "bedroom", "volumetric_lighting", "depth_of_field", "pajamas", "mole_under_eye", "smooth_thighs", "full_body"],
    animaCaption:"At 宿舍 during morning, Shiki Natsume in oversized white shirt as sleepwear shows slender bare legs with smooth thigh lines hugging smooth thighs, barefoot with detailed toes fully visible, story moment: 【夏目 · 宿舍清晨的第一句话】春日清晨，夏目穿着宽松睡衣坐在宿舍床边，黑色长发还有些凌乱。你送来借走的资料，她揉着眼睛 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc088:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_pale_blue_kimono_with_floral_pattern, white_tabi_socks_with_split_toe_hugging_smooth_thighs_with_smooth_thighs_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, bare_legs_peeking_on_画廊_floor, 全身远景_at_画廊_during_afternoon, 【宁宁_·_画框前共享的沉默】秋日下午，_action_with_shy_blush, warm_柔光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["looking_back", "volumetric_lighting", "standing", "depth_of_field", "hair_ribbon", "casual_clothes", "smooth_thighs", "full_body"],
    animaCaption:"At 画廊 during afternoon, Ayachi Nene in pale blue kimono with floral pattern shows white tabi socks with split toe hugging smooth thighs, bare legs peeking fully visible, story moment: 【宁宁 · 画框前共享的沉默】秋日下午，宁宁在画廊一幅描绘星空与归途的作品前停了很久。你走到身边后，她没有立刻解释感受， with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc089:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_natsume_school_uniform_with_navy_blazer_and_pleated_miniskirt, sheer_black_thighhigh_stockings_with_glossy_weave_hugging_smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, black_loafers_on_湖畔野餐草地_floor, 野餐垫半身中景_at_湖畔野餐草地_during_afternoon, 【夏目_·_野餐盒里多出来的一份】夏日湖_action_with_shy_blush, warm_夏日柔和阳光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["sitting", "volumetric_lighting", "lake", "depth_of_field", "smile", "mole_under_eye", "thigh_gap", "smooth_thighs", "full_body"],
    animaCaption:"At 湖畔野餐草地 during afternoon, Shiki Natsume in natsume school uniform with navy blazer and pleated miniskirt shows sheer black thighhigh stockings with glossy weave hugging smooth thighs, black loafers fully visible, story moment: 【夏目 · 野餐盒里多出来的一份】夏日湖畔，夏目把准备得过分整齐的野餐盒打开，里面正好有两人份三明治和水果。她说只是计算 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc091:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_natsume_official_qipao_with_side_slit_and_floral_print, sheer_black_thighhigh_stockings_with_lace_top_hugging_smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, black_heels_on_公寓浴室门口_floor, 门缝半身近景_at_公寓浴室门口_during_night, 【夏目_·_门外递来的换洗衣物】冬夜浴室_action_with_shy_blush, warm_浴室暖灯与夜间暗部_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["bathroom", "volumetric_lighting", "depth_of_field", "night", "mole_under_eye", "thigh_gap", "towel", "smooth_thighs", "full_body"],
    animaCaption:"At 公寓浴室门口 during night, Shiki Natsume in natsume official qipao with side slit and floral print shows sheer black thighhigh stockings with lace top hugging smooth thighs, black heels fully visible, story moment: 【夏目 · 门外递来的换洗衣物】冬夜浴室门没有关严，裹着浴巾的夏目只探出半张通红的脸，请你帮忙拿落在卧室的衣服。你把衣物 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc092:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_nene_red_cardigan_uniform_with_white_shirt_and_pleated_skirt, white_ankle_socks_with_soft_fleecy_texture_hugging_smooth_thighs_with_smooth_thighs_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, brown_loafers_on_同居公寓卧室_floor, 床边主观半身近景_at_同居公寓卧室_during_morning, 【成年_After_Story_·_起床_action_with_shy_blush, warm_春日清晨窗光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["sitting", "bedroom", "volumetric_lighting", "depth_of_field", "pajamas", "hair_ribbon", "smooth_thighs", "full_body"],
    animaCaption:"At 同居公寓卧室 during morning, Ayachi Nene in nene red cardigan uniform with white shirt and pleated skirt shows white ankle socks with soft fleecy texture hugging smooth thighs, brown loafers fully visible, story moment: 【成年 After Story · 起床后十分钟】成年同居后的春日清晨，宁宁披着你的衬衫坐在床边醒神，松开的领口不小心滑 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc093:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_natsume_cafe_uniform_with_white_blouse_and_brown_suspender_skirt, sheer_black_tights_with_opaque_thigh_sheen_hugging_smooth_thighs_with_smooth_thighs_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, brown_loafers_on_街上_floor, 伞下双人半身中景_at_街上_during_night, 【夏目_·_雨夜共伞的自然靠近】夏夜回家_action_with_shy_blush, warm_雨夜路灯与湿地反射_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["rain", "volumetric_lighting", "depth_of_field", "night", "blush", "mole_under_eye", "smooth_thighs", "full_body"],
    animaCaption:"At 街上 during night, Shiki Natsume in natsume cafe uniform with white blouse and brown suspender skirt shows sheer black tights with opaque thigh sheen hugging smooth thighs, brown loafers fully visible, story moment: 【夏目 · 雨夜共伞的自然靠近】夏夜回家途中，雨势让伞下的空间越来越窄。夏目主动挽住你的手臂，把两个人拉到不会淋湿的距离 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc094:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_light_pink_silk_nightgown_with_lace_trim, sheer_white_thighhigh_stockings_with_garter_lace_hugging_smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, white_slippers_on_婚纱店试衣区_floor, 全身中景_at_婚纱店试衣区_during_afternoon, 【成年_After_Story_·_婚纱_action_with_shy_blush, warm_试衣区柔和窗光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["cherry_blossoms", "volumetric_lighting", "dress", "depth_of_field", "smile", "hair_ribbon", "thigh_gap", "smooth_thighs", "full_body"],
    animaCaption:"At 婚纱店试衣区 during afternoon, Ayachi Nene in light pink silk nightgown with lace trim shows sheer white thighhigh stockings with garter lace hugging smooth thighs, white slippers fully visible, story moment: 【成年 After Story · 婚纱裙摆的第一次旋转】成年后的春日下午，宁宁在婚纱店试穿选定的礼服。她站到镜前仍紧张 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc095:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_oversized_white_shirt_as_sleepwear, slender_bare_legs_with_smooth_thigh_lines_hugging_smooth_thighs_with_smooth_thighs_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, barefoot_with_detailed_toes_on_浴室_floor, 肩后回避视角中景_at_浴室_during_night, 【夏目_·_滑落前被接住的浴巾】夏夜浴室_action_with_shy_blush, warm_浴室柔光与蒸汽漫射_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["bathroom", "volumetric_lighting", "depth_of_field", "night", "mole_under_eye", "towel", "smooth_thighs", "full_body"],
    animaCaption:"At 浴室 during night, Shiki Natsume in oversized white shirt as sleepwear shows slender bare legs with smooth thigh lines hugging smooth thighs, barefoot with detailed toes fully visible, story moment: 【夏目 · 滑落前被接住的浴巾】夏夜浴室里，夏目刚迈出浴缸，松开的浴巾便从肩头滑落。你及时转身并把备用浴袍递过去，她在身 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc096:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_pale_blue_kimono_with_floral_pattern, white_tabi_socks_with_split_toe_hugging_smooth_thighs_with_smooth_thighs_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, bare_legs_peeking_on_同居公寓厨房_floor, 吧台双人半身中景_at_同居公寓厨房_during_night, 【成年_After_Story_·_凌晨_action_with_shy_blush, warm_冰箱光与厨房夜灯_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["kitchen", "volumetric_lighting", "depth_of_field", "night", "smile", "hair_ribbon", "smooth_thighs", "full_body"],
    animaCaption:"At 同居公寓厨房 during night, Ayachi Nene in pale blue kimono with floral pattern shows white tabi socks with split toe hugging smooth thighs, bare legs peeking fully visible, story moment: 【成年 After Story · 凌晨两点的冰淇淋同盟】成年同居后的夏夜，宁宁穿着你的宽大 T 恤在厨房偷吃冰淇淋，被 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc098:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_nene_school_uniform_with_navy_blazer_and_pleated_miniskirt, sheer_black_thighhigh_stockings_with_matte_silky_weave_hugging_smooth_thighs_hugging_smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, polished_brown_loafers_on_客厅_floor, 膝上主观面部特写_at_客厅_during_afternoon, 【宁宁_·_膝上倒映的眼睛】秋日下午，宁_action_with_shy_blush, warm_秋日下午柔和窗光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["looking_back", "volumetric_lighting", "depth_of_field", "hair_ribbon", "thigh_gap", "lying", "smooth_thighs", "shy", "full_body"],
    animaCaption:"At 客厅 during afternoon, Ayachi Nene in nene school uniform with navy blazer and pleated miniskirt shows sheer black thighhigh stockings with matte silky weave hugging smooth thighs hugging smooth thighs, polished brown loafers fully visible, story moment: 【宁宁 · 膝上倒映的眼睛】秋日下午，宁宁躺在你腿上看窗外摇动的树影，忽然转过脸认真端详你。她说从这个角度能看见平时忽略 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc099:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_natsume_official_qipao_with_side_slit_and_floral_print, sheer_black_thighhigh_stockings_with_lace_top_hugging_smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, black_heels_on_电梯_floor, 主观狭窄空间近景_at_电梯_during_night, 【夏目_·_电梯暂停后的冷静方案】秋夜电_action_with_shy_blush, warm_电梯应急顶光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["looking_back", "volumetric_lighting", "depth_of_field", "night", "mole_under_eye", "thigh_gap", "leaning", "smooth_thighs", "full_body"],
    animaCaption:"At 电梯 during night, Shiki Natsume in natsume official qipao with side slit and floral print shows sheer black thighhigh stockings with lace top hugging smooth thighs, black heels fully visible, story moment: 【夏目 · 电梯暂停后的冷静方案】秋夜电梯突然停层，夏目被晃得退到角落，你下意识撑住墙面保护她。应急灯亮起后，她先冷静按 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc102:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_natsume_maid_uniform_with_white_apron_and_frills, sheer_black_thighhigh_stockings_with_matte_finish_hugging_smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, mary_jane_shoes_on_安全屋审讯椅_floor, 近景特写_at_安全屋审讯椅_during_late_night, 【夏目_·_椅子软缚绝对沦陷】深夜的地下_action_with_shy_blush, warm_局部聚光强对比_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["bound", "tactical_gear", "volumetric_lighting", "sitting_on_chair", "depth_of_field", "thigh_gap", "unzipped", "smooth_thighs", "full_body"],
    animaCaption:"At 安全屋审讯椅 during late_night, Shiki Natsume in natsume maid uniform with white apron and frills shows sheer black thighhigh stockings with matte finish hugging smooth thighs, mary jane shoes fully visible, story moment: 【夏目 · 椅子软缚绝对沦陷】深夜的地下安全屋，冷光台灯打在面部。由于白天的自作主张，平时不可一世的高冷特工夏目，此时被 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc103:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_nene_blue_pajamas_with_cat_print, bare_legs_with_smooth_thigh_contours_hugging_smooth_thighs_with_smooth_thighs_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, barefoot_with_soft_toes_on_凌乱卧室床榻_floor, 近景特写_at_凌乱卧室床榻_during_late_night, 【成人_After_Story_·_宁宁_action_with_shy_blush, warm_柔和微弱床头灯_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["no_bra", "nightgown", "volumetric_lighting", "adult", "depth_of_field", "off_shoulder", "smooth_thighs", "full_body"],
    animaCaption:"At 凌乱卧室床榻 during late_night, Ayachi Nene in nene blue pajamas with cat print shows bare legs with smooth thigh contours hugging smooth thighs, barefoot with soft toes fully visible, story moment: 【成人 After Story · 宁宁】【成年 After Story · 宁宁 · 居家单肩滑落真空】深夜暴雨倾盆的 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc104:{
    prompt:"1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, wearing_casual_date_outfit_with_beige_blouse_and_plaid_miniskirt, sheer_white_thighhigh_stockings_with_silky_sheen_hugging_smooth_thighs_with_thigh_gap_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, ankle_boots_on_反锁指挥办公室_floor, 近景特写_at_反锁指挥办公室_during_late_night, 【夏目_·_职场湿身绝对透光】夏日深夜突_action_with_shy_blush, warm_单一台灯强烈侧光_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:shiki_natsume_v18_wd14:0.8>",
    tags:["see_through_clothing", "wet_shirt", "brassiere_visible", "volumetric_lighting", "wet_clothes", "depth_of_field", "thigh_gap", "smooth_thighs", "full_body"],
    animaCaption:"At 反锁指挥办公室 during late_night, Shiki Natsume in casual date outfit with beige blouse and plaid miniskirt shows sheer white thighhigh stockings with silky sheen hugging smooth thighs, ankle boots fully visible, story moment: 【夏目 · 职场湿身绝对透光】夏日深夜突降暴雨，刚跑回公司指挥中心的夏目全身被雨水彻底淋透。她面红耳赤地坐在你宽大的办公 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
  sc105:{
    prompt:"1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, wearing_white_sundress_with_puff_sleeves, slender_bare_legs_with_smooth_thigh_lines_hugging_smooth_thighs_with_smooth_thighs_and_knee_contours, entire_legs_and_feet_fully_visible_in_frame, barefoot_with_detailed_toes_on_反锁社办沙发_floor, 主观正面近景_at_反锁社办沙发_during_late_night, 【成人_After_Story_·_宁宁_action_with_shy_blush, warm_幽暗烛光氛围_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:ayachi_nene_v18_wd14:0.8>",
    tags:["shirt_lift", "volumetric_lighting", "adult", "depth_of_field", "undressing", "witch_costume", "smooth_thighs", "full_body"],
    animaCaption:"At 反锁社办沙发 during late_night, Ayachi Nene in white sundress with puff sleeves shows slender bare legs with smooth thigh lines hugging smooth thighs, barefoot with detailed toes fully visible, story moment: 【成人 After Story · 宁宁】【成年 After Story · 宁宁 · 密室魔女服极致高能】深夜反锁的超 with cinematic depth.",
    negative:"worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  },
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
      s.auditRevision='audit-v25-2026-08-26-batch5'
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
console.log(`APPLIED batch5 ${total}`)
