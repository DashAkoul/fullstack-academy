import { create } from 'zustand'
import type { SecretsStatus } from '@shared/types'

interface SecretsStore {
  status: SecretsStatus | null
  loading: boolean
  refresh: () => Promise<void>
}

export const useSecrets = create<SecretsStore>((set) => ({
  status: null,
  loading: false,
  refresh: async () => {
    set({ loading: true })
    try {
      set({ status: await window.academy.secrets.status() })
    } catch (e) {
      console.error('خواندن وضعیت کلیدها ناموفق بود', e)
    } finally {
      set({ loading: false })
    }
  }
}))
