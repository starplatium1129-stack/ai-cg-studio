'use strict';

/**
 * 桌面端打包资源暂存：把网关运行所需文件复制到 desktop-tauri/resources/，
 * 供 tauri.conf.json 的 bundle.resources 引用（tauri 资源路径以 src-tauri
 * 为基准，跨目录相对路径在 build script 的 cwd 下不可靠）。
 *
 * 运行时依赖锁从根 package-lock.json 的非 dev 闭包派生，随后只用 npm ci
 * 安装，避免打包依赖本机当时解析到的版本。
 *
 * 用法：node scripts/maintenance/desktop-stage-resources.js
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { withDesktopBuildLock } = require('./desktop-build-lock');
const { getRuntimeGeneratedInventory } = require('./runtime-generated-files');

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
const RUNTIME_DEPENDENCIES = ['compression', 'express', 'http-proxy-middleware'];

function copyDir(src, dest, includeFile = () => true) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to, includeFile);
    } else if (includeFile(from)) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

function isRuntimeServiceFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.js';
}

function copySelectedFiles(src, dest, relativeFiles) {
  for (const relativePath of relativeFiles) {
    const from = path.join(src, relativePath);
    const to = path.join(dest, relativePath);
    if (!fs.existsSync(from) || !fs.statSync(from).isFile()) {
      throw new Error(`required runtime output is missing: services/${relativePath}`);
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

function buildGatewayPackage(rootPkg, rootLock) {
  const dependencies = Object.fromEntries(RUNTIME_DEPENDENCIES.map((name) => {
    const lockEntry = rootLock.packages[`node_modules/${name}`];
    if (!lockEntry || typeof lockEntry.version !== 'string') {
      throw new Error(`runtime dependency is missing from package-lock.json: ${name}`);
    }
    return [name, lockEntry.version];
  }));

  const packages = {
    '': {
      name: 'aics-gateway',
      version: rootPkg.version,
      dependencies,
    },
  };
  for (const [packagePath, packageInfo] of Object.entries(rootLock.packages)) {
    if (packagePath !== '' && !packageInfo.dev) {
      packages[packagePath] = packageInfo;
    }
  }

  return {
    manifest: {
      name: 'aics-gateway',
      private: true,
      version: rootPkg.version,
      dependencies,
    },
    lock: {
      name: 'aics-gateway',
      version: rootPkg.version,
      lockfileVersion: 3,
      requires: true,
      packages,
    },
  };
}

function resolveNpmInvocation() {
  const npmCli = process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)
    ? process.env.npm_execpath
    : path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (fs.existsSync(npmCli)) return { command: process.execPath, args: [npmCli] };
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: [] };
}

function installGatewayDependencies(gatewayDir) {
  const npm = resolveNpmInvocation();
  execFileSync(npm.command, [
    ...npm.args,
    'ci',
    '--omit=dev',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ], {
    cwd: gatewayDir,
    stdio: 'inherit',
  });
}

function directorySize(directory) {
  let bytes = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    bytes += entry.isDirectory() ? directorySize(fullPath) : fs.statSync(fullPath).size;
  }
  return bytes;
}

function publishStage(tempStage, stage, logger) {
  const backupStage = `${stage}.previous-${process.pid}-${crypto.randomUUID()}`;
  let oldMoved = false;
  try {
    if (fs.existsSync(stage)) {
      fs.renameSync(stage, backupStage);
      oldMoved = true;
    }
    fs.renameSync(tempStage, stage);
  } catch (error) {
    if (oldMoved && !fs.existsSync(stage) && fs.existsSync(backupStage)) {
      try {
        fs.renameSync(backupStage, stage);
      } catch (restoreError) {
        throw new AggregateError([error, restoreError], 'desktop stage publish and rollback both failed');
      }
    }
    throw error;
  }

  if (oldMoved) {
    try {
      fs.rmSync(backupStage, { recursive: true, force: true });
    } catch (error) {
      logger(`[stage] warning: could not remove previous stage: ${error.message}`);
    }
  }
}

function stageResources(options = {}) {
  const root = options.root || ROOT;
  const stage = options.stage || STAGE;
  const logger = options.logger || console.log;
  const installDependencies = options.installDependencies || installGatewayDependencies;
  const runtimeFiles = getRuntimeGeneratedInventory(root);
  const stageParent = path.dirname(stage);
  fs.mkdirSync(stageParent, { recursive: true });
  const tempStage = fs.mkdtempSync(path.join(stageParent, `${path.basename(stage)}.tmp-${process.pid}-`));

  try {
    for (const [source, target] of ENTRIES) {
      const from = path.join(root, source);
      const to = path.join(tempStage, target);
      if (!fs.existsSync(from)) {
        throw new Error(`required staging input is missing: ${source}`);
      }
      if (source === 'services') {
        copySelectedFiles(from, to, runtimeFiles.javascriptFiles);
      } else if (fs.statSync(from).isDirectory()) {
        copyDir(from, to);
      } else {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
      }
      logger(`[stage] ${source} -> resources/${target}`);
    }

    const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const rootLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const gateway = buildGatewayPackage(rootPkg, rootLock);
    const gatewayDir = path.join(tempStage, 'gateway');
    fs.writeFileSync(path.join(gatewayDir, 'package.json'), JSON.stringify(gateway.manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(gatewayDir, 'package-lock.json'), JSON.stringify(gateway.lock, null, 2) + '\n');

    logger('[stage] npm ci (production deps, locked)...');
    installDependencies(gatewayDir);
    logger('[stage] node_modules installed');

    const sizeMb = directorySize(tempStage) / 1024 / 1024;
    publishStage(tempStage, stage, logger);
    logger(`[stage] staged resources: ${sizeMb.toFixed(1)} MB`);
    return { stage, runtimeJavaScriptFiles: runtimeFiles.javascriptFiles };
  } catch (error) {
    fs.rmSync(tempStage, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  await withDesktopBuildLock({ workspaceRoot: ROOT }, () => stageResources());
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[stage] FAIL ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildGatewayPackage,
  copyDir,
  isRuntimeServiceFile,
  publishStage,
  resolveNpmInvocation,
  stageResources,
};
