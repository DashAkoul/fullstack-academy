import type { AcademyBridge } from '../shared/types'

declare global {
  interface Window {
    academy: AcademyBridge
  }
}

export {}
