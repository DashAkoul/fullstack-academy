# React و Hooks

> مرجع رسمی: [react.dev — Learn](https://react.dev/learn) · [Hooks Reference](https://react.dev/reference/react/hooks) · [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

## در این درس چه یاد می‌گیرید؟

این درس مدل رندر React را توضیح می‌دهد تا بدانید state کجا باید زندگی کند، چرا effectها منبع باگ‌اند، چطور درخواست‌ها را لغو کنید و چطور یک Custom Hook قابل تست بنویسید. در پایان، برد کانبان تمرین را با reducer، ذخیره‌سازی محلی، جستجوی بهینه و فرم کنترل‌شده می‌سازید.

---

## ۱. مدل رندر: UI = f(state)

```tsx
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

با هر `setState`:

1. React کامپوننت را دوباره **فراخوانی** می‌کند (render).
2. خروجی جدید (درخت element) با قبلی مقایسه می‌شود (reconciliation).
3. فقط تفاوت‌ها روی DOM اعمال می‌شود (commit).

نتیجه‌ها:

- رندر باید **خالص** باشد: محاسبه‌ی DOM، fetch، `localStorage.setItem` در بدنه‌ی کامپوننت ممنوع.
- StrictMode در توسعه کامپوننت را دو بار رندر می‌کند تا ناخالصی را لو بدهد؛ دوبار رندر شدن طبیعی است.
- state در هر رندر یک **snapshot** است:

```tsx
function handle() {
  setCount(count + 1)
  setCount(count + 1)   // هر دو از همان count فعلی → +1 نه +2
  setCount((c) => c + 1) // ✅ updater
  setCount((c) => c + 1) // ✅ +2
}
```

## ۲. State: قواعدی که باگ‌ها را حذف می‌کند

```tsx
const [items, setItems] = useState<Item[]>([])
const [user, setUser] = useState<User | null>(null)
const [draft, setDraft] = useState(() => localStorage.getItem('draft') ?? '') // lazy init
```

1. **state را کم نگه دارید**: هر چیزی از props یا state دیگر قابل محاسبه است، state نباشد (جمع، تعداد، فیلترشده).
2. **state را immutable به‌روز کنید**: `setItems([...items, item])`، نه `items.push(item)`.
3. state مرتبط را در یک آبجکت/وضعیت واحد نگه دارید تا همیشه هم‌زمان تغییر کنند.
4. state را در پایین‌ترین کامپوننت مشترک قرار دهید (colocation).

```tsx
// ❌ سه منبع حقیقت که ممکن است ناهماهنگ شوند
const [items, setItems] = useState<Item[]>([])
const [count, setCount] = useState(0)
const [total, setTotal] = useState(0)

// ✅ مشتق‌شده در رندر
const count = items.length
const total = items.reduce((s, i) => s + i.price * i.qty, 0)
```

## ۳. لیست‌ها و `key`: هویت، نه ترتیب

```tsx
<ul>
  {tasks.map((task) => (
    <li key={task.id}><TaskRow task={task} /></li>
  ))}
</ul>
```

React با `key` می‌فهمد کدام آیتم «همان» است. با `index`، بعد از حذف/مرتب‌سازی، state کامپوننت‌های داخلی (مثل متن ویرایش‌نشده یا فوکوس) جابه‌جا می‌شود. اگر داده `id` ندارد، هنگام ساخت داده `crypto.randomUUID()` بدهید.

## ۴. useEffect: آخرین ابزار، نه اولی

effect برای **همگام‌سازی با بیرون React** است: شبکه، تایمر، اشتراک، DOM غیر React.

```tsx
useEffect(() => {
  const controller = new AbortController()

  async function load() {
    try {
      const res = await fetch(`/api/users/${id}`, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setUser(await res.json())
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'خطای نامشخص')
    }
  }

  load()
  return () => controller.abort()
}, [id])
```

- **آرایه‌ی وابستگی** باید همه‌ی مقادیر بیرونی خوانده‌شده را داشته باشد؛ linter را جدی بگیرید.
- **cleanup** برای تایمر، listener و درخواست ضروری است.
- با `id` جدید، effect قبلی cleanup می‌شود و درخواست قبلی لغو می‌شود (جلوگیری از race).

**وقتی Effect لازم نیست:**

| نیاز | راه درست |
| --- | --- |
| محاسبه‌ی مقدار از props/state | محاسبه در رندر (+ `useMemo` اگر سنگین است) |
| واکنش به کلیک | کد در event handler |
| همگام‌سازی state با prop | `key` روی کامپوننت یا محاسبه |
| fetch اولیه در Next.js | Server Component |

## ۵. useRef: DOM و مقدار بدون رندر

```tsx
const inputRef = useRef<HTMLInputElement>(null)
const renders = useRef(0)
renders.current += 1

useEffect(() => inputRef.current?.focus(), [])
```

تغییر `ref.current` رندری ایجاد نمی‌کند؛ برای داده‌ای است که UI به آن وابسته نیست یا برای نگه‌داشتن مقدار بین رندرها (تایمر، آخرین مقدار).

## ۶. useReducer: وقتی تغییرات پیچیده‌اند

```tsx
type Task = { id: string; title: string; done: boolean }
type Action =
  | { type: 'add'; title: string }
  | { type: 'toggle'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'rename'; id: string; title: string }

function tasksReducer(state: Task[], action: Action): Task[] {
  switch (action.type) {
    case 'add':
      return [...state, { id: crypto.randomUUID(), title: action.title, done: false }]
    case 'toggle':
      return state.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t))
    case 'remove':
      return state.filter((t) => t.id !== action.id)
    case 'rename':
      return state.map((t) => (t.id === action.id ? { ...t, title: action.title } : t))
    default:
      return state
  }
}
```

مزیت: reducer یک تابع خالص است؛ بدون React تست می‌شود و همه‌ی گذارهای مجاز در یک جا هستند.

## ۷. Custom Hooks: منطق قابل استفاده‌ی مجدد

```tsx
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
    } catch (err) {
      console.warn('ذخیره‌سازی ناموفق', err)
    }
  }, [key, value])

  return [value, setValue] as const
}
```

```tsx
const [tasks, setTasks] = useLocalStorage<Task[]>('kanban.tasks', [])
```

```tsx
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
```

قواعد Hook: فقط در سطح بالای کامپوننت/Hook، نه داخل شرط/حلقه. نام با `use` شروع شود.

## ۸. فرم‌ها: کنترل‌شده و معتبر

```tsx
const [title, setTitle] = useState('')
const [error, setError] = useState<string | null>(null)

function submit(e: React.FormEvent) {
  e.preventDefault()
  const value = title.trim()
  if (value.length < 3) {
    setError('عنوان باید حداقل ۳ کاراکتر باشد.')
    return
  }
  addTask(value)
  setTitle('')
  setError(null)
}

<form onSubmit={submit} noValidate>
  <label htmlFor="title">عنوان وظیفه</label>
  <input
    id="title"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
    aria-invalid={Boolean(error)}
    aria-describedby={error ? 'title-error' : undefined}
  />
  {error && <p id="title-error" role="alert">{error}</p>}
  <button disabled={!title.trim()}>افزودن</button>
</form>
```

## ۹. بهینه‌سازی: اندازه بگیرید، حدس نزنید

```tsx
const visible = useMemo(
  () => tasks.filter((t) => t.title.includes(query)),
  [tasks, query]
)

const onToggle = useCallback((id: string) => dispatch({ type: 'toggle', id }), [])
```

- `React.memo` فقط وقتی مفید است که propها پایدار بمانند.
- `useMemo` برای محاسبه‌ی سنگین یا پایداری هویت در dependency.
- با React DevTools → Profiler ببینید کدام کامپوننت و چرا رندر می‌شود.
- در React 19 کامپایلر می‌تواند بخشی از این‌ها را خودکار کند؛ همچنان مدل ذهنی لازم است.

## ۱۰. ساخت گام‌به‌گام برد کانبان (تمرین)

**گام ۱ — تایپ‌ها**

```ts
type Status = 'todo' | 'doing' | 'done'
interface Task { id: string; title: string; status: Status; createdAt: number }
const COLUMNS: { id: Status; title: string }[] = [
  { id: 'todo', title: 'برای انجام' },
  { id: 'doing', title: 'در حال انجام' },
  { id: 'done', title: 'انجام‌شده' }
]
```

**گام ۲ — reducer** با actionهای add/rename/remove/move و state پایه از `useLocalStorage`.

**گام ۳ — کامپوننت‌ها:** `Board` (state و dispatch)، `Column` (فیلتر بر اساس status)، `TaskCard` (نمایش + دکمه‌ها)، `TaskForm`. key = `task.id`.

**گام ۴ — جابه‌جایی:** دکمه‌های «بعدی/قبلی» یا drag-and-drop ساده با HTML5؛ منطق move در reducer.

**گام ۵ — جستجو:** `useDebounced(query)` + `useMemo` برای فیلتر.

**گام ۶ — فوکوس:** `useRef` روی input و فوکوس بعد از افزودن.

**گام ۷ — دسترس‌پذیری:** دکمه‌ی آیکونی با `aria-label`، پیام خالی هر ستون، `role="status"` برای شمارش.

**گام ۸ — تست:** reducer را با Vitest تست کنید؛ حرکت بین ستون‌ها و حذف.

### اجرای واقعی: از رندر تا تست

```bash
npm create vite@latest fsa-07-kanban -- --template react-ts
cd fsa-07-kanban && npm install
npm run dev
#   VITE v8.3.8  ready in 250 ms
#   ➜  Local:   http://localhost:5173/
```

**ایست بازرسی ۱ — snapshot state:** این کامپوننت را موقتاً اضافه کنید:

```tsx
function Demo() {
  const [n, setN] = useState(0)
  function wrong() {
    setN(n + 1)
    setN(n + 1)
  }
  function right() {
    setN((v) => v + 1)
    setN((v) => v + 1)
  }
  return (
    <div>
      <p data-testid="n">{n}</p>
      <button onClick={wrong}>wrong</button>
      <button onClick={right}>right</button>
    </div>
  )
}
```

با یک کلیک روی `wrong` عدد **۱** و با `right` عدد **۲** زیاد می‌شود. اگر چنین نیست، نسخه‌ی React را بررسی کنید (این رفتار از React 18 پایدار است).

**ایست بازرسی ۲ — cleanup:** در `useEffect` یک `console.log('mount')` و در cleanup `console.log('cleanup')` بگذارید. با تغییر `id` در Console باید ببینید:

```text
cleanup
mount
```

اگر فقط `mount` می‌بینید، تابع cleanup را برنگردانده‌اید.

**تست reducer با Vitest:**

```bash
npm i -D vitest
npx vitest run
#  ✓ src/tasks.test.ts (4 tests) 12ms
#
#  Test Files  1 passed (1)
#       Tests  4 passed (4)
#    Start at  ...
```

اگر تست با `expected [...] to equal [...]` شکست خورد، معمولاً state قبلی را mutate کرده‌اید:

```ts
// ❌
state[0].done = true
return state

// ✅
return state.map((t) => (t.id === id ? { ...t, done: true } : t))
```

**ایست بازرسی ۳ — رفرش:** یک وظیفه اضافه کنید، `F5` بزنید؛ باید بماند (localStorage → Application → Local Storage → `kanban.tasks`). اگر خالی شد، `useLocalStorage` را در دو جای مختلف با کلید متفاوت استفاده کرده‌اید یا JSON.parse خطا داده و fallback برگشته است.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `components` | بخش ۳ و گام ۳ |
| `state` | بخش ۲ و ۴ |
| `custom-hook` | بخش ۷ |
| `effects` | بخش ۴ |
| `memo-ref` | بخش ۵ و ۹ |

## ۱۱. عیب‌یابی

| نشانه | علت رایج | راه‌حل |
| --- | --- | --- |
| state فوراً مقدار جدید را نشان نمی‌دهد | snapshot رندر | از updater یا محاسبه در رندر استفاده کنید |
| حلقه‌ی بی‌پایان رندر | setState در بدنه یا effect بدون وابستگی درست | وابستگی‌ها را بررسی کنید |
| داده‌ی قدیمی نمایش داده می‌شود | نبود abort/cleanup | AbortController + بررسی aborted |
| input با هر تایپ کاراکتر از فوکوس می‌افتد | تعریف کامپوننت داخل کامپوننت | کامپوننت را بیرون ببرید |
| state بعد از رفرش می‌رود | ذخیره‌سازی نبوده | useLocalStorage |
| `Each child should have a unique key` | key تکراری/ندارد | id پایدار |

## ۱۲. آزمایش‌ها (با پاسخ)

**۱.** چرا این کد فقط یک بار افزایش می‌دهد؟

```tsx
setCount(count + 1)
setCount(count + 1)
```

**پاسخ:** هر دو از همان snapshot `count` محاسبه شده‌اند؛ batching آخرین مقدار را اعمال می‌کند. `setCount(c => c + 1)` دوبار.

**۲.** چرا `useEffect(() => setUser({...user, name}), [user])` حلقه می‌سازد؟

**پاسخ:** effect state را تغییر می‌دهد که خودش dependency است → رندر → effect → … . راه: محاسبه در رندر یا key.

**۳.** چه زمانی `useMemo` واقعاً لازم است؟

**پاسخ:** محاسبه‌ی سنگین با ورودی پایدار، یا نیاز به هویت پایدار برای dependency/کامپوننت memo‌شده.

**۴.** تفاوت `useRef` و `useState` برای تایمر؟

**پاسخ:** ref رندر ایجاد نمی‌کند و مقدار بین رندرها حفظ می‌شود؛ state برای وقتی است که UI باید با تغییر به‌روز شود.

## ۱۳. خودآزمایی

1. چرا رندر باید خالص باشد؟
2. تفاوت state مشتق و state ذخیره‌شده؟
3. سه مورد که Effect لازم نیست؟
4. cleanup چه زمانی اجرا می‌شود؟
5. چرا `key` نباید index باشد؟
6. چه وقت useReducer بهتر از useState است؟

## ۱۴. چک‌لیست تحویل

- [ ] state تکراری/مشتق‌شده ذخیره نمی‌شود
- [ ] key پایدار در همه‌ی لیست‌ها
- [ ] effectها cleanup و abort دارند
- [ ] Custom Hook با تایپ Generic
- [ ] فرم کنترل‌شده با پیام خطای متصل به input
- [ ] useMemo/useRef بجا
- [ ] reducer با تست
- [ ] بدون خطای eslint-plugin-react-hooks
- [ ] تست دستی: افزودن/ویرایش/جابه‌جایی/رفرش
