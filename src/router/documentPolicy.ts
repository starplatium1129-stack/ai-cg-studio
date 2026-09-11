const LIVE2D_PATHS = new Set(['/chat', '/companion'])

function isLive2dPath(path: string): boolean {
  return LIVE2D_PATHS.has(path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/')
}

/** CSP belongs to the loaded document, never to sessionStorage or the SPA URL. */
export function needsDocumentReload(fromPath: string, toPath: string): boolean {
  return isLive2dPath(fromPath) !== isLive2dPath(toPath)
}
