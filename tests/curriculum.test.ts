import { describe, expect, it } from 'vitest'
import { lessons, modules } from '@/data/curriculum'
import { isLessonUnlocked } from '@/store/useApp'
import type { LessonProgress } from '@/store/useApp'

const completed = (): LessonProgress => ({ attempts: [], miniLessons: [], completedAt: new Date().toISOString() })

describe('مسیر و قفل‌گذاری', () => {
  it('اولین درس همیشه باز است', () => {
    expect(isLessonUnlocked({}, lessons[0].id)).toBe(true)
  })

  it('درس دوم بدون تکمیل درس اول قفل است', () => {
    expect(isLessonUnlocked({}, lessons[1].id)).toBe(false)
  })

  it('با تکمیل درس قبل، درس بعد باز می‌شود', () => {
    const progress = { [lessons[0].id]: completed() }
    expect(isLessonUnlocked(progress, lessons[1].id)).toBe(true)
    expect(isLessonUnlocked(progress, lessons[2].id)).toBe(false)
  })

  it('درس ناموجود هرگز باز نیست', () => {
    expect(isLessonUnlocked({}, 'nope')).toBe(false)
  })

  it('شاخص درس‌ها پیوسته و یکتاست', () => {
    expect(lessons.map((l) => l.index)).toEqual(lessons.map((_, i) => i))
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length)
  })
})

describe('کیفیت سرفصل', () => {
  it('شش ماژول با مجموع ۲۱ درس دارد', () => {
    expect(modules).toHaveLength(6)
    expect(lessons).toHaveLength(21)
  })

  it('هر درس محتوای واقعی، منابع رسمی و معیارهای پذیرش دارد', () => {
    for (const lesson of lessons) {
      expect(lesson.content.length, lesson.id).toBeGreaterThan(1500)
      expect(lesson.docs.length, lesson.id).toBeGreaterThanOrEqual(2)
      expect(lesson.exercise.requirements.length, lesson.id).toBeGreaterThanOrEqual(5)
      expect(lesson.exercise.tasks.length, lesson.id).toBeGreaterThanOrEqual(3)
      expect(lesson.minutes, lesson.id).toBeGreaterThan(20)
      expect(lesson.exercise.repoName, lesson.id).toMatch(/^fsa-\d\d-[a-z0-9-]+$/)
      expect(lesson.content, lesson.id).toContain('### اجرای واقعی')
      expect(lesson.content, lesson.id).toContain('## در این درس چه یاد می‌گیرید؟')
      for (const requirement of lesson.exercise.requirements) {
        expect(lesson.content, `${lesson.id}:${requirement.id}`).toContain(`\`${requirement.id}\``)
      }
    }
  })

  it('شناسه معیارها در هر درس یکتا و انگلیسی است', () => {
    for (const lesson of lessons) {
      const ids = lesson.exercise.requirements.map((r) => r.id)
      expect(new Set(ids).size, lesson.id).toBe(ids.length)
      for (const id of ids) expect(id, lesson.id).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })

  it('هر درس از یک ماژول موجود می‌آید', () => {
    const moduleIds = new Set(modules.map((m) => m.id))
    for (const lesson of lessons) expect(moduleIds.has(lesson.moduleId), lesson.id).toBe(true)
  })
})
