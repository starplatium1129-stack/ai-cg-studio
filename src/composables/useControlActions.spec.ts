import { ref } from 'vue'
import { expect, it, vi } from 'vitest'
import { useControlActions } from './useControlActions'

it('configuration saves ignore repeated clicks and allow retry after failure', async () => {
  const status = {
    lastStatus: () => ({}), pollStatus: vi.fn(), feedbackText: ref(''),
    sdHost: ref('http://localhost:7860'), comfyHost: ref('http://localhost:8188'), ttsHost: ref('http://localhost:9880'),
    voiceNeneRef: ref(''), voiceNenePrompt: ref(''), voiceNatsumeRef: ref(''), voiceNatsumePrompt: ref(''),
  } as unknown as Parameters<typeof useControlActions>[0]
  let reject!: (error: Error) => void
  const saveConfig = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail }))
  const showToast = vi.fn()
  const control = { saveConfig } as unknown as NonNullable<Parameters<typeof useControlActions>[1]['control']>
  const actions = useControlActions(status, { control, showToast })
  const first = actions.saveConfig()
  await actions.saveConfig()
  expect(saveConfig).toHaveBeenCalledTimes(1)
  expect(actions.savingConfig.value).toBe(true)
  reject(new Error('network failed'))
  await first
  expect(actions.savingConfig.value).toBe(false)
  expect(showToast).toHaveBeenCalledWith('network failed', true)
  saveConfig.mockResolvedValue(undefined)
  await actions.saveConfig()
  expect(saveConfig).toHaveBeenCalledTimes(2)
  expect(showToast).toHaveBeenCalledWith('生成服务配置已保存')
})
