'use strict';

const fs = require('fs');
const path = require('path');

const blueprintPath = path.resolve(__dirname, '../../data/scene-blueprints.json');
const bpData = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

// 18 位热门角色的专属高质感成人蓝图升级（中景侧卧/拥被靠坐/锁骨特写 + 衣物散落叙事 + 极佳光影）
const ADULT_UPGRADES = {
  // 1. 雷电将军 (一心净土/天守阁私寝)
  raiden_shogun_r18_chamber: {
    camera: "intimate medium shot, upper body focus",
    lighting: "warm candlelight and soft purple ambient rim glow",
    mood: "高贵羞赧与冷艳私密",
    sceneTags: ["tatami", "bedroom", "candlelight", "silk_cushion", "discarded_kimono", "purple_glow", "intimate", "night"],
    promptProse: "Inside the secluded private chamber of Tenshukaku bathed in warm amber candlelight and subtle violet lightning glow, Raiden Shogun reclines gracefully on luxurious silk tatami cushions with no other people present, her discarded purple kimono and golden hairpin resting on the floor beside her.",
    promptTokens: ["tatami_room", "candlelight", "silk_cushions", "japanese_bedroom", "warm_lighting", "purple_ambient_light", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "soft_skin", "blushing", "parted_lips", "lying_on_side", "medium_shot"],
    nsfwProse: "Completely nude with her intricate purple kimono discarded beside her on the tatami, Raiden Shogun reclines softly on silk cushions, her bare breasts, slender waist and delicate collarbone glowing under warm candlelight as she looks at the viewer with a rare blushing, vulnerable gaze.",
    adultArtistHint: "@kousaki (kousaki r)"
  },

  // 2. 樱岛麻衣 (酒店私密之夜)
  sakurajima_mai_r18_hotel: {
    camera: "intimate medium shot, side view",
    lighting: "warm bedside lamplight and soft window moonlight",
    mood: "羞怯温存与深情诱惑",
    sceneTags: ["hotel_room", "bed", "soft_sheets", "discarded_bunny_suit", "warm_lamp", "night", "intimate"],
    promptProse: "Inside a private hotel room at night, Sakurajima Mai relaxes softly against white silk pillows in bed with no other people present, her discarded bunny suit and white rabbit hair clip placed gently on the bedside nightstand under warm lamp light.",
    promptTokens: ["hotel_room", "white_bedsheets", "pillows", "warm_lighting", "bedside_lamp", "night", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "soft_skin", "blushing", "shy_smile", "parted_lips", "lying_in_bed", "medium_shot"],
    nsfwProse: "Completely nude with her black bunny suit discarded on the nightstand, Sakurajima Mai lies gracefully in bed hugging a soft white sheet, her bare breasts and delicate collarbone bathed in warm bedside lamplight as she turns with flushed cheeks and a tender, alluring smile.",
    adultArtistHint: "@anmi"
  },

  // 3. 时崎狂三 (钟楼月夜私密)
  tokisaki_kurumi_r18_clocktower: {
    camera: "intimate medium close-up, low angle",
    lighting: "silver moonlight and glowing amber clock face",
    mood: "危险魅惑与极致反差",
    sceneTags: ["clock_tower", "moonlight", "gears", "discarded_corset", "night", "intimate"],
    promptProse: "Inside the quiet moonlit clock tower inner sanctum, Tokisaki Kurumi leans back against soft velvet cushions before the giant turning golden clock face, intricate gears casting warm amber shadows across the stone floor with no other people present.",
    promptTokens: ["clock_tower", "giant_clock", "golden_gears", "moonlight", "velvet_cushions", "night", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "soft_skin", "blushing", "seductive_smirk", "parted_lips", "reclining", "medium_shot"],
    nsfwProse: "Completely nude with her crimson astral dress discarded beside her, Tokisaki Kurumi reclines gracefully against velvet cushions, her bare breasts and mismatched golden clock eye glowing in the moonlight as she offers a tantalizing, breathless smirk.",
    adultArtistHint: "@tsunako"
  },

  // 4. 芙莉莲 (旅店浴后私密)
  frieren_r18_inn_bath: {
    camera: "intimate medium shot, eye level",
    lighting: "warm fireplace glow and soft steam",
    mood: "纯真慵懒与朦胧水汽",
    sceneTags: ["inn_room", "wooden_tub", "steam", "towel", "fireplace", "intimate", "night"],
    promptProse: "Inside a rustic fantasy inn room after a soothing hot bath, Frieren sits comfortably on the edge of the wooden bed with gentle steam rising in the cozy room, her white mage robe draped over a wooden chair beside her with no other people present.",
    promptTokens: ["inn_room", "fireplace", "warm_glow", "steam", "wooden_bed", "cozy", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "wet_skin", "blushing", "drowsy_expression", "sitting_in_bed", "medium_shot"],
    nsfwProse: "Completely nude with only a soft white towel loosely resting on her lap, Frieren sits relaxed on the wooden bed with glistening moist skin, her small bare breasts and pointed elf ears illuminated by the warm fireplace glow as she looks up with sleepy, flushed violet eyes.",
    adultArtistHint: "@anmi"
  },

  // 5. Saber (王城卸甲私密)
  artoria_r18_royal_chamber: {
    camera: "intimate medium shot, side angle",
    lighting: "warm fireplace and silver moonlight through arched window",
    mood: "卸甲后的温柔与圣洁反差",
    sceneTags: ["royal_bedchamber", "canopy_bed", "discarded_armor", "fireplace", "moonlight", "intimate", "night"],
    promptProse: "Inside the private royal bedchamber of Camelot, Saber Artoria Pendragon rests on a luxurious canopy bed, her heavy silver armor and blue dress unbuckled and neatly placed on an armor stand beside her with no other people present.",
    promptTokens: ["royal_bedchamber", "canopy_bed", "fireplace", "arched_window", "moonlight", "silk_sheets", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "soft_skin", "blushing", "gentle_expression", "lying_in_bed", "medium_shot"],
    nsfwProse: "Completely nude with her silver armor and blue dress removed, Saber lies softly on silk sheets, her supple bare breasts and slender knightly body illuminated in warm firelight and cool moonlight as she looks at the viewer with blushing, earnest emerald eyes.",
    adultArtistHint: "@kousaki (kousaki r)"
  },

  // 6. 初音未来 (后台休息室私密)
  hatsune_miku_r18_backstage: {
    camera: "intimate medium close-up",
    lighting: "soft dressing room mirror bulb lights",
    mood: "演出后的甜蜜与娇羞",
    sceneTags: ["dressing_room", "mirror", "vanity", "discarded_costume", "warm_bulbs", "intimate"],
    promptProse: "Inside the quiet backstage dressing room after an exhilarating concert, Hatsune Miku relaxes on a plush sofa, her concert stage outfit and detached sleeves resting on the vanity table beside her with no other people present.",
    promptTokens: ["dressing_room", "vanity_mirror", "warm_light_bulbs", "plush_sofa", "backstage", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "glistening_skin", "blushing", "sweet_smile", "sitting_on_sofa", "medium_shot"],
    nsfwProse: "Completely nude with her stage costume draped over the sofa, Hatsune Miku sits comfortably with her flowing teal twin-tails framing her bare breasts and delicate waist, warm vanity mirror lights giving her flushed skin a radiant, dewy glow as she smiles sweetly.",
    adultArtistHint: "@rella"
  },

  // 7. 楪祈 (虚空歌姬私密画室)
  yuzuriha_inori_r18_atelier: {
    camera: "intimate upper body portrait",
    lighting: "ethereal cyan holographic light and warm amber backlight",
    mood: "空灵脆弱与极致唯美",
    sceneTags: ["glass_atelier", "hologram", "floating_particles", "discarded_dress", "night", "intimate"],
    promptProse: "Inside a private glass atelier overlooking the illuminated city, Yuzuriha Inori rests on a minimalist lounge chair surrounded by softly floating holographic light particles with no other people present.",
    promptTokens: ["glass_room", "city_night_view", "holographic_glow", "floating_particles", "modern_interior", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "translucent_skin", "blushing", "ethereal_expression", "reclining", "medium_shot"],
    nsfwProse: "Completely nude with her red combat dress discarded nearby, Yuzuriha Inori reclines gracefully in soft ambient light, her slender bare breasts, delicate collarbone and pink-orange hair illuminated by gentle holographic glow as her crimson eyes gaze with fragile tenderness.",
    adultArtistHint: "@anmi"
  },

  // 8. 雪之下雪乃 (和室私密之夜)
  yukinoshita_yukino_r18_room: {
    camera: "intimate medium shot, side view",
    lighting: "warm andon lantern glow on tatami",
    mood: "冰山融化的极致羞涩与柔情",
    sceneTags: ["tatami", "japanese_bedroom", "futon", "andon_lamp", "discarded_uniform", "intimate", "night"],
    promptProse: "Inside a quiet traditional Japanese tatami room at night, Yukinoshita Yukino sits softly on a clean white futon with no other people present, her school blazer and red ribbon placed neatly on a low wooden dresser beside the warm paper lantern.",
    promptTokens: ["japanese_bedroom", "tatami", "white_futon", "paper_lantern", "soft_warm_light", "intimate", "night", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "fair_skin", "deep_blush", "averting_gaze", "sitting_in_futon", "medium_shot"],
    nsfwProse: "Completely nude with her school uniform neatly folded beside the futon, Yukinoshita Yukino sits with her knees drawn up on white sheets, her fair bare breasts and slender collarbone glowing in warm lantern light as she looks down with deeply blushing cheeks and a rare, tender vulnerability.",
    adultArtistHint: "@tiv"
  },

  // 9. 伊蕾娜 (魔女旅舍私夜)
  elaina_r18_inn_room: {
    camera: "intimate medium shot, upper body focus",
    lighting: "warm magic lantern and window moonlight",
    mood: "俏皮自恋与娇羞反差",
    sceneTags: ["witch_inn", "magic_lantern", "canopy_bed", "discarded_witch_robe", "night", "intimate"],
    promptProse: "Inside a charming fantasy inn room on her travels, Elaina rests comfortably on a soft bed with no other people present, her black witch hat and traveler robe resting on a wooden chair under warm lantern light.",
    promptTokens: ["fantasy_inn", "magic_lantern", "canopy_bed", "wooden_room", "warm_lighting", "night", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "soft_skin", "blushing", "playful_smirk", "lying_in_bed", "medium_shot"],
    nsfwProse: "Completely nude with her witch hat placed on the nightstand, Elaina lies across soft pillows with her long ash hair framing her bare breasts and delicate shoulders, offering a playful yet deeply blushing smile in warm lantern light.",
    adultArtistHint: "@anmi"
  },

  // 10. 御坂美琴 (常盘台宿舍深夜)
  misaka_mikoto_r18_dorm: {
    camera: "intimate medium close-up",
    lighting: "soft desk lamp and faint blue electric sparks",
    mood: "傲娇心跳与纯情羞赧",
    sceneTags: ["dorm_room", "bed", "desk_lamp", "discarded_school_uniform", "night", "intimate"],
    promptProse: "Inside her Tokiwadai dormitory room late at night, Misaka Mikoto sits on her bed with no other people present, her school uniform and vest placed on the study chair under the warm glow of her desk lamp.",
    promptTokens: ["dorm_room", "student_bedroom", "desk_lamp", "warm_glow", "bed", "night", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "fair_skin", "heavy_blush", "pouting_expression", "sitting_in_bed", "medium_shot"],
    nsfwProse: "Completely nude with her uniform removed and Gekota plush nearby, Misaka Mikoto sits in bed holding a sheet to her waist, her toned bare breasts and delicate collarbone illuminated by soft lamplight as tiny blue sparks dance with her racing heartbeat and bright blushing face.",
    adultArtistHint: "@hiten (hitenkei)"
  },

  // 11. 玛奇玛 (私密办公夜宴)
  makima_r18_office: {
    camera: "intimate medium shot, low angle",
    lighting: "warm floor lamp and panoramic high-rise night skyline",
    mood: "支配者的从容与致命性感",
    sceneTags: ["luxury_office", "leather_couch", "city_night_view", "discarded_suit", "warm_lamp", "intimate"],
    promptProse: "Inside her private high-rise office overlooking the glowing Tokyo skyline at midnight, Makima relaxes gracefully on a plush black leather sofa with no other people present, her white buttoned shirt and black tie unfastened and placed over the armrest.",
    promptTokens: ["luxury_office", "leather_sofa", "city_lights", "night_skyline", "floor_lamp", "warm_lighting", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "pale_skin", "enigmatic_smile", "ringed_eyes", "reclining_on_sofa", "medium_shot"],
    nsfwProse: "Completely nude with her formal suit discarded on the sofa, Makima reclines back with her salmon braid resting across her full bare breasts, her golden concentric-ring eyes glowing in warm amber lamplight as she offers a calm, hypnotic and intoxicating smile.",
    adultArtistHint: "@kousaki (kousaki r)"
  },

  // 12. 远坂凛 (远坂宅邸私密红衣之夜)
  tohsaka_rin_r18_mansion: {
    camera: "intimate medium shot, three-quarter view",
    lighting: "warm glowing fireplace and candlelight",
    mood: "傲娇大小姐的心跳解除",
    sceneTags: ["mansion_bedroom", "canopy_bed", "fireplace", "discarded_red_sweater", "candlelight", "intimate", "night"],
    promptProse: "Inside the opulent master bedroom of the Tohsaka residence, Tohsaka Rin relaxes in bed with no other people present, her red turtleneck sweater and black pleated skirt folded over a nearby antique chair before the warm fireplace.",
    promptTokens: ["mansion_bedroom", "fireplace", "candlelight", "antique_furniture", "canopy_bed", "warm_glow", "intimate", "night", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "fair_skin", "deep_blush", "tsundere_expression", "lying_in_bed", "medium_shot"],
    nsfwProse: "Completely nude with her red sweater and black ribbons removed, Tohsaka Rin lies softly against burgundy pillows, her shapely bare breasts and slender waist bathed in flickering firelight as her aqua-blue eyes look up with a flustered, tsundere blush.",
    adultArtistHint: "@kousaki (kousaki r)"
  },

  // 13. 雷姆 (罗兹瓦尔宅邸私密侍奉)
  rem_rezero_r18_chamber: {
    camera: "intimate medium shot, front view",
    lighting: "warm candlelight and soft moonbeams",
    mood: "无限奉献与温柔心意",
    sceneTags: ["maid_bedroom", "bed", "candlelight", "discarded_maid_outfit", "intimate", "night"],
    promptProse: "Inside her cozy maid quarters in the Roswaal mansion, Rem sits gently on the white bed with no other people present, her classic black and white maid dress placed neatly on the wooden chair beside warm candles.",
    promptTokens: ["mansion_room", "white_bed", "candlelight", "warm_lighting", "soft_sheets", "intimate", "night", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "soft_skin", "loving_blush", "gentle_smile", "sitting_in_bed", "medium_shot"],
    nsfwProse: "Completely nude with her maid uniform removed, Rem sits in bed hugging a white pillow to her waist, her soft bare breasts and pink hair flower illuminated by warm candlelight as she looks at the viewer with an expression of pure, unconditional devotion and soft blushing cheeks.",
    adultArtistHint: "@anmi"
  },

  // 14. 爱蜜莉雅 (王选寝宫私密)
  emilia_rezero_r18_bedroom: {
    camera: "intimate medium shot, eye level",
    lighting: "soft magical crystal lantern and pale moonlight",
    mood: "圣洁无瑕与纯真羞赧",
    sceneTags: ["royal_bedroom", "crystal_lamp", "canopy_bed", "discarded_lilac_dress", "moonlight", "intimate", "night"],
    promptProse: "Inside her grand royal bedroom in the mansion, Emilia relaxes on a lavish white canopy bed with no other people present, her white and lilac dress resting over a silk settee under the gentle glow of a magical crystal lamp.",
    promptTokens: ["royal_bedroom", "canopy_bed", "crystal_lantern", "magical_glow", "silk_sheets", "moonlight", "intimate", "night", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "fair_skin", "innocent_blush", "parted_lips", "lying_in_bed", "medium_shot"],
    nsfwProse: "Completely nude with her lilac dress discarded, Emilia lies gracefully amidst white silk sheets, her beautiful bare breasts and silver hair glowing softly in pale crystal light as her purple-blue eyes shine with innocent wonder and blushing sweetness.",
    adultArtistHint: "@anmi"
  },

  // 15. 洛琪希 (魔导教师私密时间)
  roxy_migurdia_r18_teacher: {
    camera: "intimate medium shot, side view",
    lighting: "warm oil lamp and soft fireplace glow",
    mood: "小巧玲珑与成熟教师反差",
    sceneTags: ["magic_study", "bed", "oil_lamp", "discarded_robe", "grimoire", "intimate", "night"],
    promptProse: "Inside her cozy wooden study bedroom filled with ancient grimoires, Roxy Migurdia relaxes on her bed with no other people present, her pointed witch hat and teacher robe placed over the wooden study desk beside a glowing oil lamp.",
    promptTokens: ["wooden_bedroom", "magic_study", "oil_lamp", "warm_glow", "bookshelves", "bed", "intimate", "night", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "petite_frame", "blushing", "shy_smile", "lying_on_side", "medium_shot"],
    nsfwProse: "Completely nude with her blue robe discarded on the desk, Roxy reclines comfortably on her side in bed, her small delicate bare breasts and twin blue braids glowing in warm oil lamplight as she offers a shy, endearing smile.",
    adultArtistHint: "@anmi"
  },

  // 16. 伊莉雅 (爱因兹贝伦城堡冬夜)
  illyasviel_r18_castle: {
    camera: "intimate medium shot, high angle",
    lighting: "warm roaring fireplace and snowy window moonbeams",
    mood: "纯白无暇与梦幻温存",
    sceneTags: ["castle_bedroom", "fur_rug", "fireplace", "discarded_coat", "snowy_window", "intimate", "night"],
    promptProse: "Inside the grand stone bedroom of the Einzbern castle on a snowy winter night, Illyasviel rests by the roaring stone fireplace on a plush white fur rug with no other people present, her red coat and scarf set aside.",
    promptTokens: ["castle_room", "fireplace", "fur_rug", "snowy_night", "warm_firelight", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "snowy_skin", "cute_blush", "playful_smile", "sitting_on_rug", "medium_shot"],
    nsfwProse: "Completely nude with her warm winter coat discarded, Illyasviel sits comfortably on the soft white fur rug before the fireplace, her delicate snowy body and long white hair bathed in golden firelight as she smiles with playful innocence and rosy cheeks.",
    adultArtistHint: "@anmi"
  },

  // 17. 喜多川海梦 (试衣间私密试穿)
  kitagawa_marin_r18_fitting: {
    camera: "intimate medium close-up, front view",
    lighting: "bright warm dressing room mirror lights",
    mood: "火辣开朗与心跳娇羞",
    sceneTags: ["fitting_room", "curtain", "mirror", "discarded_cosplay", "warm_lighting", "intimate"],
    promptProse: "Inside a private boutique fitting room with velvet curtains drawn, Kitagawa Marin stands before the full-length mirror with no other people present, her unbuttoned school shirt and cosplay pieces resting on the stool beside her.",
    promptTokens: ["fitting_room", "dressing_mirror", "warm_lighting", "velvet_curtain", "intimate", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "glamorous_curves", "excited_blush", "winking_smile", "standing_in_room", "medium_shot"],
    nsfwProse: "Completely nude with her clothes piled on the dressing stool, Kitagawa Marin poses with one hand on her hip in front of the warm mirror lights, her curvaceous bare breasts, pink contact lenses, and dip-dyed blonde hair radiating irresistible confidence and blushing excitement.",
    adultArtistHint: "@tiv"
  },

  // 18. 木更 (公寓深夜契约时刻)
  kisara_r18_apartment: {
    camera: "intimate medium shot, front angle",
    lighting: "soft room lamp and blue moonlight through balcony",
    mood: "恶魔契约与炽热独占欲",
    sceneTags: ["apartment_bedroom", "bed", "balcony", "discarded_uniform", "warm_lamp", "intimate", "night"],
    promptProse: "Inside her cozy modern apartment bedroom late at night, Kisara rests on the soft bed with no other people present, her school uniform and black hair ribbon set neatly on the bedside table under soft ambient lighting.",
    promptTokens: ["apartment_room", "bed", "night_balcony", "warm_lamp", "intimate", "night", "volumetric_lighting", "depth_of_field", "clean_face", "delicate_collarbone"],
    nsfwTokens: ["nude", "completely_naked", "bare_shoulders", "bare_chest", "exposed_breasts", "nipples", "fair_skin", "intense_blush", "adoring_smile", "lying_in_bed", "medium_shot"],
    nsfwProse: "Completely nude with her uniform discarded on the bed, Kisara lies back against white pillows with her long pastel pink hair flowing across her bare breasts, her vivid crimson eyes glowing with loving obsession and a deeply flushed, adoring smile.",
    adultArtistHint: "@tsunako"
  }
};

let count = 0;
bpData.blueprints.forEach(bp => {
  const up = ADULT_UPGRADES[bp.id];
  if (up) {
    if (up.camera) bp.camera = up.camera;
    if (up.lighting) bp.lighting = up.lighting;
    if (up.mood) bp.mood = up.mood;
    if (up.sceneTags) bp.sceneTags = up.sceneTags;
    if (up.promptProse) bp.promptProse = up.promptProse;
    if (up.promptTokens) bp.promptTokens = up.promptTokens;
    if (up.nsfwTokens) bp.nsfwTokens = up.nsfwTokens;
    if (up.nsfwProse) bp.nsfwProse = up.nsfwProse;
    if (up.adultArtistHint) bp.adultArtistHint = up.adultArtistHint;
    count++;
  }
});

fs.writeFileSync(blueprintPath, JSON.stringify(bpData, null, 2) + '\n', 'utf8');
console.log(`Successfully upgraded all ${count} adult blueprints in ${blueprintPath}`);
