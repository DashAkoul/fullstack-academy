export interface DocLink {
  title: string
  url: string
}

export interface Requirement {
  id: string
  text: string
}

export interface Exercise {
  title: string
  /** Realistic, job-like context for the task. */
  scenario: string
  tasks: string[]
  /** Acceptance criteria the AI reviewer checks one by one. */
  requirements: Requirement[]
  repoName: string
  hints: string[]
}

export interface LessonMeta {
  id: string
  title: string
  summary: string
  minutes: number
  docs: DocLink[]
  exercise: Exercise
}

export interface Lesson extends LessonMeta {
  moduleId: string
  /** Global sequential index across the whole curriculum. */
  index: number
  content: string
}

export interface Module {
  id: string
  title: string
  description: string
  icon: string
  lessons: Lesson[]
}
