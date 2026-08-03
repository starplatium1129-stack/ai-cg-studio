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
}

function firstExisting(candidates: string[]): string {
  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0]
}

export function resolveDesktopPaths(input: DesktopPathInput): DesktopPaths {
  const env = input.env || process.env
  const appRoot = path.resolve(input.appPath)
  const resourcesRoot = path.resolve(input.resourcesPath)
  const unpackedRoot = path.join(resourcesRoot, 'app.asar.unpacked')
  const gatewayCandidates = input.isPackaged
    ? [
        path.join(unpackedRoot, 'server.js'),
        path.join(resourcesRoot, 'gateway', 'server.js'),
        path.join(appRoot, 'server.js'),
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
    gatewayCwd: path.dirname(gatewayScript),
    gatewayScript,
    assetsRoot,
    toolsRoot,
    runtimeRoot: path.join(path.resolve(input.userDataPath), 'gateway'),
    aiWorkspaceRoot,
  }
}
