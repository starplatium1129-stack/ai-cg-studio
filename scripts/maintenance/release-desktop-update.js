#!/usr/bin/env node
'use strict';

/**
 * 桌面端更新发布（2026-08-29 产品运营审计 P1：Tauri updater 落地）。
 *
 * 流程：package:tauri（NSIS + updater 签名产物）→ 拷贝安装包与 .sig 到
 * runtime/desktop-updates/ → 生成 latest.json（tauri-plugin-updater 清单格式）
 * 与 SHA-256，再按需发布到主项目 GitHub Releases。
 *
 * 前置：签名密钥 runtime/keys/aics-updater.key（`npx tauri signer generate` 生成，
 * 私钥不入库；丢失则无法再给已装客户端推送更新）。
 *
 * 用法：node scripts/maintenance/release-desktop-update.js [--skip-build] [--bump patch|minor|major] [--publish]
 *   --bump  发布前先递增版本号（package.json 与 tauri.conf.json 同步），例如
 *           --bump patch 1.5.0 → 1.5.1。客户端 updater 只在远端版本 > 当前安装
 *           版本时提示，日常发版必须 bump，否则永远检不到更新。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

// 盘符大写归一（2026-08-31 破案）：bash 会话下 __dirname 可能带小写盘符 e:\，
// 作为 execFileSync 的 cwd 会让 npm/vite 模块 ID 盘符分裂，build 秒失败且零输出。
// 与工作区记忆配方一致：大写 cwd 一切正常。
const ROOT = path.resolve(__dirname, '..', '..').replace(/^([a-z]):/i, (_, letter) => letter.toUpperCase() + ':');
const KEY_FILE = path.join(ROOT, 'runtime', 'keys', 'aics-updater.key');
const OUT_DIR = path.join(ROOT, 'runtime', 'desktop-updates');
const BUNDLE_DIR = path.join(ROOT, 'desktop-tauri', 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const SKIP_BUILD = process.argv.includes('--skip-build');
const BUNDLE_ONLY = process.argv.includes('--bundle-only');
const BUMP_INDEX = process.argv.indexOf('--bump');
const BUMP_KIND = BUMP_INDEX >= 0 ? String(process.argv[BUMP_INDEX + 1] || 'patch') : '';
const PUBLISH = process.argv.includes('--publish');
const RELEASE_REPOSITORY = 'starplatium1129-stack/ai-cg-studio';

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
  const lockPath = path.join(ROOT, 'package-lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = next;
  if (lock.packages?.['']) lock.packages[''].version = next;
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
  console.log(`[release-desktop-update] 版本 ${match[0]} → ${next}`);
  return next;
}

function releaseTag(version) {
  return `v${version}`;
}

function createManifest(version, signature, exeName, publishedAt = new Date()) {
  const tag = releaseTag(version);
  return {
    version,
    notes: `AI-CG-Studio ${version}`,
    pub_date: publishedAt.toISOString(),
    platforms: {
      'windows-x86_64': {
        signature,
        url: `https://github.com/${RELEASE_REPOSITORY}/releases/download/${tag}/${encodeURIComponent(exeName)}`,
      },
    },
  };
}

function assertPublishReady(version) {
  if (BUMP_KIND) fail('--publish 不能与 --bump 同时使用：请先构建、提交并推送版本，再用 --skip-build --publish');
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (branch !== 'main') fail(`发布必须在 main 执行，当前分支为 ${branch || '(detached)'}`);
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty) fail('发布前工作区必须干净，确保安装包对应已提交源码');
  const repository = JSON.parse(execFileSync('gh', [
    'repo', 'view', RELEASE_REPOSITORY, '--json', 'nameWithOwner,isPrivate,defaultBranchRef',
  ], { cwd: ROOT, encoding: 'utf8', windowsHide: true }));
  if (repository.nameWithOwner !== RELEASE_REPOSITORY || repository.isPrivate) {
    fail(`发布目标必须是公开主项目 ${RELEASE_REPOSITORY}`);
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const remoteHead = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (head !== remoteHead) fail(`main 尚未与 origin/main 同步：HEAD=${head.slice(0, 8)} remote=${remoteHead.slice(0, 8)}`);
  if (version !== require(path.join(ROOT, 'package.json')).version) fail('发布版本读取漂移');
  return head;
}

function publishRelease(version, head, files) {
  const tag = releaseTag(version);
  const notes = [
    `AI-CG-Studio ${version} 桌面版`,
    '',
    '- 启动时自动检查更新，用户确认后才下载并安装。',
    '- 安装包由 Tauri updater 签名验证；SHA-256 文件供手工校验。',
  ].join('\n');
  execFileSync('gh', [
    'release', 'create', tag, ...files,
    '--repo', RELEASE_REPOSITORY,
    '--target', head,
    '--title', `AI-CG-Studio ${version}`,
    '--notes', notes,
    '--latest',
  ], { cwd: ROOT, stdio: 'inherit', windowsHide: true });
}

function main() {
  if (!fs.existsSync(KEY_FILE)) {
    fail(`缺少签名私钥 ${KEY_FILE}（npx tauri signer generate -w runtime/keys/aics-updater.key --password "" --ci）`);
  }
  if (BUMP_KIND) bumpVersion(BUMP_KIND);
  const version = require(path.join(ROOT, 'package.json')).version;

  if (!SKIP_BUILD) {
    if (BUNDLE_ONLY) {
      const binary = path.join(ROOT, 'desktop-tauri/src-tauri/target/release/ai-cg-studio-desktop.exe');
      if (!fs.existsSync(binary)) fail('缺少已构建桌面程序，请先完整构建');
      const binaryVersion = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `(Get-Item -LiteralPath '${binary.replace(/'/g, "''")}').VersionInfo.ProductVersion`],
      { encoding: 'utf8', windowsHide: true }).trim();
      if (binaryVersion !== version) fail(`已构建程序版本 ${binaryVersion} 与发行版本 ${version} 不一致，请完整构建`);
      execFileSync(process.execPath, [path.join(ROOT, 'scripts/maintenance/build-game-installer.js')], { cwd: ROOT, stdio: 'inherit' });
    }
    console.log(BUNDLE_ONLY ? '[release-desktop-update] 重新打包已构建程序（含 updater 签名）' : '[release-desktop-update] npm run package:tauri（含 updater 签名，可能需要数分钟）');
    execFileSync(BUNDLE_ONLY ? process.execPath : 'npm', BUNDLE_ONLY
      ? [require.resolve('@tauri-apps/cli/tauri.js'), 'bundle', '--bundles', 'nsis', '--ci']
      : ['run', 'package:tauri'], {
      cwd: BUNDLE_ONLY ? path.join(ROOT, 'desktop-tauri') : ROOT,
      stdio: 'inherit',
      shell: !BUNDLE_ONLY,
      env: Object.assign({}, require('./run-tauri').tauriEnvironment(), {
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
    .filter((f) => f.endsWith(`_${version}_x64-setup.exe`))
    .map((exe) => ({ exe, sig: `${exe}.sig` }))
    .filter((a) => fs.existsSync(path.join(BUNDLE_DIR, a.sig)));
  if (!artifacts.length) fail(`${BUNDLE_DIR} 下没有 updater 安装包（*-setup.exe + .sig）`);
  const artifact = artifacts[artifacts.length - 1];

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const exeName = artifact.exe;
  const executable = path.join(OUT_DIR, exeName);
  require('./build-modern-installer').buildModernInstaller({
    payload: path.join(BUNDLE_DIR, artifact.exe), output: executable,
  });
  // Sign the distributed wrapper, never reuse the embedded NSIS signature.
  const signerEnv = { ...process.env, TAURI_SIGNING_PRIVATE_KEY_PATH: KEY_FILE, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '' };
  delete signerEnv.TAURI_SIGNING_PRIVATE_KEY;
  execFileSync(process.execPath, [require.resolve('@tauri-apps/cli/tauri.js'), 'signer', 'sign', executable], {
    cwd: ROOT, stdio: 'inherit', windowsHide: true,
    env: signerEnv,
  });
  const signature = fs.readFileSync(`${executable}.sig`, 'utf8').trim();
  const updater = JSON.parse(fs.readFileSync(path.join(ROOT, 'desktop-tauri/src-tauri/tauri.conf.json'), 'utf8')).plugins.updater;
  require('./build-modern-installer').verifyUpdaterSignature(executable, signature, updater.pubkey);

  const manifestPath = path.join(OUT_DIR, 'latest.json');
  const manifest = createManifest(version, signature, exeName);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex').toUpperCase();
  const shaPath = path.join(OUT_DIR, `${exeName}.sha256`);
  fs.writeFileSync(shaPath, `${sha256}  ${exeName}\n`);

  console.log(`[release-desktop-update] ${version} 已生成到 runtime/desktop-updates/`);
  if (PUBLISH) {
    const head = assertPublishReady(version);
    publishRelease(version, head, [manifestPath, executable, `${executable}.sig`, shaPath]);
    console.log(`[release-desktop-update] ${releaseTag(version)} 已发布到 ${RELEASE_REPOSITORY}`);
  } else {
    console.log('[release-desktop-update] 提交并推送 main 后，用 --skip-build --publish 发布 GitHub Release');
  }
}

if (require.main === module) main();

module.exports = { RELEASE_REPOSITORY, createManifest, releaseTag };
