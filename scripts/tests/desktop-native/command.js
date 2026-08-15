'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')

const PACKAGING_INPUTS = [
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.runtime.json',
  'src',
  'public',
  'server.js',
  'server',
  'routes',
  'services',
  'scripts/runtime',
  'scripts/maintenance',
  'data',
  'dist',
  'assets',
  'tools',
  'desktop-tauri/web',
  'desktop-tauri/src-tauri/Cargo.toml',
  'desktop-tauri/src-tauri/Cargo.lock',
  'desktop-tauri/src-tauri/build.rs',
  'desktop-tauri/src-tauri/tauri.conf.json',
  'desktop-tauri/src-tauri/capabilities',
  'desktop-tauri/src-tauri/icons',
  'desktop-tauri/src-tauri/src',
  'desktop-tauri/src-tauri/binaries',
  'desktop-tauri/src-tauri/resources',
  'desktop-tauri/native-live2d/Cargo.toml',
  'desktop-tauri/native-live2d/Cargo.lock',
  'desktop-tauri/native-live2d/build.rs',
  'desktop-tauri/native-live2d/csrc',
  'desktop-tauri/native-live2d/src',
]

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath))
}

function quoteArg(value) {
  const text = String(value)
  return /[\s"]/u.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text
}

function commandText(command, args) {
  return [command, ...args].map(quoteArg).join(' ')
}

function executableWorks(candidate, versionArgs = ['--version']) {
  if (!candidate) return false
  if ((candidate.includes('\\') || candidate.includes('/')) && !fs.existsSync(candidate)) return false
  const result = spawnSync(candidate, versionArgs, { stdio: 'ignore', windowsHide: true, timeout: 15_000 })
  return result.status === 0
}

function findExecutable(name, candidates = []) {
  const suffix = process.platform === 'win32' ? '.exe' : ''
  const home = os.homedir()
  const defaults = name === 'cargo'
    ? [path.join(home, '.cargo', 'bin', `cargo${suffix}`)]
    : name === 'rustc'
      ? [path.join(home, '.cargo', 'bin', `rustc${suffix}`)]
      : name === 'tauri-driver'
        ? [path.join(home, '.cargo', 'bin', `tauri-driver${suffix}`)]
        : []
  const probeArgs = name === 'tauri-driver' ? ['--help'] : ['--version']
  return [...candidates, ...defaults, `${name}${suffix}`, name]
    .find(candidate => executableWorks(candidate, probeArgs)) || null
}

function terminateTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  } else {
    try { process.kill(-pid, 'SIGKILL') } catch {}
  }
}

function runCommand(command, args, options = {}) {
  const display = options.display || commandText(command, args)
  const evidence = options.evidence
  evidence?.commandStart(display)
  const started = Date.now()
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    let timer = null
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      windowsHide: options.windowsHide ?? true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const finish = (code, error) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      const durationMs = Date.now() - started
      evidence?.commandEnd(display, code, durationMs, error ? error.message : '')
      resolve({ code, stdout, stderr, durationMs, error })
    }
    child.stdout.on('data', chunk => {
      const text = String(chunk)
      stdout += text
      process.stdout.write(text)
      evidence?.commandOutput('stdout', text)
    })
    child.stderr.on('data', chunk => {
      const text = String(chunk)
      stderr += text
      process.stderr.write(text)
      evidence?.commandOutput('stderr', text)
    })
    child.on('error', error => finish(1, error))
    child.on('close', code => finish(code == null ? 1 : code, null))
    timer = setTimeout(() => {
      terminateTree(child.pid)
      finish(124, new Error(`command timed out after ${options.timeoutMs}ms`))
    }, options.timeoutMs || 30 * 60_000)
  })
}

function walkFiles(target, root, output) {
  if (!fs.existsSync(target)) return
  const stat = fs.statSync(target)
  if (stat.isFile()) {
    output.push({ absolute: target, relative: path.relative(root, target).replace(/\\/g, '/') })
    return
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const fullPath = path.join(target, entry.name)
    if (entry.isDirectory()) walkFiles(fullPath, root, output)
    else if (entry.isFile()) output.push({ absolute: fullPath, relative: path.relative(root, fullPath).replace(/\\/g, '/') })
  }
}

function packagingFingerprint(root) {
  const files = []
  for (const relative of PACKAGING_INPUTS) walkFiles(path.join(root, relative), root, files)
  files.sort((a, b) => a.relative.localeCompare(b.relative, 'en'))
  const aggregate = crypto.createHash('sha256')
  let totalBytes = 0
  for (const file of files) {
    const data = fs.readFileSync(file.absolute)
    totalBytes += data.length
    aggregate.update(file.relative)
    aggregate.update('\0')
    aggregate.update(sha256Buffer(data))
    aggregate.update('\n')
  }
  return { sha256: aggregate.digest('hex'), fileCount: files.length, totalBytes }
}

function locateInstaller(root) {
  const directory = path.join(root, 'desktop-tauri', 'src-tauri', 'target', 'release', 'bundle', 'nsis')
  if (!fs.existsSync(directory)) return null
  const installers = fs.readdirSync(directory)
    .filter(name => /-setup\.exe$/i.test(name))
    .map(name => path.join(directory, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  return installers[0] || null
}

function installerMetadata(root, installerPath) {
  const stat = fs.statSync(installerPath)
  return {
    path: installerPath,
    sha256: sha256File(installerPath),
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    version: JSON.parse(fs.readFileSync(path.join(root, 'desktop-tauri', 'src-tauri', 'tauri.conf.json'), 'utf8')).version,
    packagingFingerprint: packagingFingerprint(root),
  }
}

module.exports = {
  commandText,
  findExecutable,
  installerMetadata,
  locateInstaller,
  packagingFingerprint,
  runCommand,
  sha256File,
  terminateTree,
}
