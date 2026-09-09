import { onMounted, onUnmounted, ref } from 'vue'

export function useControlNavigation(ids: string[]) {
  const activeSection = ref(ids[0] || '')
  let frame = 0
  let requested = ''
  let arrived = false
  function update() {
    frame = 0
    const target = document.getElementById(requested)
    if (target) {
      const bounds = target.getBoundingClientRect()
      if (bounds.top < innerHeight && bounds.bottom > 140) { arrived = true; activeSection.value = requested; return }
      if (!arrived) { activeSection.value = requested; return }
      requested = ''
    }
    let current = ids[0] || ''
    let closestTop = -Infinity
    for (const id of ids) {
      const section = document.getElementById(id)
      const top = section?.getBoundingClientRect().top
      if (top !== undefined && top <= 140 && top > closestTop) { current = id; closestTop = top }
    }
    activeSection.value = current
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update) }
  function openSection(id: string) {
    const section = document.getElementById(id)
    if (section instanceof HTMLDetailsElement) section.open = true
    requested = id
    arrived = false
    activeSection.value = id
  }
  onMounted(() => {
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    const initial = location.hash.slice(1)
    if (ids.includes(initial)) openSection(initial)
    schedule()
  })
  onUnmounted(() => {
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    cancelAnimationFrame(frame)
  })
  return { activeSection, openSection }
}
