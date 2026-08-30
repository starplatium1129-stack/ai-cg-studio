'use strict';

/**
 * UX 审计修复的回归门禁（2026-08-30）
 *
 * 存在的理由：docs/ux-audit-2026-08-30.html 里 9 条 P0 有 6 条属于「写完没接上 /
 * 接反了」的单点缺陷——改一行就修好，也改一行就能退回。这类缺陷不会让任何类型
 * 检查或单测失败，只会在用户手里安静地复发。本文件把这些修复固化成断言，
 * 防的是「以后重构时顺手改回去」。
 *
 * 判定方式是源码级模式匹配（与审计取证同口径），不加载运行时。断言失败信息
 * 都写清了「为什么这条不能改」，便于正当重构时按意图更新断言，而不是照着
 * 报错瞎改代码。
 *
 * 用法: node scripts/tests/test-ux-regressions.js
 */

const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '../..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

/** 去掉注释后再匹配，避免把解释性文字里的示例代码算进去。 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * 取出某个具名函数的函数体（大括号配对）。
 *
 * 这类断言必须落在具体函数里才算数：比如 `styleLoraId: ''` 在 applyModel 里
 * 是正确行为（用户真的换了底模，风格 LoRA 本来就该重置），全文件级匹配会把
 * 正常的写法也判成回潮。
 */
function extractFunction(source, name) {
  const start = source.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  if (start < 0) return '';
  const open = source.indexOf('{', start);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return '';
}

const CHECKS = [
  {
    id: 'P0-1 确认框不得劫持 Enter',
    file: 'src/components/ConfirmDialog.vue',
    why: 'Enter 被 document 级 keydown 抢先 preventDefault 后调 ok()，会让「默认聚焦取消」'
      + '这道防线失效——焦点在取消上按 Enter 仍然执行删除。必须留给浏览器原生按钮语义。',
    assert(source) {
      const code = stripComments(source);
      return !/e\.key\s*===\s*'Enter'[\s\S]{0,120}ok\(\s*\)/.test(code);
    },
  },
  {
    id: 'P0-2 Anima 轮询不得无条件覆写用户参数',
    file: 'src/composables/generation/useAnimaSession.ts',
    why: '每 15 秒无条件套用底模 defaults 会把用户手调的 CFG/Steps 静默改回默认值，'
      + '并清空已选风格 LoRA。defaults 只在底模真的变了时才该套用。',
    assert(source) {
      // 只看心跳函数：applyModel 里的重置是正确行为（用户真的换了底模）
      const body = stripComments(extractFunction(source, 'refreshBackend'));
      if (!body) return false;
      // 不得再无条件清空风格 LoRA，也不得无条件写 steps/cfg 等默认值
      return !/styleLoraId:\s*''/.test(body) && /shouldApplyDefaults/.test(body);
    },
  },
  {
    id: 'P0-3 词条输入必须按逗号/换行切分',
    file: 'src/composables/prompt/usePromptTagTools.ts',
    why: '从 Danbooru 复制「blue_hair, smile, twintails」回车只得到一条垃圾词条，'
      + '而批量粘贴正是「提示词自主权」最高频的动作。',
    assert(source) {
      const code = stripComments(source);
      return /split\(\s*\/\[?[^\/]*[,，][^\/]*\]?\/\s*\)/.test(code);
    },
  },
  {
    id: 'P0-4 清空词条必须经过确认',
    file: 'src/components/director/DirectorTagWorkbench.vue',
    why: '角色厨手工攒的 40+ 词条是本项目最高成本的手工资产，一次误点不能全灭。',
    assert(source) {
      const body = stripComments(extractFunction(source, 'clearTags'));
      if (!body) return false;
      // 清空动作必须排在确认之后：先看得到确认，再看到赋值
      const confirmAt = body.search(/await\s+confirmAction/);
      const assignAt = body.search(/manualTags\s*=\s*new Set\(\s*\)/);
      return confirmAt >= 0 && assignAt > confirmAt;
    },
  },
  {
    id: 'P0-5 出图队列必须持久化',
    file: 'src/utils/storageKeys.ts',
    why: '队列只活在视图作用域时，切页或刷新就整组蒸发且没有任何解释。',
    assert(source) {
      return /SD_QUEUE_SNAPSHOT_KEY/.test(source);
    },
  },
  {
    id: 'P0-6 高清修复不得默认开启',
    file: 'data/presets.json',
    why: '默认开 hires_fix 又不在默认模式暴露开关，等于每次出图都悄悄多跑一个二阶段，'
      + '用户看不到开关、也无从知道为什么慢。',
    assert(source) {
      const parsed = JSON.parse(source);
      // 注意取值在 model_profiles 而非 presets：promptModelProfile.ts 的
      // set('hiresFix', profile.hires_fix) 读的是底模档，且 promptPolicy 对
      // 任何未匹配的 checkpoint 都会回落到 list[0]——这一档就是事实默认值。
      const profiles = Array.isArray(parsed.model_profiles)
        ? parsed.model_profiles
        : Object.values(parsed.model_profiles || {});
      if (!profiles.length) return false;
      // 任何底模档都不该默认开启二阶段：它把分钟级任务再拉长一截，而默认模式
      // 里连开关都看不见（开关外层 v-if 要求 expert 模式）。
      return !profiles.some(profile => profile && profile.hires_fix === true);
    },
  },
  {
    id: 'P0-7 作品册必须在 KeepAlive 激活时刷新',
    file: 'src/views/GalleryView.vue',
    why: '保存成功却在作品册里看不到刚存的图，用户会判定「保存失败」并重复保存或重画。',
    assert(source) {
      const code = stripComments(source);
      return /onActivated\s*\(/.test(code);
    },
  },
  {
    id: 'P0-8 作品删除必须走软删',
    file: 'src/views/GalleryView.vue',
    why: '硬删会同时清掉 IndexedDB 原图与缩略图，误删不可恢复。回收站保留 30 天。',
    assert(source) {
      const code = stripComments(source);
      return /softDeleteArtwork/.test(code) && !/artworkRepository\.deleteArtwork/.test(code);
    },
  },
  {
    id: 'P0-9 出图进度必须可空（不得兜成 0）',
    file: 'src/composables/generation/useSDGenerate.ts',
    why: '后端给不出进度时兜成 0 会被读成「卡在 0%」。可空才能让 UI 走 indeterminate，'
      + '同时守住「不做匀速假增量」这条诚实纪律。',
    assert(source) {
      const code = stripComments(source);
      return /ref<number\s*\|\s*null>\(null\)/.test(code);
    },
  },
  {
    id: 'P1 全局搜索作品过滤不得写反',
    file: 'src/components/GlobalSearch.vue',
    why: '`!r` 会把每个非空条目判为非对象而丢掉，「作品」分组永远为空——'
      + '用户搜不到旧作会误判「那张图没了」。',
    assert(source) {
      const code = stripComments(source);
      return !/=>\s*!r\s*&&/.test(code);
    },
  },
  {
    id: 'P1 桌宠容器高度下限不得超出视口',
    file: 'src/assets/css/companion.css',
    why: '死值 min-height 在宽扁窗（如 700x500）里超过视口高度，而两层 overflow:hidden '
      + '会把底部对话条永久裁掉，既不能输入也关不掉窗。',
    assert(source) {
      return /min-height:\s*min\(\s*560px\s*,\s*100dvh\s*\)/.test(source);
    },
  },
];

test('UX 审计修复不回潮', () => {
  const failures = [];
  const missing = [];

  for (const check of CHECKS) {
    let source;
    try {
      source = read(check.file);
    } catch (e) {
      missing.push(`${check.id} — 找不到文件 ${check.file}`);
      continue;
    }
    let ok = false;
    try {
      ok = check.assert(source);
    } catch (e) {
      ok = false;
    }
    if (!ok) failures.push(`${check.id}\n      文件 ${check.file}\n      原因 ${check.why}`);
  }

  console.log(`  UX 回归断言 ${CHECKS.length} 条，失败 ${failures.length} 条，缺文件 ${missing.length} 条`);
  for (const line of missing) console.log('    MISSING ' + line);
  for (const line of failures) console.log('    FAIL ' + line);

  assert.deepEqual(missing, [], '断言引用的文件不存在（路径可能已重构）');
  assert.deepEqual(failures, [], 'UX 审计的修复被改回去了');
});
