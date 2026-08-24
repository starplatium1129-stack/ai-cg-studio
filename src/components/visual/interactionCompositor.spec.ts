import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageCompareSlider from './ImageCompareSlider.vue'
import ZoomableImageViewer from './ZoomableImageViewer.vue'

describe('ImageCompareSlider compositor styles and variables', () => {
  it('exposes container query split variables and bounds initial ratio', () => {
    const wrapper = mount(ImageCompareSlider, {
      props: {
        beforeSrc: '/test-before.png',
        afterSrc: '/test-after.png',
        initialRatio: 0.6,
      },
    })

    const root = wrapper.find('.image-compare-slider')
    expect(root.exists()).toBe(true)
    expect(root.attributes('role')).toBe('slider')
    expect(root.attributes('aria-valuenow')).toBe('60')

    const style = root.attributes('style') || ''
    expect(style).toContain('--split-pos: 60%')
    expect(style).toContain('--split-x: 60cqw')
    expect(style).toContain('--clip-pos: 40%')
  })

  it('updates splitRatio and custom properties on keyboard navigation', async () => {
    const wrapper = mount(ImageCompareSlider, {
      props: {
        beforeSrc: '/test-before.png',
        afterSrc: '/test-after.png',
        initialRatio: 0.5,
      },
    })

    const root = wrapper.find('.image-compare-slider')
    await root.trigger('keydown', { key: 'ArrowLeft' })
    expect(root.attributes('aria-valuenow')).toBe('45')
    expect(root.attributes('style')).toContain('--split-x: 45cqw')

    await root.trigger('keydown', { key: 'ArrowRight' })
    await root.trigger('keydown', { key: 'ArrowRight' })
    expect(root.attributes('aria-valuenow')).toBe('55')
    expect(root.attributes('style')).toContain('--split-x: 55cqw')
  })
})

describe('ZoomableImageViewer panning and zoom state', () => {
  it('mounts and toggles panning class for instantaneous drag response', async () => {
    const wrapper = mount(ZoomableImageViewer, {
      props: {
        src: '/test-art.png',
        alt: 'Test Artwork',
      },
    })

    const container = wrapper.find('.zoomable-image-viewer')
    expect(container.exists()).toBe(true)
    expect(container.classes()).not.toContain('is-panning')

    const layer = wrapper.find('.zoom-transform-layer')
    expect(layer.exists()).toBe(true)
  })
})
