import { copyText } from '@/utils/clipboard'
import { useToast } from '@/composables/useToast'

export async function copyWithFeedback(text: string, success = '已复制到剪贴板'): Promise<boolean> {
  const copied = await copyText(text)
  useToast().show(copied ? success : '复制未完成，请选中内容后按 Ctrl/Cmd+C 手动复制', copied ? 'success' : 'warning')
  return copied
}
