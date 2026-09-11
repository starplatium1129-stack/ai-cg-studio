'use strict';
var fs = require('fs');
var path = require('path');

function isPathInsideWorkspace(root, candidate) {
  var relative = path.relative(path.resolve(root), path.resolve(candidate));
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}

/** Resolve links in existing ancestors, including parents of files about to be created. */
function physicalPath(candidate) {
  var current = path.resolve(candidate);
  var suffix = [];
  while (true) {
    try { fs.lstatSync(current); break; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      var parent = path.dirname(current);
      if (parent === current) throw error;
      suffix.unshift(path.basename(current));
      current = parent;
    }
  }
  // A dangling link is an error, not an absent directory that may be created.
  return path.join.apply(path, [fs.realpathSync(current)].concat(suffix));
}

function resolveWorkspacePath(workspaceRoot, relative) {
  var root = path.resolve(workspaceRoot);
  var clean = String(relative || '').trim().replace(/\\/g, '/');
  if (clean.startsWith('/') || /^[a-zA-Z]:/.test(clean)) throw new Error('只接受工作区内的相对路径');
  if (clean.split('/').some(function (part) { return part === '..'; })) throw new Error('路径不能包含 ..');
  if (clean.includes('\0') || (process.platform === 'win32' && clean.includes(':'))) throw new Error('路径包含无效字符');
  var resolved = path.resolve(root, clean || '.');
  if (!isPathInsideWorkspace(root, resolved)) throw new Error('路径超出 AI 工作区范围');
  var physicalRoot = physicalPath(root);
  var physical = physicalPath(resolved);
  if (!isPathInsideWorkspace(physicalRoot, physical)) throw new Error('路径链接指向 AI 工作区外，已拒绝访问');
  return physical;
}

module.exports = { isPathInsideWorkspace: isPathInsideWorkspace, resolveWorkspacePath: resolveWorkspacePath };
