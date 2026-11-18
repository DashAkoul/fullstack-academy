# مدیریت State: Context، Zustand و Redux

> مراجع: [Context](https://react.dev/learn/passing-data-deeply-with-context) · [Zustand](https://zustand.docs.pmnd.rs/) · [Redux Toolkit](https://redux-toolkit.js.org/)

## ۱. مسئله: prop drilling

```
App → Layout → Sidebar → UserMenu → Avatar (نیاز به user)
```

وقتی داده از چند لایه عبور می‌کند فقط برای رسیدن به پایین، props را «کوله‌پشتی» کرده‌اید. سه راه‌حل داریم و **انتخاب درست به نوع state بستگی دارد**.

| نوع state | مثال | ابزار پیشنهادی |
| --- | --- | --- |
| محلی | باز/بسته بودن مودال | `useState` |
| مشترک کم‌تغییر | تم، زبان، کاربر فعلی | **Context** |
| مشترک پرتغییر و پیچیده | سبد خرید، ویرایشگر | **Zustand** |
| دامنه‌ی بزرگ با تیم بزرگ | داشبورد سازمانی | **Redux Toolkit** |

## ۲. Context API

```tsx
type Theme = 'light' | 'dark'
type ThemeCtx = { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }

const ThemeContext = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const value = useMemo(
    () => ({ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), setTheme }),
    [theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme باید داخل ThemeProvider استفاده شود')
  return ctx
}
```

نکات مهم:

- **مقدار context را memo کنید**، وگرنه هر رندر Provider همه‌ی مصرف‌کننده‌ها را رندر می‌کند.
- در Custom Hook خطای «خارج از Provider» را صریح پرتاب کنید.
- Context را برای داده‌ی پرتغییر (مثل تایپ هر کلید در یک input) استفاده نکنید.

## ۳. useReducer — وقتی منطق پیچیده است

```tsx
type Action =
  | { type: 'add'; item: CartItem }
  | { type: 'remove'; id: string }
  | { type: 'setQty'; id: string; qty: number }
  | { type: 'clear' }

function reducer(state: CartItem[], action: Action): CartItem[] {
  switch (action.type) {
    case 'add': {
      const existing = state.find((i) => i.id === action.item.id)
      return existing
        ? state.map((i) => (i.id === action.item.id ? { ...i, qty: i.qty + action.item.qty } : i))
        : [...state, action.item]
    }
    case 'remove': return state.filter((i) => i.id !== action.id)
    case 'setQty': return state.map((i) => (i.id === action.id ? { ...i, qty: Math.max(0, action.qty) } : i))
    case 'clear': return []
    default: return state
  }
}
```

`useReducer` + Context الگوی قدرتمندی است: منطق تست‌پذیر (reducer یک تابع خالص است) و توزیع ساده.

## ۴. Zustand — ساده و سریع

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type CartItem = { id: string; title: string; price: number; qty: number }

interface CartState {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (id: string) => void
  setQty: (id: string, qty: number) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((s) => {
          const found = s.items.find((i) => i.id === item.id)
          return {
            items: found
              ? s.items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + item.qty } : i))
              : [...s.items, item]
          }
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      setQty: (id, qty) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, qty } : i)) })),
      clear: () => set({ items: [] })
    }),
    { name: 'cart', version: 1 }
  )
)
```

استفاده با **selector** (بسیار مهم برای کارایی):

```tsx
const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0))
const add = useCart((s) => s.add)   // توابع پایدارند، رندر اضافه نمی‌دهند
```

```tsx
// ❌ کل store را می‌خواند → هر تغییری رندر می‌کند
const { items, add } = useCart()

// ✅ فقط همان برش
const items = useCart((s) => s.items)
```

برای انتخاب آبجکت مشتق‌شده از `useShallow` استفاده کنید تا مقایسه‌ی سطحی انجام شود:

```ts
import { useShallow } from 'zustand/react/shallow'
const { a, b } = useStore(useShallow((s) => ({ a: s.a, b: s.b })))
```

## ۵. Redux Toolkit — استاندارد سازمانی

```ts
// store.ts
import { configureStore } from '@reduxjs/toolkit'
import cartReducer from './cartSlice'

export const store = configureStore({ reducer: { cart: cartReducer } })
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

```ts
// cartSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

const slice = createSlice({
  name: 'cart',
  initialState: { items: [] as CartItem[] },
  reducers: {
    add: (state, action: PayloadAction<CartItem>) => {
      const found = state.items.find((i) => i.id === action.payload.id)
      if (found) found.qty += action.payload.qty
      else state.items.push(action.payload)
    },
    remove: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.id !== action.payload)
    }
  }
})

export const { add, remove } = slice.actions
export default slice.reducer
```

RTK از **Immer** استفاده می‌کند: mutate کردن `state` در reducer مجاز است و به‌روزرسانی immutable تولید می‌شود.

```ts
// hooks.ts
import { useDispatch, useSelector } from 'react-redux'
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
```

با RTK Query برای داده‌ی سرور، کش و وضعیت درخواست را هم می‌گیرید:

```ts
export const productsApi = createApi({
  reducerPath: 'productsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (b) => ({
    products: b.query<Product[], void>({ query: () => '/products' })
  })
})
```

## ۶. مقایسه‌ی صادقانه

| معیار | Context | Zustand | Redux Toolkit |
| --- | --- | --- | --- |
| حجم کد اولیه | کم | خیلی کم | متوسط |
| کارایی با state پرتغییر | ضعیف | عالی | خوب |
| DevTools و time-travel | ندارد | محدود | عالی |
| تست reducer | سخت‌تر | آسان | آسان |
| مناسبِ | تم/زبان | اکثر اپ‌ها | تیم بزرگ، لاگ اکشن |

## ۷. قواعد ضد بوی بد

- Store را «زباله‌دان» نکنید؛ فقط state واقعاً مشترک.
- داده‌ی سرور را در store دستی کپی نکنید؛ از کش ابزار (React Query/RTK Query) استفاده کنید.
- state مشتق (جمع کل، تعداد) را ذخیره نکنید — محاسبه کنید.
- برای هر store یک فایل و یک مرز دامنه.

## تمرین این درس

فروشگاه کوچک: محصولات از API، تم تیره/روشن با Context، سبد خرید با Zustand + persist و selector، و توضیح انتخاب ابزار در README. جزئیات در تب تمرین است.
