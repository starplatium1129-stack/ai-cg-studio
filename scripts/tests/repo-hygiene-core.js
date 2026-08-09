'use strict';

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const MAX_GIT_OUTPUT = 32 * 1024 * 1024;
const TARGET_ORDER = new Map([
  ['index', 0],
  ['worktree', 1],
  ['untracked', 2],
]);
const CRLF_EXTENSIONS = new Set(['.bat', '.cmd', '.ps1']);
const TEXT_EXTENSIONS = new Set([
  '.bat', '.c', '.cc', '.cfg', '.cjs', '.cmd', '.conf', '.cpp', '.css', '.csv',
  '.h', '.hpp', '.html', '.ini', '.java', '.js', '.json', '.json5', '.jsx',
  '.lock', '.md', '.mjs', '.mts', '.properties', '.ps1', '.py', '.rs', '.sh',
  '.sql', '.svg', '.toml', '.ts', '.tsx', '.txt', '.vue', '.wgsl', '.xml',
  '.yaml', '.yml',
]);
const BINARY_EXTENSIONS = new Set([
  '.7z', '.avif', '.bin', '.bmp', '.db', '.dll', '.dylib', '.eot', '.exe',
  '.gif', '.ico', '.jpeg', '.jpg', '.lib', '.moc3', '.mp3', '.mp4', '.ogg',
  '.otf', '.pdf', '.png', '.pptx', '.safetensors', '.so', '.sqlite', '.ttf',
  '.wav', '.webm', '.webp', '.woff', '.woff2', '.zip',
]);
const TEXT_FILENAMES = new Set([
  '.editorconfig', '.env', '.env.example', '.eslintignore', '.gitattributes',
  '.gitignore', '.gitkeep', '.npmrc', '.nvmrc', '.prettierignore', '.prettierrc',
  'dockerfile', 'license', 'makefile',
]);

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function gitErrorMessage(error) {
  const stderr = Buffer.isBuffer(error.stderr)
    ? error.stderr.toString('utf8').trim()
    : String(error.stderr || '').trim();
  return stderr || error.message;
}

function runGit(repositoryRoot, args, options = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repositoryRoot,
      encoding: options.encoding === undefined ? null : options.encoding,
      input: options.input,
      maxBuffer: MAX_GIT_OUTPUT,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (error) {
    throw new Error(`git ${args.join(' ')} failed: ${gitErrorMessage(error)}`, { cause: error });
  }
}

function resolveRepositoryRoot(startPath) {
  const requestedRoot = path.resolve(startPath);
  const output = runGit(requestedRoot, ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  const repositoryRoot = output.trim();
  if (!repositoryRoot) throw new Error('git rev-parse returned an empty repository root');
  return path.resolve(repositoryRoot);
}

function splitNullTerminated(output) {
  const source = output.toString('utf8');
  if (source && !source.endsWith('\0')) {
    throw new Error('Git returned malformed non-NUL-terminated path output');
  }
  return source.split('\0').filter(Boolean);
}

function parseIndexEntries(output) {
  return splitNullTerminated(output).map((record) => {
    const separator = record.indexOf('\t');
    if (separator < 0) throw new Error(`Git returned a malformed index record: ${record}`);
    const metadata = record.slice(0, separator).split(' ');
    if (metadata.length !== 3 || !/^[0-7]{6}$/.test(metadata[0])
      || !/^[0-9a-f]{40,64}$/i.test(metadata[1]) || !/^[0-3]$/.test(metadata[2])) {
      throw new Error(`Git returned a malformed index record: ${record}`);
    }
    return {
      mode: metadata[0],
      objectId: metadata[1].toLowerCase(),
      stage: Number(metadata[2]),
      path: record.slice(separator + 1),
    };
  });
}

function classifyPath(relativePath) {
  const basename = path.posix.basename(relativePath).toLowerCase();
  const extension = path.posix.extname(basename).toLowerCase();
  if (TEXT_FILENAMES.has(basename) || TEXT_EXTENSIONS.has(extension)) return 'text';
  if (BINARY_EXTENSIONS.has(extension)) return 'binary';
  return 'unknown';
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function validateAllowance(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`Debt allowance ${index} must be an object`);
  }
  const keys = Object.keys(entry).sort(compareStrings);
  if (keys.length !== 2 || keys[0] !== 'path' || keys[1] !== 'sha256') {
    throw new Error(`Debt allowance ${index} may contain only path and sha256`);
  }
  if (typeof entry.path !== 'string' || !entry.path || entry.path.includes('\\')
    || path.posix.isAbsolute(entry.path) || path.posix.normalize(entry.path) !== entry.path
    || entry.path === '..' || entry.path.startsWith('../')) {
    throw new Error(`Debt allowance ${index} has an invalid repository path`);
  }
  if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
    throw new Error(`Debt allowance ${index} must use a lowercase full-blob SHA-256`);
  }
  return entry;
}

function normalizeAllowances(allowances = []) {
  if (!Array.isArray(allowances)) throw new Error('Debt allowances must be an array');
  const lookup = new Map();
  for (let index = 0; index < allowances.length; index += 1) {
    const entry = validateAllowance(allowances[index], index);
    let hashes = lookup.get(entry.path);
    if (!hashes) {
      hashes = new Set();
      lookup.set(entry.path, hashes);
    }
    if (hashes.has(entry.sha256)) {
      throw new Error(`Duplicate debt allowance for ${entry.path} at ${entry.sha256}`);
    }
    hashes.add(entry.sha256);
  }
  return lookup;
}

function loadDebtFixture(fixturePath) {
  let fixture;
  try {
    fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read repository hygiene debt fixture: ${error.message}`, { cause: error });
  }
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)
    || fixture.version !== 1 || !Array.isArray(fixture.allowances)) {
    throw new Error('Repository hygiene debt fixture must contain version 1 and an allowances array');
  }
  normalizeAllowances(fixture.allowances);
  return fixture.allowances;
}

function loadDebtFromGitRef(startPath, reference) {
  if (typeof reference !== 'string' || !reference.trim()) {
    throw new Error('Repository hygiene baseline ref is required');
  }
  const repositoryRoot = resolveRepositoryRoot(startPath);
  const records = splitNullTerminated(runGit(
    repositoryRoot,
    ['ls-tree', '-r', '-z', '--full-tree', reference.trim()],
  ));
  const allowances = [];
  for (const record of records) {
    const separator = record.indexOf('\t');
    if (separator < 0) throw new Error(`Git returned a malformed tree record: ${record}`);
    const metadata = record.slice(0, separator).split(' ');
    const relativePath = record.slice(separator + 1);
    if (metadata.length !== 3 || metadata[1] !== 'blob' || !/^[0-9a-f]{40,64}$/i.test(metadata[2])) {
      continue;
    }
    if (classifyPath(relativePath) !== 'text') continue;
    const bytes = runGit(repositoryRoot, ['cat-file', '-p', metadata[2]]);
    if (scanText(bytes, '\n').length > 0) {
      allowances.push({ path: relativePath, sha256: sha256(bytes) });
    }
  }
  return allowances;
}

function positionAt(source, targetIndex) {
  let line = 1;
  let column = 1;
  for (let index = 0; index < targetIndex; index += 1) {
    if (source[index] === '\r') {
      if (source[index + 1] === '\n') index += 1;
      line += 1;
      column = 1;
    } else if (source[index] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function textViolation(kind, message, source, index) {
  const location = positionAt(source, index);
  return { kind, message, ...location };
}

function scanText(bytes, expectedEol) {
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return [{ kind: 'invalid-utf8', message: 'invalid UTF-8' }];
  }

  const violations = [];
  for (let index = source.indexOf('\ufeff'); index >= 0; index = source.indexOf('\ufeff', index + 1)) {
    violations.push(textViolation('bom', 'UTF-8 BOM is not allowed', source, index));
  }

  const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
  for (const match of source.matchAll(controlPattern)) {
    const code = match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    violations.push(textViolation(
      'control',
      `illegal control character U+${code}`,
      source,
      match.index,
    ));
  }

  const trailingPattern = /[ \t]+(?=\r\n|\r|\n|$)/g;
  for (const match of source.matchAll(trailingPattern)) {
    violations.push(textViolation(
      'trailing-whitespace',
      'trailing whitespace',
      source,
      match.index,
    ));
  }

  if (source.length > 0 && !source.endsWith('\n') && !source.endsWith('\r')) {
    violations.push(textViolation(
      'missing-final-newline',
      'text file must end with a newline',
      source,
      source.length,
    ));
  }

  const expectedName = expectedEol === '\r\n' ? 'CRLF' : 'LF';
  for (let index = 0; index < source.length; index += 1) {
    let actual = null;
    if (source[index] === '\r') {
      if (source[index + 1] === '\n') {
        actual = '\r\n';
        index += 1;
      } else {
        actual = '\r';
      }
    } else if (source[index] === '\n') {
      actual = '\n';
    }
    if (actual && actual !== expectedEol) {
      const actualName = actual === '\r\n' ? 'CRLF' : actual === '\n' ? 'LF' : 'CR';
      const locationIndex = actual === '\r\n' ? index - 1 : index;
      violations.push(textViolation(
        'line-ending',
        `unexpected ${actualName} line ending; expected ${expectedName}`,
        source,
        locationIndex,
      ));
    }
  }

  return violations;
}

function readIndexBlob(repositoryRoot, entry) {
  return runGit(repositoryRoot, ['cat-file', '-p', entry.objectId]);
}

function expectedLineEnding(target, relativePath) {
  if (target === 'index') return '\n';
  return CRLF_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase()) ? '\r\n' : '\n';
}

function unknownViolation(target, relativePath) {
  const extension = path.posix.extname(relativePath).toLowerCase();
  const label = extension || path.posix.basename(relativePath);
  return {
    target,
    path: relativePath,
    kind: 'unknown-file-type',
    message: `unknown file type "${label}"; classify it explicitly as text or binary`,
  };
}

function appendBlobViolations(result, target, relativePath, bytes, allowanceLookup) {
  const violations = scanText(bytes, expectedLineEnding(target, relativePath));
  if (violations.length === 0) return;
  const digest = sha256(bytes);
  const allowed = target !== 'untracked' && allowanceLookup.get(relativePath)?.has(digest);
  if (allowed) {
    result.allowed.push({ target, path: relativePath, sha256: digest, count: violations.length });
    return;
  }
  for (const violation of violations) {
    result.violations.push({ target, path: relativePath, ...violation });
  }
}

function repositoryPath(repositoryRoot, relativePath) {
  const absolutePath = path.resolve(repositoryRoot, ...relativePath.split('/'));
  const relative = path.relative(repositoryRoot, absolutePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Git returned an unsafe repository path: ${relativePath}`);
  }
  return absolutePath;
}

function readWorktreeBlob(repositoryRoot, relativePath, target, result) {
  const absolutePath = repositoryPath(repositoryRoot, relativePath);
  let stat;
  try {
    stat = fs.lstatSync(absolutePath);
  } catch (error) {
    if (target === 'worktree' && error.code === 'ENOENT') return null;
    throw new Error(`Unable to inspect ${target} file ${relativePath}: ${error.message}`, { cause: error });
  }
  if (!stat.isFile()) {
    result.violations.push({
      target,
      path: relativePath,
      kind: 'unsupported-file-type',
      message: 'repository entry is not a regular file',
    });
    return null;
  }
  try {
    return fs.readFileSync(absolutePath);
  } catch (error) {
    throw new Error(`Unable to read ${target} file ${relativePath}: ${error.message}`, { cause: error });
  }
}

function scanWorktreeTarget(repositoryRoot, relativePaths, target, allowanceLookup, result) {
  for (const relativePath of relativePaths) {
    const bytes = readWorktreeBlob(repositoryRoot, relativePath, target, result);
    if (bytes === null) continue;
    result.counts[target] += 1;
    const classification = classifyPath(relativePath);
    if (classification === 'unknown') {
      result.violations.push(unknownViolation(target, relativePath));
    } else if (classification === 'text') {
      appendBlobViolations(result, target, relativePath, bytes, allowanceLookup);
    }
  }
}

function sortViolations(violations) {
  violations.sort((left, right) => {
    const targetDifference = TARGET_ORDER.get(left.target) - TARGET_ORDER.get(right.target);
    if (targetDifference !== 0) return targetDifference;
    const pathDifference = compareStrings(left.path, right.path);
    if (pathDifference !== 0) return pathDifference;
    const lineDifference = (left.line || Number.MAX_SAFE_INTEGER) - (right.line || Number.MAX_SAFE_INTEGER);
    if (lineDifference !== 0) return lineDifference;
    const columnDifference = (left.column || Number.MAX_SAFE_INTEGER)
      - (right.column || Number.MAX_SAFE_INTEGER);
    if (columnDifference !== 0) return columnDifference;
    return compareStrings(left.kind, right.kind);
  });
}

function scanRepository(startPath, options = {}) {
  const repositoryRoot = resolveRepositoryRoot(startPath);
  const allowanceLookup = normalizeAllowances(options.allowances || []);
  const result = {
    repositoryRoot,
    counts: { index: 0, worktree: 0, untracked: 0 },
    violations: [],
    allowed: [],
  };

  const indexEntries = parseIndexEntries(runGit(repositoryRoot, ['ls-files', '--stage', '-z']));
  const entriesByPath = new Map();
  for (const entry of indexEntries) {
    const entries = entriesByPath.get(entry.path) || [];
    entries.push(entry);
    entriesByPath.set(entry.path, entries);
  }

  const trackedEntries = [];
  const textIndexEntries = [];
  for (const relativePath of [...entriesByPath.keys()].sort(compareStrings)) {
    const entries = entriesByPath.get(relativePath);
    const stages = [...new Set(entries.map((entry) => entry.stage))].sort();
    if (stages.some((stage) => stage !== 0)) {
      result.violations.push({
        target: 'index',
        path: relativePath,
        kind: 'unmerged-index-entry',
        message: `unmerged index entry (stages ${stages.join(', ')})`,
      });
      continue;
    }
    if (entries.length !== 1) throw new Error(`Git returned duplicate stage-zero entries for ${relativePath}`);
    const entry = entries[0];
    result.counts.index += 1;
    if (entry.mode !== '100644' && entry.mode !== '100755') {
      result.violations.push({
        target: 'index',
        path: relativePath,
        kind: 'unsupported-index-mode',
        message: `unsupported index mode ${entry.mode}`,
      });
      continue;
    }
    trackedEntries.push(entry);
    const classification = classifyPath(relativePath);
    if (classification === 'unknown') {
      result.violations.push(unknownViolation('index', relativePath));
    } else if (classification === 'text') {
      textIndexEntries.push(entry);
    }
  }

  for (const entry of textIndexEntries) {
    appendBlobViolations(
      result,
      'index',
      entry.path,
      readIndexBlob(repositoryRoot, entry),
      allowanceLookup,
    );
  }

  scanWorktreeTarget(
    repositoryRoot,
    trackedEntries.map((entry) => entry.path).sort(compareStrings),
    'worktree',
    allowanceLookup,
    result,
  );

  const untrackedPaths = splitNullTerminated(runGit(
    repositoryRoot,
    ['ls-files', '--others', '--exclude-per-directory=.gitignore', '-z'],
  )).sort(compareStrings);
  scanWorktreeTarget(repositoryRoot, untrackedPaths, 'untracked', allowanceLookup, result);

  sortViolations(result.violations);
  result.allowed.sort((left, right) => {
    const pathDifference = compareStrings(left.path, right.path);
    return pathDifference || TARGET_ORDER.get(left.target) - TARGET_ORDER.get(right.target);
  });
  return result;
}

function formatViolation(violation) {
  const line = violation.line ? `:${violation.line}` : '';
  const column = violation.column ? `:${violation.column}` : '';
  return `${violation.target}:${violation.path}${line}${column}: ${violation.message}`;
}

module.exports = {
  classifyPath,
  formatViolation,
  loadDebtFromGitRef,
  loadDebtFixture,
  scanRepository,
  scanText,
  sha256,
};
