#!/usr/bin/env node
'use strict';

/**
 * 桌面端更新发布（2026-08-29 产品运营审计 P1：Tauri updater 落地）。
 *
 * 流程：package:tauri（NSIS + updater 签名产物）→ 拷贝安装包与 .sig 到
 * runtime/desktop-updates/ → 生成 latest.json（tauri-plugin-updater 清单格式）。
 * 网关已把 /desktop-updates 伺服到该目录，应用端点固定指向本网关 3123。
 *
 * 前置：签名密钥 runtime/keys/aics-updater.key（`npx tauri signer generate` 生成，
 * 私钥不入库；丢失则无法再给已装客户端推送更新）。
 *
 * 用法：node scripts/maintenance/release-desktop-update.js [--skip-build] [--bump patch|minor|major]
 *   --bump  发布前先递增版本号（package.json 与 tauri.conf.json 同步），例如
 *           --bump patch 1.5.0 → 1.5.1。客户端 updater 只在远端版本 > 当前安装
 *           版本时提示，日常发版必须 bump，否则永远检不到更新。
 * 局域网其它机器升级：把 latest.json 里的 127.0.0.1 换成主机局域网 IP 即可。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// 盘符大写归一（2026-08-31 破案）：bash 会话下 __dirname 可能带小写盘符 e:\，
// 作为 execFileSync 的 cwd 会让 npm/vite 模块 ID 盘符分裂，build 秒失败且零输出。
// 与工作区记忆配方一致：大写 cwd 一切正常。
const ROOT = path.resolve(__dirname, '..', '..').replace(/^([a-z]):/i, (_, letter) => letter.toUpperCase() + ':');
const KEY_FILE = path.join(ROOT, 'runtime', 'keys', 'aics-updater.key');
const OUT_DIR = path.join(ROOT, 'runtime', 'desktop-updates');
const BUNDLE_DIR = path.join(ROOT, 'desktop-tauri', 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const SKIP_BUILD = process.argv.includes('--skip-build');
const BUMP_INDEX = process.argv.indexOf('--bump');
const BUMP_KIND = BUMP_INDEX >= 0 ? String(process.argv[BUMP_INDEX + 1] || 'patch') : '';

function fail(message) {
  console.error(`[release-desktop-update] ${message}`);
  process.exit(1);
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** 递增 package.json 与 tauri.conf.json 版本号（客户端当前版本编译自 tauri.conf.json，必须同步）。 */
function bumpVersion(kind) {
  if (!['patch', 'minor', 'major'].includes(kind)) fail(`未知 bump 档位: ${kind}（patch|minor|major）`);
  const pkgPath = path.join(ROOT, 'package.json');
  const tauriPath = path.join(ROOT, 'desktop-tauri', 'src-tauri', 'tauri.conf.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const conf = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
  const match = SEMVER.exec(String(pkg.version || ''));
  if (!match) fail(`无法解析 package.json version: ${pkg.version}`);
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  if (kind === 'major') { major += 1; minor = 0; patch = 0; }
  else if (kind === 'minor') { minor += 1; patch = 0; }
  else { patch += 1; }
  const next = `${major}.${minor}.${patch}`;
  if (String(conf.version || '') !== String(pkg.version || '')) {
    console.warn(`[release-desktop-update] 警告：tauri.conf.json version=${conf.version} 与 package.json ${pkg.version} 不一致，将两者都设为 ${next}`);
  }
  pkg.version = next;
  conf.version = next;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  fs.writeFileSync(tauriPath, JSON.stringify(conf, null, 2) + '\n', 'utf8');
  console.log(`[release-desktop-update] 版本 ${match[0]} → ${next}`);
  return next;
}

function main() {
  if (!fs.existsSync(KEY_FILE)) {
    fail(`缺少签名私钥 ${KEY_FILE}（npx tauri signer generate -w runtime/keys/aics-updater.key --password "" --ci）`);
  }
  if (BUMP_KIND) bumpVersion(BUMP_KIND);
  const version = require(path.join(ROOT, 'package.json')).version;

  if (!SKIP_BUILD) {
    console.log('[release-desktop-update] npm run package:tauri（含 updater 签名，可能需要数分钟）');
    execFileSync('npm', ['run', 'package:tauri'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
      env: Object.assign({}, process.env, {
        // 走 TAURI_SIGNING_PRIVATE_KEY_PATH：密钥文件含换行，环境变量传内容在
        // Windows spawn 层可能被截断/转义出错（实测 -k 传内容同样报 base64 错）。
        // 构建期签名只认内容变量；PATH 变量一并传，双保险。
        TAURI_SIGNING_PRIVATE_KEY: fs.readFileSync(KEY_FILE, 'utf8').trim(),
        TAURI_SIGNING_PRIVATE_KEY_PATH: KEY_FILE,
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '',
      }),
    });
  }

  // 找出本次产出的安装包与签名（NSIS：*-setup.exe + .sig）
  const artifacts = fs.readdirSync(BUNDLE_DIR)
    .filter((f) => /-setup\.exe$/i.test(f))
    .map((exe) => ({ exe, sig: `${exe}.sig` }))
    .filter((a) => fs.existsSync(path.join(BUNDLE_DIR, a.sig)));
  if (!artifacts.length) fail(`${BUNDLE_DIR} 下没有 updater 安装包（*-setup.exe + .sig）`);
  const artifact = artifacts[artifacts.length - 1];

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const exeName = artifact.exe;
  fs.copyFileSync(path.join(BUNDLE_DIR, artifact.exe), path.join(OUT_DIR, exeName));
  const signature = fs.readFileSync(path.join(BUNDLE_DIR, artifact.sig), 'utf8').trim();
  fs.writeFileSync(path.join(OUT_DIR, `${exeName}.sig`), signature + '\n');

  const manifest = {
    version,
    notes: `AI-CG-Studio ${version}`,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature,
        url: `http://127.0.0.1:3123/desktop-updates/${encodeURIComponent(exeName)}`,
      },
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`[release-desktop-update] ${version} 已发布到 runtime/desktop-updates/`);
  console.log('[release-desktop-update] 客户端重启或「检查更新」即拉取；局域网机器请把 latest.json 的 127.0.0.1 换成主机 IP');
}

main();
