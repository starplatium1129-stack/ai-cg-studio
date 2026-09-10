/** Runs in the browser; preserves CSS group opacity while compositing each ancestor. */
export function textContrast(element: Element, pseudo: string | null = null): number {
  type Color = [number, number, number, number]
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  const parse = (color: string): Color => {
    if (!CSS.supports('color', color)) throw new Error(`Unsupported color: ${color}`)
    context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const over = (front: Color, back: Color): Color => {
    const alpha = front[3] + back[3] * (1 - front[3])
    if (!alpha) return [0, 0, 0, 0]
    return [0, 1, 2].map(i => (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha).concat(alpha) as Color
  }
  const luminance = (color: Color) => color.slice(0, 3).map(value => {
    const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4
  }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0)
  let foreground = parse(getComputedStyle(element, pseudo).color)
  let background: Color = [0, 0, 0, 0]
  const layer = (style: CSSStyleDeclaration) => {
    if (style.backgroundImage !== 'none' && background[3] < .999) {
      throw new Error('Image backgrounds need pixel sampling and visual review')
    }
    const surface = parse(style.backgroundColor)
    foreground = over(foreground, surface); background = over(background, surface)
    // Opacity applies to the complete group, including its background and descendants.
    const opacity = Number(style.opacity)
    foreground[3] *= opacity; background[3] *= opacity
  }
  if (pseudo) layer(getComputedStyle(element, pseudo))
  for (let node: Element | null = element; node; node = node.parentElement) layer(getComputedStyle(node))
  const viewport: Color = [255, 255, 255, 1]
  const a = luminance(over(foreground, viewport)), b = luminance(over(background, viewport))
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
}
