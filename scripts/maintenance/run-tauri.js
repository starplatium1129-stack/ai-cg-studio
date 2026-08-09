'use strict';

const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { withDesktopBuildLock } = require('./desktop-build-lock');
const { resolveNpmInvocation } = require('./desktop-stage-resources');
const { prepareTauri } = require('./prepare-tauri');

const ROOT = path.resolve(__dirname, '../..');

function tauriEnvironment() {
  const env = { ...process.env };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';
  const rustBin = path.join(
    process.env.USERPROFILE || os.homedir(),
    '.rustup',
    'toolchains',
    'stable-x86_64-pc-windows-msvc',
    'bin',
  );
  env[pathKey] = [rustBin, env[pathKey] || ''].filter(Boolean).join(path.delimiter);
  return env;
}

function runCommand(command, args, options = {}) {
  const result = (options.spawnSync || spawnSync)(command, args, {
    cwd: options.cwd || ROOT,
    stdio: options.stdio || 'inherit',
    env: options.env || process.env,
    windowsHide: options.windowsHide ?? true,
  });
  if (result.error) throw result.error;
  return result.status == null ? 1 : result.status;
}

async function runTauri(argv, options = {}) {
  const args = [...argv];
  const mode = args.shift();
  if (!mode || !['dev', 'build'].includes(mode)) {
    throw new Error('usage: node scripts/maintenance/run-tauri.js <dev|build> [tauri args]');
  }

  const workspaceRoot = options.root || ROOT;
  const lock = options.withLock || withDesktopBuildLock;
  return lock({ workspaceRoot }, async () => {
    const npm = options.npmCommand
      ? { command: options.npmCommand, args: options.npmArgs || [] }
      : resolveNpmInvocation();
    const run = options.runCommand || runCommand;
    let status = run(npm.command, [...npm.args, 'run', 'build'], { cwd: workspaceRoot });
    if (status !== 0) return status;
    status = run(npm.command, [...npm.args, 'run', 'test:services-generated'], { cwd: workspaceRoot });
    if (status !== 0) return status;

    const prepare = options.prepareTauri || prepareTauri;
    await prepare({ root: workspaceRoot });

    const cli = options.tauriCli || require.resolve('@tauri-apps/cli/tauri.js');
    const spawnTauri = options.spawnTauri || runCommand;
    return spawnTauri(process.execPath, [cli, mode, ...args], {
      cwd: path.join(workspaceRoot, 'desktop-tauri'),
      stdio: 'inherit',
      env: options.env || tauriEnvironment(),
      windowsHide: false,
    });
  });
}

if (require.main === module) {
  runTauri(process.argv.slice(2)).then((status) => {
    process.exitCode = status;
  }).catch((error) => {
    console.error(`[tauri] CLI failed: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { runCommand, runTauri, tauriEnvironment };
