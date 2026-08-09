'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { loadDebtFromGitRef, scanRepository, sha256 } = require('./repo-hygiene-core');

function git(repositoryRoot, args, options = {}) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    input: options.input,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim();
}

function write(repositoryRoot, relativePath, content) {
  const filePath = path.join(repositoryRoot, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function createRepository(t) {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-repo-hygiene-'));
  t.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));
  git(repositoryRoot, ['init', '--quiet']);
  git(repositoryRoot, ['config', 'user.email', 'repo-hygiene@example.invalid']);
  git(repositoryRoot, ['config', 'user.name', 'Repo Hygiene Test']);
  git(repositoryRoot, ['config', 'core.autocrlf', 'false']);
  write(repositoryRoot, '.gitattributes', '* -text\n');
  git(repositoryRoot, ['add', '--', '.gitattributes']);
  return repositoryRoot;
}

function violationsFor(result, target, relativePath, kind) {
  return result.violations.filter((violation) => violation.target === target
    && violation.path === relativePath && violation.kind === kind);
}

test('staged-only BOM is read from the absolute index', (t) => {
  const repositoryRoot = createRepository(t);
  write(repositoryRoot, 'staged.js', 'clean\n');
  git(repositoryRoot, ['add', '--', 'staged.js']);
  write(repositoryRoot, 'staged.js', Buffer.from('\ufeffstaged\n', 'utf8'));
  git(repositoryRoot, ['add', '--', 'staged.js']);
  write(repositoryRoot, 'staged.js', 'clean\n');

  const result = scanRepository(repositoryRoot);
  assert.equal(violationsFor(result, 'index', 'staged.js', 'bom').length, 1);
  assert.equal(violationsFor(result, 'worktree', 'staged.js', 'bom').length, 0);
});

test('unstaged BOM is read from tracked worktree bytes', (t) => {
  const repositoryRoot = createRepository(t);
  write(repositoryRoot, 'unstaged.js', 'clean\n');
  git(repositoryRoot, ['add', '--', 'unstaged.js']);
  write(repositoryRoot, 'unstaged.js', Buffer.from('\ufeffunstaged\n', 'utf8'));

  const result = scanRepository(repositoryRoot);
  assert.equal(violationsFor(result, 'index', 'unstaged.js', 'bom').length, 0);
  assert.equal(violationsFor(result, 'worktree', 'unstaged.js', 'bom').length, 1);
});

test('untracked BOM and every illegal control character are reported', (t) => {
  const repositoryRoot = createRepository(t);
  write(repositoryRoot, 'loose.txt', Buffer.from('\ufeffa\u0001b\u007fc\n', 'utf8'));

  const result = scanRepository(repositoryRoot);
  assert.equal(violationsFor(result, 'untracked', 'loose.txt', 'bom').length, 1);
  assert.deepEqual(
    violationsFor(result, 'untracked', 'loose.txt', 'control').map((violation) => violation.message),
    ['illegal control character U+0001', 'illegal control character U+007F'],
  );
});

test('every line with trailing whitespace is reported', (t) => {
  const repositoryRoot = createRepository(t);
  write(repositoryRoot, 'trailing.txt', 'one  \ntwo\t\nthree \n');

  const result = scanRepository(repositoryRoot);
  assert.deepEqual(
    violationsFor(result, 'untracked', 'trailing.txt', 'trailing-whitespace')
      .map((violation) => violation.line),
    [1, 2, 3],
  );
});

test('nonempty text files require a final newline', (t) => {
  const repositoryRoot = createRepository(t);
  write(repositoryRoot, 'no-newline.txt', 'missing newline');

  const result = scanRepository(repositoryRoot);
  assert.equal(
    violationsFor(result, 'untracked', 'no-newline.txt', 'missing-final-newline').length,
    1,
  );
});

test('index uses LF while worktree and untracked scripts use path-specific EOL', (t) => {
  const repositoryRoot = createRepository(t);
  write(repositoryRoot, 'tool.ps1', 'one\r\ntwo\r\n');
  git(repositoryRoot, ['add', '--', 'tool.ps1']);
  write(repositoryRoot, 'app.js', 'one\ntwo\n');
  git(repositoryRoot, ['add', '--', 'app.js']);
  write(repositoryRoot, 'app.js', 'one\r\ntwo\r\n');
  write(repositoryRoot, 'local.ps1', 'one\ntwo\n');

  const result = scanRepository(repositoryRoot);
  assert.deepEqual(
    violationsFor(result, 'index', 'tool.ps1', 'line-ending').map((violation) => violation.line),
    [1, 2],
  );
  assert.equal(violationsFor(result, 'worktree', 'tool.ps1', 'line-ending').length, 0);
  assert.deepEqual(
    violationsFor(result, 'worktree', 'app.js', 'line-ending').map((violation) => violation.line),
    [1, 2],
  );
  assert.deepEqual(
    violationsFor(result, 'untracked', 'local.ps1', 'line-ending').map((violation) => violation.line),
    [1, 2],
  );
});

test('ignored files are excluded from the untracked scan', (t) => {
  const repositoryRoot = createRepository(t);
  write(repositoryRoot, '.gitignore', 'ignored.txt\n');
  git(repositoryRoot, ['add', '--', '.gitignore']);
  write(repositoryRoot, 'ignored.txt', Buffer.from('\ufeffbad\u0001  \r\n', 'utf8'));

  const result = scanRepository(repositoryRoot);
  assert.equal(result.violations.some((violation) => violation.path === 'ignored.txt'), false);
});

test('unknown extensions fail instead of guessing text or binary', (t) => {
  const repositoryRoot = createRepository(t);
  write(repositoryRoot, 'mystery.quux', 'clean\n');
  write(repositoryRoot, 'known.png', Buffer.from([0, 1, 2, 3]));

  const result = scanRepository(repositoryRoot);
  assert.equal(violationsFor(result, 'untracked', 'mystery.quux', 'unknown-file-type').length, 1);
  assert.equal(result.violations.some((violation) => violation.path === 'known.png'), false);
});

test('unmerged index entries fail explicitly', (t) => {
  const repositoryRoot = createRepository(t);
  const base = git(repositoryRoot, ['hash-object', '-w', '--stdin'], { input: 'base\n' });
  const ours = git(repositoryRoot, ['hash-object', '-w', '--stdin'], { input: 'ours\n' });
  const theirs = git(repositoryRoot, ['hash-object', '-w', '--stdin'], { input: 'theirs\n' });
  git(repositoryRoot, ['update-index', '--index-info'], {
    input: [
      `100644 ${base} 1\tconflict.js`,
      `100644 ${ours} 2\tconflict.js`,
      `100644 ${theirs} 3\tconflict.js`,
      '',
    ].join('\n'),
  });

  const result = scanRepository(repositoryRoot);
  const violations = violationsFor(result, 'index', 'conflict.js', 'unmerged-index-entry');
  assert.equal(violations.length, 1);
  assert.equal(violations[0].message, 'unmerged index entry (stages 1, 2, 3)');
});

test('debt allowance requires the exact tracked full-blob SHA-256', (t) => {
  const repositoryRoot = createRepository(t);
  write(repositoryRoot, 'legacy.js', 'clean\n');
  git(repositoryRoot, ['add', '--', 'legacy.js']);
  const legacyBytes = Buffer.from('legacy  \n');
  write(repositoryRoot, 'legacy.js', legacyBytes);
  const allowances = [{ path: 'legacy.js', sha256: sha256(legacyBytes) }];

  const allowed = scanRepository(repositoryRoot, { allowances });
  assert.equal(violationsFor(allowed, 'worktree', 'legacy.js', 'trailing-whitespace').length, 0);
  assert.equal(allowed.allowed.length, 1);

  write(repositoryRoot, 'legacy.js', 'edited legacy  \n');
  const edited = scanRepository(repositoryRoot, { allowances });
  assert.equal(violationsFor(edited, 'worktree', 'legacy.js', 'trailing-whitespace').length, 1);
});

test('untracked files never receive a debt allowance', (t) => {
  const repositoryRoot = createRepository(t);
  const looseBytes = Buffer.from('loose  \n');
  write(repositoryRoot, 'loose.js', looseBytes);

  const result = scanRepository(repositoryRoot, {
    allowances: [{ path: 'loose.js', sha256: sha256(looseBytes) }],
  });
  assert.equal(violationsFor(result, 'untracked', 'loose.js', 'trailing-whitespace').length, 1);
  assert.equal(result.allowed.length, 0);
});

test('Git baseline allowances cannot bless new or edited debt', (t) => {
  const repositoryRoot = createRepository(t);
  write(repositoryRoot, 'legacy.js', 'legacy  \n');
  git(repositoryRoot, ['add', '--', 'legacy.js']);
  git(repositoryRoot, ['commit', '--quiet', '-m', 'baseline']);
  const baseline = git(repositoryRoot, ['rev-parse', 'HEAD']);
  const allowances = loadDebtFromGitRef(repositoryRoot, baseline);

  const unchanged = scanRepository(repositoryRoot, { allowances });
  assert.equal(unchanged.violations.length, 0);
  assert.ok(unchanged.allowed.some((entry) => entry.path === 'legacy.js'));

  write(repositoryRoot, 'new.js', 'new debt  \n');
  git(repositoryRoot, ['add', '--', 'new.js']);
  const added = scanRepository(repositoryRoot, { allowances });
  assert.equal(violationsFor(added, 'index', 'new.js', 'trailing-whitespace').length, 1);

  write(repositoryRoot, 'legacy.js', 'edited legacy  \n');
  const edited = scanRepository(repositoryRoot, { allowances });
  assert.equal(violationsFor(edited, 'worktree', 'legacy.js', 'trailing-whitespace').length, 1);
});

test('Git discovery errors fail closed', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-repo-hygiene-no-git-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.throws(() => scanRepository(directory), /git rev-parse --show-toplevel failed/);
});
