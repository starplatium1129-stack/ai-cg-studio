import onboarding from '../../data/popular-onboarding.json' with { type: 'json' }

const pendingIds = new Set(onboarding.characters.filter(c => c.portraitPending).map(c => c.id))
const themeIds = new Set(onboarding.characters.map(c => c.id))

export function hasOnboardingTheme(id = ''): boolean { return themeIds.has(id) }

export function isPopularPortraitPending(id: string): boolean {
  return pendingIds.has(id)
}

/** Registration is usable before artwork is produced; never invent a missing asset URL. */
export function popularPortraitSrc(id: string, version?: string | number): string {
  if (isPopularPortraitPending(id)) return '/assets/characters/portrait-pending.svg'
  const suffix = version === undefined ? '' : `?v=${encodeURIComponent(String(version))}`
  return `/assets/characters/thumbs/popular-${encodeURIComponent(id)}.webp${suffix}`
}
