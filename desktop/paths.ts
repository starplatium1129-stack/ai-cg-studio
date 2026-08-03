import fs from 'node:fs'
import path from 'node:path'

export interface DesktopPathInput {
  appPath: string
  resourcesPath: string
  userDataPath: string
  isPackaged: boolean
  env?: NodeJS.ProcessEnv
}

export interface DesktopPaths {
  appRoot: string
  resourcesRoot: string
  unpackedRoot: string
  gatewayCwd: string
  gatewayScript: string
  assetsRoot: string
  toolsRoot: string
  runtimeRoot: string
  aiWorkspaceRoot: string
  aiWorkspaceFile: string
}

function firstExisting(candidates: string[]): string {
  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0]
}

export function resolveDesktopPaths(input: DesktopPathInput): DesktopPaths {
  const env = input.env || process.env
  const appRoot = path.resolve(input.appPath)
  const resourcesRoot = path.resolve(input.resourcesPath)
  const unpackedRoot = path.join(resourcesRoot, 'app.asar.unpacked')
  // asarUnpack 的文件会同时在 asar 内保留桩（Electron 自动重定向到
  // app.asar.unpacked 的真实副本），因此必须优先用 asar 路径 fork：
  // 直接 fork unpacked 磁盘路径会让 require('express') 沿真实目录向上找
  // node_modules 而失败（依赖在 asar 内）。
  const gatewayCandidates = input.isPackaged
    ? [
        path.join(appRoot, 'server.js'),
        path.join(unpackedRoot, 'server.js'),
        path.join(resourcesRoot, 'gateway', 'server.js'),
      ]
    : [path.join(appRoot, 'server.js')]
  const gatewayScript = firstExisting(gatewayCandidates)
  const assetsRoot = firstExisting([
    path.join(resourcesRoot, 'assets'),
    path.join(appRoot, 'assets'),
  ])
  const toolsRoot = firstExisting([
    path.join(resourcesRoot, 'tools'),
    path.join(appRoot, 'tools'),
  ])
  const aiWorkspaceRoot = path.resolve(
    env.AI_WORKSPACE_ROOT || path.join(path.dirname(appRoot), 'AI'),
  )

  return {
    appRoot,
    resourcesRoot,
    unpackedRoot,
    // cwd 必须是真实存在的目录：asar 路径（resources/app.asar）是文件不是
    // 目录，utilityProcess.fork 会直接失败。
    gatewayCwd: input.isPackaged ? unpackedRoot : path.dirname(gatewayScript),
    gatewayScript,
    assetsRoot,
    toolsRoot,
    runtimeRoot: path.join(path.resolve(input.userDataPath), 'gateway'),
    aiWorkspaceRoot,
    aiWorkspaceFile: path.join(path.resolve(input.userDataPath), 'ai-workspace.json'),
  }
}
