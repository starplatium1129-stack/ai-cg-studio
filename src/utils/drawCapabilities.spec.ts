import { describe, expect, it } from 'vitest'
import { ENGINE_DEFAULT_CAPABILITIES, resolveDrawCapabilities } from './drawCapabilities'
import type { ModelProfile } from './promptPolicy'

describe('drawCapabilities · 引擎/底模能力表', () => {
  it('引擎默认能力与当前产品契约一致', () => {
    expect(ENGINE_DEFAULT_CAPABILITIES.sd).toMatchObject({
      negative: true,
      lora: true,
      dualCharacter: true,
      promptFormat: 'danbooru',
    })
    expect(ENGINE_DEFAULT_CAPABILITIES.anima).toMatchObject({
      negative: true,
      lora: true,
      dualCharacter: false,
      promptFormat: 'anima-tags',
      teaCache: true,
    })
    expect(ENGINE_DEFAULT_CAPABILITIES.krea2).toMatchObject({
      negative: false,
      lora: false,
      noLora: true,
      dualCharacter: false,
      promptFormat: 'natural-language',
    })
  })

  it('profile.capabilities 可覆盖引擎默认值', () => {
    const profile: ModelProfile = {
      engine: 'anima',
      capabilities: { negative: false, experimental: true },
    }
    const caps = resolveDrawCapabilities('anima', profile)
    expect(caps.negative).toBe(false)
    expect(caps.lora).toBe(true)
    expect(caps.experimental).toBe(true)
    expect(caps.promptFormat).toBe('anima-tags')
  })

  it('后端模型 capabilities 优先级最高', () => {
    const caps = resolveDrawCapabilities('anima', null, {
      lora: false,
      noLora: true,
      characterIdentity: false,
    })
    expect(caps.lora).toBe(false)
    expect(caps.noLora).toBe(true)
    expect(caps.characterIdentity).toBe(false)
    expect(caps.dualCharacter).toBe(false)
  })
})
