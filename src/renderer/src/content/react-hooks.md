# React و Hooks

> مرجع رسمی: [react.dev — Learn](https://react.dev/learn) و [Built-in Hooks](https://react.dev/reference/react/hooks)

React یک کتابخانه‌ی UI است که بر پایه‌ی سه ایده بنا شده: **کامپوننت**، **state** و **رندر یک‌طرفه (declarative)**. شما می‌گویید UI در هر حالت «چه شکلی» است؛ React DOM را هماهنگ می‌کند.

## ۱. کامپوننت و props

```tsx
type BadgeProps = { label: string; tone?: 'neutral' | 'success' | 'danger' }

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const tones = {
    neutral: 'bg-slate-700 text-slate-100',
    success: 'bg-emerald-600 text-white',
    danger: 'bg-rose-600 text-white'
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs ${tones[tone]}`}>{label}</span>
}
```

قواعد:

- نام کامپوننت با حرف بزرگ.
- props را تایپ کنید؛ مقادیر پیش‌فرض با destructuring.
- کامپوننت را خالص نگه دارید: ورودی یکسان → خروجی یکسان.
- `children` را وقتی لازم است explicit تایپ کنید: `{ children }: { children: ReactNode }`.

## ۲. useState

```tsx
const [count, setCount] = useState(0)
const [user, setUser] = useState<User | null>(null)
const [items, setItems] = useState<Item[]>(() => loadFromStorage()) // lazy init
```

به‌روزرسانی مبتنی بر مقدار قبلی:

```tsx
setCount((c) => c + 1)          // ✅ امن در به‌روزرسانی‌های پشت‌سرهم
setCount(count + 1)             // ⚠️ ممکن است مقدار کهنه ببیند
```

State را **کم** نگه دارید. اگر می‌توانید از props یا حالت موجود محاسبه کنید، در state نگه ندارید:

```tsx
// ❌ دو منبع حقیقت
const [items, setItems] = useState<Item[]>([])
const [total, setTotal] = useState(0)

// ✅ مشتق شده
const total = items.reduce((s, i) => s + i.price * i.qty, 0)
```

## ۳. رندر لیست و `key`

```tsx
<ul>
  {items.map((item) => (
    <li key={item.id}>{item.title}</li>
  ))}
</ul>
```

`key` هویت آیتم را به React می‌گوید. استفاده از index باعث باگ‌های ظریف در مرتب‌سازی/حذف می‌شود. اگر داده‌ی شما `id` ندارد، ساخت id در زمان ساخت داده بهتر از index است.

## ۴. useEffect — و چرا اغلب لازم نیست

`useEffect` برای **همگام‌سازی با دنیای بیرون** است: شبکه، تایمر، اشتراک (subscription)، DOM خارجی.

```tsx
useEffect(() => {
  const controller = new AbortController()

  async function load() {
    try {
      const res = await fetch(`/api/users/${id}`, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setUser(await res.json())
    } catch (e) {
      if (!controller.signal.aborted) setError(String(e))
    }
  }

  load()
  return () => controller.abort()   // پاک‌سازی
}, [id])
```

اشتباهات رایج:

| اشتباه | مشکل | درست |
| --- | --- | --- |
| `[]` خالی با متغیر بیرونی | داده‌ی کهنه | همه‌ی وابستگی‌ها را بنویسید |
| fetch بدون abort | race condition | `AbortController` |
| effect برای محاسبه‌ی مقدار | رندر اضافه و پیچیدگی | محاسبه در بدنه‌ی رندر |
| تنظیم state از props | دو منبع حقیقت | key یا محاسبه |

طبق مستندات React: **«You Might Not Need an Effect»** — قبل از نوشتن effect، بپرسید آیا این می‌تواند در event handler یا در حین رندر حل شود.

## ۵. useRef

دو کاربرد:

```tsx
// 1) دسترسی به DOM
const inputRef = useRef<HTMLInputElement>(null)
useEffect(() => inputRef.current?.focus(), [])

// 2) نگه‌داری مقدار بدون رندر
const renderCount = useRef(0)
renderCount.current++
```

## ۶. useMemo و useCallback

```tsx
const visible = useMemo(
  () => tasks.filter((t) => t.title.includes(query)),
  [tasks, query]
)

const onToggle = useCallback((id: string) => setTasks((ts) => ts.map(...)), [])
```

قاعده: **اول اندازه بگیرید، بعد بهینه کنید.** `useMemo` برای محاسبات سنگین یا وابستگی هویتی در `useEffect` مفید است؛ برای `a + b` فقط نویز است.

## ۷. Custom Hook — بازاستفاده‌ی منطق

```ts
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      console.warn('ذخیره‌سازی ناموفق', e)
    }
  }, [key, value])

  return [value, setValue] as const
}
```

```tsx
const [tasks, setTasks] = useLocalStorage<Task[]>('kanban.tasks', [])
```

هر Hook باید با `use` شروع شود؛ این قاعده‌ی linter است، نه سلیقه.

## ۸. فرم‌های کنترل‌شده

```tsx
const [title, setTitle] = useState('')

function submit(e: React.FormEvent) {
  e.preventDefault()
  const trimmed = title.trim()
  if (!trimmed) return
  addTask(trimmed)
  setTitle('')
}

<form onSubmit={submit}>
  <label htmlFor="title">عنوان وظیفه</label>
  <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
  <button disabled={!title.trim()}>افزودن</button>
</form>
```

## ۹. الگوی وضعیت درخواست

```ts
type Async<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T }
```

با discriminated union، رندر بر اساس `status` ساده و exhaustive می‌شود و ترکیب‌های ناممکن (loading + error) حذف می‌شوند.

## ۱۰. ساختار پیشنهادی پروژه

```
src/
├─ components/      ← کامپوننت‌های عمومی (Button، Modal)
├─ features/kanban/ ← منطق دامنه + کامپوننت‌های همان قابلیت
├─ hooks/           ← Custom Hookهای مشترک
├─ lib/             ← api، utils
└─ App.tsx
```

مرزبندی بر اساس «قابلیت» بهتر از «نوع فایل» مقیاس می‌گیرد.

## چک‌لیست کیفیت

- [ ] هیچ state تکراری/مشتق‌شده‌ای وجود ندارد
- [ ] `key` پایدار است
- [ ] effectها پاک‌سازی دارند
- [ ] درخواست‌ها abort می‌شوند
- [ ] linter (eslint-plugin-react-hooks) بی‌اخطار است
- [ ] کامپوننت‌ها کوچک و تک‌مسئولیت‌اند

## تمرین این درس

برد کانبان با React + TypeScript: کامپوننت‌های Board/Column/TaskCard، CRUD و جابه‌جایی وظایف، `useLocalStorage`، جستجو با `useMemo` و فوکوس با `useRef`. جزئیات در تب تمرین است.
