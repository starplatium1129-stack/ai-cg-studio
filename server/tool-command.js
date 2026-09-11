'use strict';
var fs = require('fs');
var path = require('path');

/** Windows npm/npx are command wrappers. Run their JavaScript CLI without a shell. */
function resolveToolCommand(command, args) {
  var name = command.replace(/\.(?:exe|cmd)$/i, '').toLowerCase();
  if (process.platform !== 'win32' || (name !== 'npm' && name !== 'npx')) return { command: command, args: args };
  var directories = [path.dirname(process.execPath)].concat(String(process.env.PATH || process.env.Path || '').split(path.delimiter));
  for (var directory of directories) {
    if (!directory || !path.isAbsolute(directory)) continue;
    var cli = path.join(directory, 'node_modules', 'npm', 'bin', name + '-cli.js');
    try {
      if (fs.statSync(cli).isFile()) return { command: process.execPath, args: [fs.realpathSync(cli)].concat(args) };
    } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
  }
  throw Object.assign(new Error('当前 Node 安装中未找到 ' + name + ' 的 CLI，请检查 Node/npm 安装'), { code: 'TOOL_UNAVAILABLE' });
}

module.exports = { resolveToolCommand: resolveToolCommand };
