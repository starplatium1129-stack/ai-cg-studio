'use strict';

const fs = require('fs');
const path = require('path');

const blueprintPath = path.resolve(__dirname, '../../data/scene-blueprints.json');
const raw = fs.readFileSync(blueprintPath, 'utf8');
const data = JSON.parse(raw);

// 优化 75 个蓝图的 prose，确保：
// 1. 符合 Krea 2 自然语言散文流水线（3-5 句结构）：媒介风格 -> 角色外观 -> 姿态构图 -> 具象光影 -> 背景物件与排他 (no other people) -> 氛围；
// 2. 无 AI 玄学词 (beautiful, stunning, masterpiece, 8k 等)；
// 3. 成人场景 (adult) 裸体叙述 (nsfwProse) 裸词前置，服装写成已脱下 (discarded/fallen away)；
// 4. 保留 test-popular-content.js 所断言的关键句段。

const PROSE_OPTIMIZATIONS = {
  // --- 1. 雷电将军 ---
  raiden_shogun_tenshukaku: {
    promptProse: "Inside the Raiden Shogun's Tenshukaku throne hall in Inazuma, screens and tatami glow under dim candlelight while faint purple lightning crackles in the dark, the Electro Archon seated in serene authority with no other people present.",
  },
  raiden_shogun_thunder_night: {
    promptProse: "A thunderstorm rages over Inazuma at night, heavy rain lashing a solitary vermilion torii gate as purple lightning forks across the storm clouds, silhouetting the Shogun standing unflinching in the stormy downpour.",
  },
  raiden_shogun_narukami_shrine: {
    promptProse: "At Narukami Shrine in Inazuma, vermilion torii and drifting sakura petals frame the Shogun standing alone at dusk, stone lanterns glowing softly as gentle purple lightning crackles in the twilight air.",
  },
  raiden_shogun_r18_chamber: {
    promptProse: "In the private inner chamber of Tenshukaku, dim candlelight flickers across tatami and silk bedding as faint purple lightning glows outside the shoji screens, the Shogun reclining alone in the tranquil room.",
    nsfwProse: "Fully naked on the silk cushions with her purple kimono discarded on the floor, her bare breasts and nipples are exposed to the warm candlelight as she watches calmly with parted legs.",
  },

  // --- 2. 樱岛麻衣 ---
  sakurajima_mai_library: {
    promptProse: "Sakurajima Mai sits calmly in a quiet school library between tall wooden bookshelves with no other people present, warm daylight streaming through large windows onto her book as dust motes float peacefully.",
  },
  sakurajima_mai_rooftop: {
    promptProse: "On the school rooftop at golden hour, Sakurajima Mai stands alone leaning against the metal wire fence, orange and pink sunset light catching her long dark hair moving gently in the evening breeze.",
  },
  sakurajima_mai_city_night: {
    promptProse: "At night in the city center, Sakurajima Mai stands alone before a grand illuminated clock tower, glowing amber streetlights and distant bokeh lights wrapping the urban scene in a gentle evening ambiance.",
  },
  sakurajima_mai_r18_hotel: {
    promptProse: "In a private hotel room at night, Sakurajima Mai sits alone on the edge of the bed under the warm bedside lamp casting soft shadows across the sheets.",
    nsfwProse: "Completely naked except for sheer black thigh-highs with her bunny suit discarded on the carpet, her bare breasts and nipples are fully exposed in the warm lamplight as she rests with parted thighs.",
  },

  // --- 3. 时崎狂三 ---
  tokisaki_kurumi_moon_clocktower: {
    promptProse: "Tokisaki Kurumi stands alone atop a gothic moonlit clock tower against the dark night sky, the giant glowing face of Zafkiel turning behind her with intricate gears as pale moonlight catches her silhouette.",
  },
  tokisaki_kurumi_night_rooftop: {
    promptProse: "On a high rooftop overlooking the sprawling night city, Tokisaki Kurumi holds twin flintlock muskets at her sides with no one else around, cool moonlight gleaming on her clockwork eyes as city lights glitter far below.",
  },
  tokisaki_kurumi_frozen_ruins: {
    promptProse: "In a ruined cityscape frozen by stopped time, Tokisaki Kurumi walks alone through shattered streets where floating rubble hangs motionless in the cold air, crimson and golden clock dials glowing in the silence.",
  },
  tokisaki_kurumi_r18_clocktower: {
    promptProse: "Inside the moonlit clock tower chamber, Tokisaki Kurumi leans back against the giant golden clock face, clockwork gears and Roman numerals casting intricate amber shadows across the floor.",
    nsfwProse: "Fully naked against the glowing golden clock face with her gothic dress pooled on the floor, her bare breasts and parted thighs are illuminated by the cool moonlight and warm clockwork glow.",
  },

  // --- 4. 芙莉莲 ---
  frieren_magic_library: {
    promptProse: "Frieren studies an ancient grimoire at a wooden desk in a grand magical library with no other people present, stacks of arcane scrolls around her and faint blue spell-light drifting between empty rows of tall bookshelves.",
  },
  frieren_journey_field: {
    promptProse: "Frieren crosses a vast windswept grassy plain at dusk, white cape fluttering gently in the breeze as the long dirt road of her journey stretches toward the golden horizon under a soft sunset sky.",
  },
  frieren_graveyard: {
    promptProse: "Frieren stands in quiet contemplation before a weathered stone grave marker in a meadow of blooming white flowers, remembering departed companions under gentle, clear daylight.",
  },
  frieren_r18_inn_bath: {
    promptProse: "In a rustic fantasy inn room warmed by an amber stone fireplace, Frieren sits alone on the wooden bed in the quiet evening as steam slowly rises from the wooden tub nearby.",
    nsfwProse: "Completely naked by the warm hearth with her white robe removed and placed on the chair, her bare breasts and pointed elven ears catch the glowing firelight as she looks up calmly.",
  },

  // --- 5. 阿尔托莉雅 ---
  artoria_moonlit_city: {
    promptProse: "Saber stands vigilant on an empty city street at night, her blue dress and silver armor catching the cool silver glow of the full moon beneath a solitary streetlamp, dignified and alert.",
  },
  artoria_throne_room: {
    promptProse: "In the grand throne hall of Camelot with no others present, Saber sits upon the stone throne as shafts of morning sunlight pour through stained-glass windows onto ancient stone pillars.",
  },
  artoria_final_battle: {
    promptProse: "On a desolate battlefield at twilight, Saber raises Excalibur as radiant golden light gathers along the sacred blade, her blue cape whipping in the rising wind before the decisive charge.",
  },
  artoria_r18_royal_chamber: {
    promptProse: "In the private royal bedchamber of the castle, Saber stands alone beside the draped four-poster bed as flickering candlelight and cool moonlight mingle across the stone chamber.",
    nsfwProse: "Fully naked in the soft candlelight with her royal dress and armor set aside on the bench, her bare breasts and toned body stand exposed with composed, quiet dignity.",
  },

  // --- 6. 初音未来 ---
  hatsune_miku_concert: {
    promptProse: "Hatsune Miku performs at center stage of a massive concert arena, dynamic colorful spotlights and digital laser beams sweeping through the arena as thousands of teal glowsticks illuminate the dark.",
  },
  hatsune_miku_studio: {
    promptProse: "Hatsune Miku sings softly into a vintage studio condenser microphone inside an acoustically treated recording room, warm amber studio lamps framing her peaceful session with no one else inside.",
  },
  hatsune_miku_street_festival: {
    promptProse: "Hatsune Miku walks through a traditional Japanese summer festival street at night, rows of glowing red paper lanterns hanging overhead and festival stalls lining the stone walkway.",
  },
  hatsune_miku_r18_backstage: {
    promptProse: "Backstage in a private dressing room after the concert, Hatsune Miku sits alone at the illuminated vanity mirror, rows of warm lightbulbs reflecting softly across the room.",
    nsfwProse: "Completely naked except for sheer black thigh-highs with her concert outfit removed and placed on the rack, her bare breasts and nipples are clearly visible in the bright mirror lights.",
  },

  // --- 7. 楪祈 ---
  yuzuriha_inori_stage: {
    promptProse: "Inori stands alone on a weathered makeshift stage amidst urban ruins, her vibrant red singer dress catching a single overhead spotlight as she sings out into the night with ethereal grace.",
  },
  yuzuriha_inori_ruined_city: {
    promptProse: "Inori wanders through the deserted, overgrown streets of post-apocalyptic Tokyo, fractured concrete buildings and creeping greenery surrounding her under a quiet overcast sky.",
  },
  yuzuriha_inori_rooftop: {
    promptProse: "Inori sits alone at the edge of a high rooftop overlooking the ruined city skyline at dusk, the evening wind lifting her pink twintails as orange and purple sunset light fills the horizon.",
  },
  yuzuriha_inori_r18_atelier: {
    promptProse: "Inside a secluded private room at night, Yuzuriha Inori stands quietly by the window with cool blue city lights and a warm interior lamp casting gentle contrasting light across the space.",
    nsfwProse: "Completely naked in the quiet room with her dress slipped down and left on the floor, her bare breasts and nipples are exposed in the soft window glow as she gazes out calmly.",
  },

  // --- 8. 雪之下雪乃 ---
  yukinoshita_yukino_clubroom: {
    promptProse: "Yukinoshita Yukino sits alone reading a paperback book in the quiet Service Club classroom, a porcelain teacup steaming on the old wooden desk as afternoon sunlight slants through the tall windows.",
  },
  yukinoshita_yukino_winter_street: {
    promptProse: "Yukinoshita Yukino walks along a quiet snow-covered street at night, her knitted scarf wrapped around her neck as her breath forms soft white mist under the warm golden glow of a streetlamp.",
  },
  yukinoshita_yukino_library: {
    promptProse: "Yukinoshita Yukino stands by a tall library window in the afternoon with no other people around, quiet columns of warm sunlight illuminating floating dust motes and rows of hardback books.",
  },
  yukinoshita_yukino_r18_room: {
    promptProse: "Late at night in a quiet traditional Japanese room, Yukinoshita Yukino sits alone on the clean tatami mats under the warm, gentle amber light of a paper andon lamp.",
    nsfwProse: "Fully naked on the tatami mats with her yukata folded away beside her, her bare breasts and parted thighs are warmly lit as she averts her gaze with a delicate blush.",
  },

  // --- 9. 伊蕾娜 ---
  elaina_cloud_flying: {
    promptProse: "Elaina soars high across a vast sunlit sea of white clouds on her wooden broom, black witch hat and cape streaming in the wind as she travels toward distant fantasy mountains.",
  },
  elaina_night_magic: {
    promptProse: "At a solitary night campsite under a sparkling starry sky, Elaina sits by a crackling campfire reading an open spellbook, firelight and starlight reflecting off the ancient parchment.",
  },
  elaina_market_town: {
    promptProse: "Elaina walks through a cobblestone marketplace in a foreign fantasy town, timber-framed merchant stalls and colorful canvas awnings lining the lively sunny street.",
  },
  elaina_r18_inn_room: {
    promptProse: "In a cozy fantasy inn room at night, Elaina sits on the wooden bed with an open book resting on the nightstand beside a softly flickering candle.",
    nsfwProse: "Completely naked on the white bedsheets with her dark witch robe removed and hung on the post, her bare breasts and nipples are exposed in the candlelight as she offers a composed, knowing smile.",
  },

  // --- 10. 御坂美琴 ---
  misaka_mikoto_overpass: {
    promptProse: "Misaka Mikoto stands alone on a pedestrian overpass above the Academy City monorail tracks at sunset, the golden evening sky and towering wind turbines spinning against the horizon.",
  },
  misaka_mikoto_street: {
    promptProse: "Misaka Mikoto stands by a colorful beverage vending machine on an Academy City street corner, bright afternoon sunshine casting sharp clean shadows across the sidewalk.",
  },
  misaka_mikoto_electric_battle: {
    promptProse: "Misaka Mikoto flicks an arcade coin into the night air as brilliant blue-white electrical arcs and lightning crackle around her arm, illuminating the dark urban asphalt with bright sparks.",
  },
  misaka_mikoto_r18_dorm: {
    promptProse: "Late at night in her Tokiwadai dormitory room, Misaka Mikoto sits alone on the edge of the bed under the warm golden light of a small bedside reading lamp.",
    nsfwProse: "Fully naked on the bed with her school uniform and skirt placed on the desk chair, her bare breasts and nipples are revealed in the lamplight as she turns her blushing face away flustered.",
  },

  // --- 11. 玛奇玛 ---
  makima_cinema: {
    promptProse: "Inside a dimly lit private cinema with empty red velvet seats all around, Makima watches the glowing theater screen with an unreadable, calm gaze as cinematic light illuminates her profile.",
  },
  makima_office: {
    promptProse: "Inside her spacious Public Safety division office with no one else present, Makima sits behind a polished mahogany desk as pale daylight floods through floor-to-ceiling city-view windows.",
  },
  makima_dominion_night: {
    promptProse: "Makima stands alone in the rain on a dark Tokyo street at night holding a black umbrella, wet asphalt reflecting haloed amber streetlamps and towering neon city signs behind her.",
  },
  makima_r18_office: {
    promptProse: "Late at night in the high-rise executive office with city lights glowing through floor-to-ceiling glass windows, Makima sits alone on the edge of the polished wooden desk.",
    nsfwProse: "Fully naked on the edge of the mahogany desk with her white blouse and black skirt removed, her bare breasts and parted thighs are exposed as glittering night city lights outline her figure.",
  },

  // --- 12. 远坂凛 ---
  tohsaka_rin_mansion: {
    promptProse: "Tohsaka Rin works late in her family's underground magecraft workshop, glowing red and blue magical gems arranged in an intricate circle across the stone floor as candles cast focused light.",
  },
  tohsaka_rin_rooftop: {
    promptProse: "Tohsaka Rin stands with arms crossed on the school rooftop during a bright clear afternoon, her red ribbons and dark twintails fluttering in the breeze as she surveys the Fuyuki landscape.",
  },
  tohsaka_rin_chase: {
    promptProse: "Tohsaka Rin dashes across the tiled rooftops of Fuyuki at twilight, red coat flaring with energetic agility as the orange sunset sky transitions into cool evening indigo.",
  },
  tohsaka_rin_r18_mansion: {
    promptProse: "In the private bedroom of the Tohsaka estate at night, Rin sits alone on the antique European bed under the warm amber glow of a crystal chandelier casting soft shadows.",
    nsfwProse: "Fully naked on the bed except for black thigh-highs with her red outfit discarded on the chair, her bare breasts and nipples are illuminated in the warm light as she looks away with a flustered blush.",
  },

  // --- 13. 雷姆 ---
  rem_rezero_mansion: {
    promptProse: "Rem performs her morning housekeeping duties along the grand sunlit corridors of the Roswaal mansion, polished checkered floors and ornate arched windows reflecting bright morning light.",
  },
  rem_rezero_moon_garden: {
    promptProse: "Rem tends the secluded mansion rose garden under clear silver moonlight, dew drops glistening on night-blooming flowers and manicured hedge paths in the tranquil night.",
  },
  rem_rezero_rain_night: {
    promptProse: "Rem stands alone by a tall rain-streaked window inside the Roswaal mansion at night, a single warm brass oil lamp illuminating her blue hair and devoted expression as rain beats against the glass.",
  },
  rem_rezero_r18_chamber: {
    promptProse: "In a quiet guest chamber of the Roswaal estate at night, Rem kneels peacefully on the soft bedside rug beside warm flickering candlelight.",
    nsfwProse: "Fully naked on the soft rug with her maid uniform unfastened and placed aside, her bare breasts and nipples are exposed in the gentle candlelight as she looks up with tender, devoted affection.",
  },

  // --- 14. 爱蜜莉雅 ---
  emilia_rezero_snow_forest: {
    promptProse: "Emilia walks through the frozen Elior Forest, glistening crystalline snow and sparkling ice formations surrounding her silver hair and white robes under clear winter daylight.",
  },
  emilia_rezero_court: {
    promptProse: "Emilia stands composed in the grand royal court of Lugunica for the Royal Selection, ornate stone pillars and towering stained-glass windows bathing the solemn hall in dignified light.",
  },
  emilia_rezero_garden: {
    promptProse: "Emilia relaxes in the sun-dappled mansion garden with her spirit companion Puck, vibrant blooming flowerbeds and gentle green foliage swaying around them in the pleasant afternoon breeze.",
  },
  emilia_rezero_r18_bedroom: {
    promptProse: "Inside the royal guest bedchamber at night, Emilia sits alone on the grand four-poster bed as pale silver moonlight and warm candlelight illuminate the ornate room.",
    nsfwProse: "Fully naked on the soft white bedsheets with her white dress slipped off and resting on the footboard, her bare breasts and nipples are revealed in the gentle light as she shyly holds a pillow close.",
  },

  // --- 15. 洛琪希 ---
  roxy_migurdia_academy: {
    promptProse: "Roxy searches the towering Ranoa Magic Academy library for rare ancient scrolls, wooden book ladders and stacks of leather-bound grimoires surrounding her in the quiet sunlit hall.",
  },
  roxy_migurdia_wilderness: {
    promptProse: "Roxy traverses a vast open grassland at sunset holding her wooden magic staff, her travel cape rustling in the evening wind as golden sunlight bathes the winding dirt trail.",
  },
  roxy_migurdia_village: {
    promptProse: "Roxy stands in the center of her peaceful Migurd tribal village, simple dome-shaped earthen homes and wide grassland stretching out under a clear blue sky.",
  },
  roxy_migurdia_r18_teacher: {
    promptProse: "Inside her private teacher's quarters at the magic academy at night, Roxy sits alone at her wooden study desk under the warm glow of a desk lamp.",
    nsfwProse: "Fully naked on the wooden chair with her wizard robe and hat resting on the coat stand, her bare breasts and nipples are illuminated in the warm lamplight as she glances up with a flustered expression.",
  },

  // --- 16. 伊莉雅 ---
  illyasviel_einzbern_castle: {
    promptProse: "Illyasviel stands beside a tall arched stone window inside the snowy Einzbern castle at night, frosty glass reflecting flickering fireplace embers as snowflakes drift down in the dark forest outside.",
  },
  illyasviel_moon_garden: {
    promptProse: "Illyasviel walks through the snow-dusted courtyards and rose garden of the Einzbern estate under a bright silver moon, stone statues and cold shadows framing the serene winter grounds.",
  },
  illyasviel_grail_war: {
    promptProse: "Illyasviel stands at the center of an empty Fuyuki crossroads at midnight, her small figure illuminated by streetlights as the towering, dark silhouette of Berserker looms faithfully behind her.",
  },
  illyasviel_r18_castle: {
    promptProse: "On a quiet winter night inside the castle bedchamber, Illyasviel sits alone on a plush velvet rug before a crackling stone fireplace, golden embers warming the room.",
    nsfwProse: "Fully naked on the velvet rug with her purple winter dress placed neatly aside, her bare breasts and petite form catch the dancing firelight as she smiles softly into the warmth.",
  },

  // --- 17. 喜多川海梦 ---
  kitagawa_marin_sewing_room: {
    promptProse: "Kitagawa Marin sits at her home craft table working with a sewing machine, colorful bolts of cosplay fabric, lace ribbons, and scissors neatly laid out under bright daylight.",
  },
  kitagawa_marin_convention: {
    promptProse: "Kitagawa Marin poses enthusiastically at a lively anime convention photo booth in full cosplay, dynamic stage lights illuminating the decorated backdrop.",
  },
  kitagawa_marin_amusement_park: {
    promptProse: "Kitagawa Marin flashes a cheerful peace sign in front of a giant colorful ferris wheel at a sunlit amusement park, blue skies and carnival balloons brightening the festive summer day.",
  },
  kitagawa_marin_r18_fitting: {
    promptProse: "Inside a private convention fitting room with closed curtains, Kitagawa Marin stands alone before a tall dressing mirror under bright, clean vanity lights.",
    nsfwProse: "Fully naked before the full-length mirror with her cosplay outfit removed and placed on the clothing rack, her bare breasts and nipples are reflected in the clear glass as she strikes a confident, playful pose.",
  },

  // --- 18. 木更 ---
  kisara_battle_night: {
    promptProse: "Kisara hovers high above the glowing neon streets of Baylong City at night in her combat stance, vibrant crimson energy ribbons and white battle attire blazing against the skyscraper skyline.",
  },
  kisara_home_daily: {
    promptProse: "Kisara lounges comfortably on a soft sofa inside a cozy living room at home, warm afternoon sun pouring through the balcony glass door with no one else inside.",
  },
  kisara_school: {
    promptProse: "Kisara turns back with a lively teasing smile in a bright school hallway during break time, sunlight reflecting off the polished wooden floorboards and glass windows.",
  },
  kisara_r18_apartment: {
    promptProse: "Late at night in the private apartment bedroom, Kisara sits alone on the bed beside a warm bedside lamp casting soft golden shadows across the wall.",
    nsfwProse: "Fully naked on the bed with her oversized white shirt unbuttoned and discarded on the floor, her bare breasts and parted thighs are exposed in the warm lamplight as she looks back with a teasing gaze.",
  },
};

let modifiedCount = 0;
data.blueprints.forEach(bp => {
  const opt = PROSE_OPTIMIZATIONS[bp.id];
  if (opt) {
    if (opt.promptProse) {
      bp.promptProse = opt.promptProse;
    }
    if (opt.nsfwProse) {
      bp.nsfwProse = opt.nsfwProse;
    }
    modifiedCount++;
  }
});

fs.writeFileSync(blueprintPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Successfully optimized ${modifiedCount} / ${data.blueprints.length} blueprints in ${blueprintPath}`);
