'use strict';

/**
 * 桌宠本地工具（Companion Tools）——服务端唯一权威定义。
 *
 * 网关在对话请求启用 companionTools 时，把这些 function schema 附加到
 * 上游 LLM 请求；流式响应中的 tool_calls 增量由 chat.js 解析为
 * `{ type:'tool-call', ... }` NDJSON 事件，由渲染端经桌面 IPC 执行
 * （desktop/toolRunner.ts）。路径全部限制在 AI 工作区内。
 */

var TOOL_DEFINITIONS = [
  {
    type:'function',
    function:{
      name:'list_files',
      description:'列出 AI 工作区（AI_WORKSPACE_ROOT）内某个目录的内容。参数 path 为空表示工作区根目录；只读操作。',
      parameters:{
        type:'object',
        properties:{
          path:{ type:'string', description:'工作区内的相对路径，如 "SceneShowcase" 或 ""。禁止 .. 与绝对路径。' }
        },
        required:['path']
      }
    }
  },
  {
    type:'function',
    function:{
      name:'read_file',
      description:'读取 AI 工作区内一个文本文件的内容（UTF-8，最大 1MB）。用于查看场景数据、脚本、配置等。',
      parameters:{
        type:'object',
        properties:{
          path:{ type:'string', description:'工作区内的相对文件路径，如 "data/scenes.json"。禁止 .. 与绝对路径。' }
        },
        required:['path']
      }
    }
  },
  {
    type:'function',
    function:{
      name:'write_file',
      description:'在 AI 工作区内写入或覆盖一个文本文件（UTF-8，最大 512KB）。目录不存在会自动创建。用于保存脚本、笔记或修改配置。',
      parameters:{
        type:'object',
        properties:{
          path:{ type:'string', description:'工作区内的相对文件路径，如 "companion-notes/idea.md"。禁止 .. 与绝对路径。' },
          content:{ type:'string', description:'要写入的完整文本内容（覆盖写入）。' }
        },
        required:['path','content']
      }
    }
  },
  {
    type:'function',
    function:{
      name:'run_command',
      description:'在 AI 工作区目录下执行一条本地命令（参数数组形式，无 shell 解释，120 秒超时）。用于运行 python 脚本、git 状态检查等操作。',
      parameters:{
        type:'object',
        properties:{
          command:{ type:'string', description:'可执行文件，如 "python"、"git"、"node"，或工作区内脚本的相对路径。' },
          args:{ type:'array', items:{ type:'string' }, description:'命令参数列表，例如 ["--version"]。' }
        },
        required:['command','args']
      }
    }
  },
  {
    type:'function',
    function:{
      name:'read_image',
      description:'读取 AI 工作区内一张图片（PNG/JPEG/WebP/GIF，最大 8MB）并理解其内容。需要当前对话模型支持视觉输入（Gemini/Claude 等）；纯文本模型会失败。',
      parameters:{
        type:'object',
        properties:{
          path:{ type:'string', description:'工作区内的相对图片路径，如 "samples/preview.png"。禁止 .. 与绝对路径。' }
        },
        required:['path']
      }
    }
  },
  {
    type:'function',
    function:{
      name:'get_workspace_info',
      description:'返回 AI 工作区根目录的绝对路径与是否可访问。用于确认文件操作的范围。',
      parameters:{ type:'object', properties:{} }
    }
  }
];

var TOOL_NAMES = Object.create(null);
TOOL_DEFINITIONS.forEach(function (definition) { TOOL_NAMES[definition.function.name] = true; });

function isKnownToolName(name) {
  return TOOL_NAMES[name] === true;
}

module.exports = {
  TOOL_DEFINITIONS:TOOL_DEFINITIONS,
  isKnownToolName:isKnownToolName
};
