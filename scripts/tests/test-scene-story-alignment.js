#!/usr/bin/env node
'use strict';

/**
 * scripts/tests/test-scene-story-alignment.js — 场景「故事 vs 提示词」对齐门禁
 *
 * 原则（AGENTS.md 最高红线）：故事是唯一事实源，任何提示词修改必须贴合故事。
 * 本测试对 data/scenes.json 全库做 story↔prompt 关键要素对齐校验：
 *   姿势（躺/坐/站/跪/跨坐）、服装（裸/睡衣/浴巾/泳装/浴衣/婚纱/制服）、
 *   时段（夜/晨/夕阳）、天气（雨/雪）、道具（烟花/樱花/伞）
 *
 * 用法：
 *   node scripts/tests/test-scene-story-alignment.js [--report <path>] [--exempt <path>]
 *   --report：同时输出全量对齐明细（含 pass）到指定文件
 *   --exempt：豁免清单 JSON（[{"id":"sc004","label":"坐姿"}]，人工核对过的合理省略）
 *             默认读取 scripts/tests/fixtures/scene-story-exemptions.json
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const scenes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scenes.json'), 'utf8'));

// 关键要素表：故事中文正则（已排除误报：雪白=肤色、站台/车站=地点、起身≠站立等）
// promptRe 为英文 tag 匹配；允许"故事含糊时 prompt 省略"（如只写氛围词），仅报明确矛盾。
const CHECKS = [
  { label: '躺卧', storyRe: /躺(?!椅)\|(?<!主)卧(?!室|房)\|趴(?!下位)\|仰面\|侧躺\|趴着/, promptRe: /lying|lying_on|on_back|on_side|face_down|prone|sprawled|reclin|prostrate|laid_out|spread_eagled/ },
  { label: '坐姿', storyRe: /坐(?!下位|标|在这里|在能|在沙发|在床|在窗)/, promptRe: /sitting|kneeling|kneel|seated|perched|squat|sit_|astride|straddl|on_lap|riding/ },
  { label: '站立', storyRe: /(?<!公交|车|月|站台)站(?!台)/, promptRe: /standing|stand_|upright|on_her_feet|walking|strolling|pacing/ },
  { label: '跨坐', storyRe: /跨坐|骑(?!士)/, promptRe: /straddl|astride|riding|on_lap|cowgirl/ },
  { label: '裸体', storyRe: /全裸|裸体|一丝不挂|赤裸|不着一缕/, promptRe: /naked|nude|completely_naked|no_clothes|no_underwear|apron_only|bare_breasts|topless|bottomless/ },
  { label: '真空', storyRe: /真空|身上仅仅|只穿着?(?!校)/, promptRe: /no_bra|no_panties|no_underwear|nothing_beneath|wearing_only|apron_only|transparen|translucent|see-through|bare_|semi-transparent|sheer/ },
  { label: '睡裙睡衣', storyRe: /睡裙|睡衣(?!当作)|睡袍|夜衣/, promptRe: /nightgown|pajama|sleepwear|silk_robe|negligee|nightdress|loung|nightshirt|dudou|undergarment/ },
  { label: '浴巾', storyRe: /浴巾|毛巾/, promptRe: /towel/ },
  { label: '泳装', storyRe: /泳装|比基尼|泳衣/, promptRe: /bikini|swimsuit|swimwear/ },
  { label: '浴衣和服', storyRe: /浴衣|和服|振袖|巫女/, promptRe: /yukata|kimono|furisode|miko|shrine_maiden|wafuku/ },
  { label: '婚纱礼服', storyRe: /婚纱|晚礼服|礼裙|婚裙/, promptRe: /wedding_dress|bridal|evening_gown|gown|dress_unzipped|formal|chiffon|slip_dress/ },
  { label: '制服', storyRe: /校服|制服|女仆装|水手服/, promptRe: /uniform|maid|sailor|serafuku|blazer|waitress|witch_outfit|agent|tactical|jumpsuit/ },
  { label: '夜晚', storyRe: /(?:深夜|夜晚|夜里|夜色|月夜|月下|月光|星海|星空|夜景|天黑|入夜|夜蓝)/, promptRe: /night|moon|moonlight|star|lantern|dim|dark|evening|nocturnal|lamplight|city_lights/ },
  { label: '晨光', storyRe: /清晨|晨光|破晓|朝阳|拂晓|天亮/, promptRe: /morning|dawn|sunrise|golden_hour|first_light/ },
  { label: '夕阳', storyRe: /夕阳|黄昏|暮色|日落|晚霞|夕照/, promptRe: /sunset|dusk|twilight|afterglow|golden/ },
  { label: '雨', storyRe: /(?:秋雨|细雨|暴雨|大雨|阵雨|雨声|雨幕|淋雨|雨水|下雨|雷雨|冬雨)/, promptRe: /rain|rainy|downpour|storm|drizzle|wet_/ },
  { label: '雪景', storyRe: /初雪|大雪|落雪|飘雪|白雪|积雪|雪地|雪景|雪夜|雪天|雪幕|雪中|大雪纷飞/, promptRe: /snow|snowfall|snowy|snow_|blizzard|winter/ },
  { label: '烟花', storyRe: /烟花|花火/, promptRe: /firework|hanabi|sparkler/ },
  { label: '樱花', storyRe: /樱花|花瓣|落樱|樱吹雪/, promptRe: /cherry_blossom|sakura|petal|blossom/ },
  { label: '伞', storyRe: /伞/, promptRe: /umbrella|parasol/ },
];

const issues = [];
const detail = [];
// 豁免清单：人工核对的合理省略（台词/叙述指观者、POV 构图隐含姿态等）
let exempts = new Set();
const exemptArg = process.argv.indexOf('--exempt');
const exemptFile = exemptArg >= 0 && process.argv[exemptArg + 1]
  ? path.resolve(process.argv[exemptArg + 1])
  : path.join(__dirname, 'fixtures', 'scene-story-exemptions.json');
try {
  exempts = new Set(JSON.parse(fs.readFileSync(exemptFile, 'utf8')).map(x => x.id + '#' + x.label));
} catch (e) { /* 豁免文件缺失则全量校验 */ }

for (const s of scenes) {
  const story = s.story || '';
  const prompt = s.prompt || '';
  let sceneIssues = [];
  for (const c of CHECKS) {
    if (c.storyRe.test(story) && !c.promptRe.test(prompt) && !exempts.has(s.id + '#' + c.label)) {
      sceneIssues.push(c.label);
    }
  }
  if (sceneIssues.length) issues.push({ id: s.id, title: s.title, missing: sceneIssues });
  detail.push({ id: s.id, title: s.title, ok: sceneIssues.length === 0, missing: sceneIssues });
}

const reportArg = process.argv.indexOf('--report');
if (reportArg >= 0 && process.argv[reportArg + 1]) {
  const out = path.resolve(process.argv[reportArg + 1]);
  const lines = ['# 场景故事对齐全量明细', ''];
  for (const d of detail) {
    lines.push((d.ok ? '✅ ' : '❌ ') + d.id + ' ' + d.title + (d.ok ? '' : ' 缺失: ' + d.missing.join('/')));
  }
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log('[report] ' + out);
}

console.log('==============================================================');
console.log('[门禁] 场景故事 vs 提示词对齐（story 是唯一事实源）');
console.log('[门禁] 场景总数 ' + scenes.length + ' | 潜在不一致 ' + issues.length);
console.log('==============================================================');
issues.slice(0, 30).forEach(x => console.log(`[待核] ${x.id} ${x.title}：故事含「${x.missing.join('/')}」但 prompt 无对应词`));
if (issues.length) {
  console.error('\n[门禁失败] 存在故事↔提示词潜在不一致，请逐条核对（关键词匹配可能有误报，需人工确认）');
  process.exit(1);
}
console.log('\n✔ [通过] 全部场景故事与提示词对齐');
process.exit(0);
