import { ref } from 'vue'

interface TrainingStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface UseTrainingOnboardingOptions {
  storage?: TrainingStorage
}

function browserStorage(): TrainingStorage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

function readDismissed(storage: TrainingStorage | undefined): boolean {
  try {
    return storage?.getItem('aics_training_onboarded') === '1'
  } catch {
    return false
  }
}

export function useTrainingOnboarding(options: UseTrainingOnboardingOptions = {}) {
  const storage = options.storage ?? browserStorage()
  const onboardingDismissed = ref(readDismissed(storage))

  function dismissOnboarding(): void {
    onboardingDismissed.value = true
    try {
      storage?.setItem('aics_training_onboarded', '1')
    } catch {
      // Private browsing storage failures must not break the workbench.
    }
  }

  return { onboardingDismissed, dismissOnboarding }
}
