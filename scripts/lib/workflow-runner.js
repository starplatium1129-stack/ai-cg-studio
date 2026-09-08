'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function audit(registry, root) {
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  const errors = [];
  for (const [name, def] of Object.entries(registry)) {
    if (!def.cmd && !def.steps && !def.builtin) errors.push(`${name}: 缺少入口`);
    if (def.cmd?.includes('--help')) errors.push(`${name}: 固定 --help 阻止执行`);
    if (def.cmd?.[0] === 'npm' && !scripts[def.cmd[1] === 'run' ? def.cmd[2] : def.cmd[1]]) errors.push(`${name}: npm 入口不存在`);
    for (const arg of def.cmd || []) {
      if (/^(scripts\/|deploy-desktop\.bat)/.test(arg) && !fs.existsSync(path.join(root, arg))) errors.push(`${name}: 文件不存在 ${arg}`);
    }
    if (def.docs && !fs.existsSync(path.join(root, def.docs.split('#')[0].replace(/:\d+$/, '')))) errors.push(`${name}: 文档不存在 ${def.docs}`);
    try { expand(name, [], registry); } catch (error) { errors.push(error.message); }
  }
  return { count: Object.keys(registry).length, errors, ok: errors.length === 0 };
}

function expand(name, args, registry, parents = []) {
  const def = registry[name];
  if (!def) throw new Error(`未知工作流: ${name}`);
  if (parents.includes(name)) throw new Error(`复合步骤循环: ${[...parents, name].join(' → ')}`);
  if (!def.steps) return [{ name, args, def }];
  if (args.length) throw new Error(`${name} 不共享参数；请分别执行子步骤，或 showcase:full 使用 --output 与 --target。`);
  return def.steps.flatMap(step => expand(step, [], registry, [...parents, name]));
}

function option(args, key) {
  const i = args.indexOf(key);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
}

function plan(name, args, registry) {
  if (name !== 'showcase:full') return expand(name, args, registry);
  const allowed = ['--output', '--target', '--source', '--showcase', '--gateway', '--keys', '--concurrency', '--limit'];
  for (let i = 0; i < args.length; i += 2) {
    if (!allowed.includes(args[i]) || !option(args, args[i])) throw new Error(`showcase:full 参数无效: ${args[i]}`);
  }
  const output = option(args, '--output');
  const target = option(args, '--target');
  const source = option(args, '--source');
  if (!output || !target || !source) throw new Error('showcase:full 需要 --output <候选目录> --source <现有版本> --target <新版本>；默认仅预览发布。');
  const manifest = path.join(output, 'generation-manifest.json');
  return [
    { name: 'showcase:generate', args: ['--output', output, ...['--gateway', '--keys', '--concurrency', '--limit'].flatMap(k => option(args, k) ? [k, option(args, k)] : [])] },
    { name: 'showcase:audit', args: ['--manifest', manifest, '--out', path.join(output, 'audit-results.json')] },
    { name: 'showcase:publish', args: ['--from', manifest, '--source', source, '--target', target, ...(option(args, '--showcase') ? ['--showcase', option(args, '--showcase')] : [])] },
  ].map(step => ({ ...step, def: registry[step.name] }));
}

function invocation(def, args) {
  const [cmd, ...defaults] = def.cmd;
  if (cmd === 'node') return [process.execPath, [...defaults, ...args]];
  if (cmd === 'npm') {
    // Invoke npm's JS entry so spaces and shell metacharacters remain literal arguments.
    const cli = process.env.npm_execpath || [
      path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
      path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
    ].find(file => fs.existsSync(file));
    if (!cli) throw new Error('无法定位 npm；请使用 npm run wf -- <命令>。');
    return [process.execPath, [cli, ...defaults, ...(args.length && !defaults.includes('--') ? ['--'] : []), ...args]];
  }
  return [cmd, [...defaults, ...args]];
}

function main(argv, registry, root, run = spawnSync) {
  try {
    const [name, ...raw] = argv;
    if (name === 'audit:workflows' && !raw.includes('--help')) {
      const result = audit(registry, root);
      console.log(raw.includes('--json') ? JSON.stringify(result, null, 2) : `${result.ok ? 'PASS' : 'FAIL'} · ${result.count} 个入口\n${result.errors.join('\n')}`);
      return result.ok ? 0 : 1;
    }
    const help = !name || argv.includes('--help') || argv.includes('-h');
    const search = name === 'search';
    if (help || search || (name && !registry[name] && Object.keys(registry).some(k => k.startsWith(name + ':')))) {
      const query = search ? raw.join(' ').toLowerCase() : '';
      const entries = Object.entries(registry).filter(([k, v]) => search ? `${k} ${v.desc}`.toLowerCase().includes(query) : !name || name.startsWith('-') || k === name || k.startsWith(name + ':'));
      if (!entries.length) throw new Error(`没有匹配工作流: ${name} ${query}`);
      console.log('用法: npm run wf -- <命令> [参数]；search <关键词>；--plan 只预览；audit:workflows --json 只读审计');
      for (const [k, v] of entries.sort(([a], [b]) => a.localeCompare(b))) {
        console.log(`${k.padEnd(25)} ${v.desc}`);
        if (k === name) console.log(JSON.stringify({ command: v.cmd, steps: v.steps, required: v.required, options: v.opts, docs: v.docs, needs: v.needs }, null, 2));
      }
      return 0; // Never execute a child for discovery/help.
    }
    const preview = raw.includes('--plan');
    const steps = plan(name, raw.filter(a => a !== '--plan'), registry);
    for (const { name: step, args, def } of steps) {
      for (const key of def.required || []) if (!option(args, key)) throw new Error(`${step} 需要 ${key} <值>；使用 --help 查看入口。`);
    }
    for (const { name: step, args, def } of steps) {
      const [cmd, cmdArgs] = invocation(def, args);
      console.error(`${preview ? '[预览]' : '[执行]'} ${step}: ${JSON.stringify([cmd, ...cmdArgs])}`);
      if (preview) continue;
      const batch = cmd.endsWith('.bat');
      if (batch && process.platform !== 'win32') throw new Error('桌面部署仅支持 Windows。');
      // The batch entry accepts only switches; never interpolate arbitrary paths into cmd.exe.
      if (batch && cmdArgs.some(a => !/^-[A-Za-z]+$/.test(a))) throw new Error('桌面入口仅接受开关参数。');
      const result = run(cmd, cmdArgs, { cwd: root, stdio: 'inherit', shell: batch, windowsHide: true, env: { ...process.env, AICS_WORKFLOW_NONINTERACTIVE: '1' } });
      if (result.error || result.status !== 0) {
        console.error(`${step} 失败: ${result.error?.message || result.signal || result.status}`);
        return result.status || 1;
      }
    }
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

module.exports = { main, plan, audit, invocation };
