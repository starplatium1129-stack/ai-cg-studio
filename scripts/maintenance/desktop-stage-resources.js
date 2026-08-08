'use strict';

/**
 * 桌面端打包资源暂存：把网关运行所需文件复制到 desktop-tauri/resources/，
 * 供 tauri.conf.json 的 bundle.resources 引用（tauri 资源路径以 src-tauri
 * 为基准，跨目录相对路径在 build script 的 cwd 下不可靠）。
 *
 * 用法：node scripts/maintenance/desktop-stage-resources.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const STAGE = path.join(ROOT, 'desktop-tauri', 'src-tauri', 'resources');

const ENTRIES = [
  ['server.js', 'gateway/server.js'],
  ['server', 'gateway/server'],
  ['routes', 'gateway/routes'],
  ['services', 'gateway/services'],
  ['scripts/runtime', 'gateway/scripts/runtime'],
  ['data', 'gateway/data'],
  ['dist', 'gateway/dist'],
  ['assets', 'gateway/assets'],
  ['tools', 'gateway/tools'],
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

for (const [source, target] of ENTRIES) {
  const from = path.join(ROOT, source);
  const to = path.join(STAGE, target);
  if (!fs.existsSync(from)) {
    console.warn(`[stage] SKIP missing: ${source}`);
    continue;
  }
  if (fs.statSync(from).isDirectory()) {
    copyDir(from, to);
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  console.log(`[stage] ${source} -> resources/${target}`);
}

// 网关生产依赖（express/compression/http-proxy-middleware）：生成 package.json
// 并在 staging 目录安装（node_modules 不入库，构建产物）
const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const serverPkg = {
  name: 'aics-gateway',
  private: true,
  version: rootPkg.version,
  dependencies: {
    express: rootPkg.dependencies.express,
    compression: rootPkg.dependencies.compression,
    'http-proxy-middleware': rootPkg.dependencies['http-proxy-middleware'],
  },
};
const gatewayDir = path.join(STAGE, 'gateway');
fs.writeFileSync(path.join(gatewayDir, 'package.json'), JSON.stringify(serverPkg, null, 2) + '\n');
const { execSync } = require('child_process');
console.log('[stage] npm install (production deps)...');
execSync('npm install --omit=dev --no-audit --no-fund', { cwd: gatewayDir, stdio: 'inherit' });
console.log('[stage] node_modules installed');

const size = fs.existsSync(STAGE)
  ? (fs.readdirSync(STAGE, { recursive: true })
      .map(f => fs.statSync(path.join(STAGE, f)).size)
      .reduce((a, b) => a + b, 0) / 1024 / 1024)
  : 0;
console.log(`[stage] staged resources: ${size.toFixed(1)} MB`);
