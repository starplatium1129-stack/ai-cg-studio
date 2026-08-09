'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_WAIT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_STALE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_POLL_MS = 250;

function canonicalWorkspace(workspaceRoot) {
  const resolved = fs.existsSync(workspaceRoot)
    ? fs.realpathSync.native(workspaceRoot)
    : path.resolve(workspaceRoot);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function desktopBuildLockPath(workspaceRoot, lockRoot = path.join(os.tmpdir(), 'aics-desktop-build-locks')) {
  const workspace = canonicalWorkspace(workspaceRoot);
  const digest = crypto.createHash('sha256').update(workspace).digest('hex').slice(0, 24);
  return path.join(lockRoot, `${digest}.lock`);
}

function readOwner(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(lockPath, 'owner.json'), 'utf8'));
  } catch {
    return null;
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === 'EPERM';
  }
}

function clearStaleLock(lockPath, staleMs) {
  let stat;
  try {
    stat = fs.statSync(lockPath);
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    throw error;
  }

  const owner = readOwner(lockPath);
  if (owner && owner.hostname === os.hostname() && processIsAlive(owner.pid)) {
    return false;
  }
  const ownerIsDead = owner && owner.hostname === os.hostname();
  if (!ownerIsDead && Date.now() - stat.mtimeMs <= staleMs) return false;

  const stalePath = `${lockPath}.stale-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.renameSync(lockPath, stalePath);
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    return false;
  }
  fs.rmSync(stalePath, { recursive: true, force: true });
  return true;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireDesktopBuildLock(options) {
  const workspaceRoot = options.workspaceRoot;
  const lockPath = desktopBuildLockPath(workspaceRoot, options.lockRoot);
  const waitTimeoutMs = options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + waitTimeoutMs;
  const token = crypto.randomUUID();

  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  while (true) {
    try {
      fs.mkdirSync(lockPath);
      try {
        fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({
          token,
          pid: process.pid,
          hostname: os.hostname(),
          workspace: canonicalWorkspace(workspaceRoot),
          acquiredAt: new Date().toISOString(),
        }, null, 2) + '\n');
      } catch (error) {
        fs.rmSync(lockPath, { recursive: true, force: true });
        throw error;
      }

      return function releaseDesktopBuildLock() {
        const owner = readOwner(lockPath);
        if (!owner || owner.token !== token) return false;
        fs.rmSync(lockPath, { recursive: true, force: true });
        return true;
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (clearStaleLock(lockPath, staleMs)) continue;
      if (Date.now() >= deadline) {
        const owner = readOwner(lockPath);
        throw new Error(`desktop build lock timeout: ${lockPath}; owner=${JSON.stringify(owner)}`);
      }
      await delay(pollMs);
    }
  }
}

async function withDesktopBuildLock(options, callback) {
  const release = await acquireDesktopBuildLock(options);
  try {
    return await callback();
  } finally {
    release();
  }
}

module.exports = {
  acquireDesktopBuildLock,
  desktopBuildLockPath,
  withDesktopBuildLock,
};
