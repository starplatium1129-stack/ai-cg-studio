const LIVE2D_PATHS = new Set(['/chat', '/companion'])

function documentPolicy(path: string): string {
  const normalized = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
  if (LIVE2D_PATHS.has(normalized)) return 'live2d-voice'
  return normalized === '/companion-chat' ? 'voice' : 'standard'
}

/** CSP and microphone policy belong to the document, not sessionStorage or the SPA URL. */
export function needsDocumentReload(fromPath: string, toPath: string): boolean {
  return documentPolicy(fromPath) !== documentPolicy(toPath)
}
