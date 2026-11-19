# مدیریت State: Context، Zustand و Redux

> مراجع: [Context](https://react.dev/learn/passing-data-deeply-with-context) · [Zustand](https://zustand.docs.pmnd.rs/) · [Redux Toolkit](https://redux-toolkit.js.org/) · [TanStack Query](https://tanstack.com/query/latest)

## در این درس چه یاد می‌گیرید؟

قبل از انتخاب ابزار، state را دسته‌بندی می‌کنید؛ بعد Context، useReducer، Zustand و Redux Toolkit را در جای درستشان به کار می‌برید. در پایان یک فروشگاه با تم سراسری، سبد خرید ماندگار، selector بهینه و توضیح مستند انتخاب ابزار دارید.

---

## ۱. اول دسته‌بندی، بعد ابزار

| نوع state | مثال | ابزار |
| --- | --- | --- |
| محلی UI | باز بودن مودال، متن input | `useState` |
| مشترک کم‌تغییر | تم، زبان، کاربر | **Context** |
| مشترک پرتغییر | سبد خرید، ویرایشگر | **Zustand** |
| دامنه‌ی بزرگ/تیمی | داشبورد سازمانی، لاگ اکشن | **Redux Toolkit** |
| داده‌ی سرور | لیست محصولات، پروفایل | **React Query / RTK Query** |
| state آدرس | فیلترها، صفحه | **URL / searchParams** |

بیشتر اپ‌ها با `useState` + URL + یک کتابخانه‌ی داده‌ی سرور کار می‌کنند؛ store سراسری اغلب کمتر از حد تصور لازم است.

## ۲. Context: درست و بدون افت کارایی

```tsx
type Theme = 'light' | 'dark'
interface ThemeCtx { theme: Theme; setTheme: (t: Theme) => void }

const ThemeContext = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme باید داخل ThemeProvider استفاده شود')
  return ctx
}
```

**سه دام Context:**

1. **مقدار بدون memo** → هر رندر Provider همه‌ی مصرف‌کننده‌ها را رندر می‌کند.
2. **Context پرتغییر** (مثلاً مقدار input) → کل درخت مصرف‌کننده رندر می‌شود؛ state را نزدیک مصرف‌کننده بگذارید.
3. **یک Context غول** → هر تغییر، همه را بیدار می‌کند؛ Contextها را بشکنید (`ThemeContext`، `AuthContext`، `CartActionsContext`).

الگوی تقسیم: state و actionها را جدا کنید تا کامپوننت‌هایی که فقط action می‌خواهند با تغییر state رندر نشوند.

## ۳. useReducer + Context: مقیاس‌پذیر بدون کتابخانه

```tsx
type CartState = { items: CartItem[] }
type CartAction =
  | { type: 'add'; item: CartItem }
  | { type: 'remove'; id: string }
  | { type: 'setQty'; id: string; qty: number }
  | { type: 'clear' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const existing = state.items.find((i) => i.id === action.item.id)
      return {
        items: existing
          ? state.items.map((i) => (i.id === action.item.id ? { ...i, qty: i.qty + action.item.qty } : i))
          : [...state.items, action.item]
      }
    }
    case 'remove':
      return { items: state.items.filter((i) => i.id !== action.id) }
    case 'setQty':
      return {
        items: state.items
          .map((i) => (i.id === action.id ? { ...i, qty: Math.max(0, action.qty) } : i))
          .filter((i) => i.qty > 0)
      }
    case 'clear':
      return { items: [] }
    default:
      return state
  }
}
```

reducer خالص است → تست بدون React. اگر store را با `useReducer` و دو Context (state/actions) بسازید، یک Redux کوچک خانگی دارید.

## ۴. Zustand: store سراسری مینیمال

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CartStore {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (id: string) => void
  setQty: (id: string, qty: number) => void
  clear: () => void
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        const existing = get().items.find((i) => i.id === item.id)
        set({
          items: existing
            ? get().items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + item.qty } : i))
            : [...get().items, item]
        })
      },
      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      setQty: (id, qty) =>
        set({ items: get().items.map((i) => (i.id === id ? { ...i, qty } : i)) }),
      clear: () => set({ items: [] })
    }),
    {
      name: 'cart-v1',
      version: 1,
      migrate: (persisted, version) => {
        // اگر شکل داده عوض شد، اینجا مهاجرت کنید
        return persisted as CartStore
      },
      partialize: (s) => ({ items: s.items })
    }
  )
)
```

**Selector؛ مهم‌ترین بخش Zustand:**

```tsx
// ❌ کل store؛ هر تغییری رندر می‌کند
const { items, add } = useCart()

// ✅ فقط برش لازم
const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0))
const add = useCart((s) => s.add)   // تابع پایدار است

// ✅ چند مقدار با مقایسه‌ی سطحی
import { useShallow } from 'zustand/react/shallow'
const { items, clear } = useCart(useShallow((s) => ({ items: s.items, clear: s.clear })))
```

> انتخاب آبجکت جدید بدون `useShallow` در هر رندر یک مرجع جدید می‌سازد و باعث رندر بی‌پایان می‌شود.

store بیرون از React هم قابل استفاده است: `useCart.getState().items` در یک سرویس یا تست.

## ۵. Redux Toolkit: استاندارد تیمی

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

interface CartState { items: CartItem[] }
const initialState: CartState = { items: [] }

const cartSlice = createSlice({
  name: 'cart',
  initialState,
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

export const { add, remove } = cartSlice.actions
export default cartSlice.reducer
```

RTK از Immer استفاده می‌کند؛ mutate کردن draft در reducer مجاز است و immer نسخه‌ی immutable می‌سازد.

```ts
// hooks.ts
import { useDispatch, useSelector } from 'react-redux'
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()

// selectors.ts
export const selectCount = (s: RootState) => s.cart.items.reduce((n, i) => n + i.qty, 0)
```

selectorها را بیرون کامپوننت تعریف کنید تا مرجع پایدار بمانند و با `Reselect` مشتق‌ها کش شوند.

## ۶. داده‌ی سرور را داخل store کپی نکنید

```ts
// ❌ دو منبع حقیقت: store و کش شبکه
const [products, setProducts] = useState<Product[]>([])
```

با TanStack Query:

```tsx
const { data, isPending, isError, error } = useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
  staleTime: 60_000
})
```

- کش، retry، refetch، حالت‌های loading/error و invalidate رایگان می‌شوند.
- بعد از mutation: `queryClient.invalidateQueries({ queryKey: ['products'] })`.
- store فقط برای state کلاینتی بماند (تم، سبد، draft).

## ۷. نرمال‌سازی و state مشتق

```ts
// برای لیست‌های بزرگ و به‌روزرسانی‌های پرتکرار
type State = {
  byId: Record<string, Task>
  allIds: string[]
}
```

جمع، تعداد، فیلتر و مرتب‌سازی را ذخیره نکنید؛ در selector محاسبه کنید. اگر محاسبه سنگین شد، selector memo‌شده بسازید.

## ۸. ساخت گام‌به‌گام فروشگاه (تمرین)

**گام ۱ — منبع داده:** محصولات را از API بگیرید یا از JSON محلی بخوانید؛ تایپ `Product` و اعتبارسنجی سبک.

**گام ۲ — تم با Context:** provider، hook با خطای خارج از provider، ذخیره در localStorage، اعمال `data-theme` روی `<html>`.

**گام ۳ — سبد با Zustand:** store بالا + `persist`. selectorهای `useCartCount` و `useCartTotal`.

**گام ۴ — کامپوننت‌ها:** `ProductGrid` (فقط محصولات)، `CartBadge` (فقط تعداد)، `CartDrawer` (آیتم‌ها)، `ThemeToggle` (فقط action). هر کدام دقیقاً همان برش لازم را بخوانند.

**گام ۵ — ماندگاری:** رفرش کنید؛ سبد باید بماند. `version` بگذارید تا تغییر شکل داده‌ی آینده قابل مهاجرت باشد.

**گام ۶ — حالت خالی و خطا:** سبد خالی، خطای شبکه، دکمه‌ی تلاش مجدد.

**گام ۷ — مستند تصمیم:** در README بنویسید چرا تم Context شد، سبد Zustand، و داده‌ی محصولات کش سرور.

### اجرای واقعی: store، selector و ماندگاری

```bash
npm create vite@latest fsa-08-store -- --template react-ts
cd fsa-08-store && npm i zustand && npm run dev
#   VITE v8.3.8  ready in 220 ms
#   ➜  Local:   http://localhost:5173/
```

**ایست بازرسی ۱ — تعداد رندر:** موقتاً یک `console.count('CartBadge')` در کامپوننت badge و یکی در `ProductGrid` بگذارید. با افزودن یک محصول:

- `CartBadge` باید رندر شود (تعداد عوض شده).
- اگر `ProductGrid` هم با هر تغییر سبد رندر می‌شود و محصولات تغییر نکرده‌اند، احتمالاً کل store را می‌خوانید:

```tsx
// ❌ هر تغییری رندر می‌کند
const store = useCart()

// ✅ فقط تعداد
const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0))
```

**ایست بازرسی ۲ — persist:** سبد را پر کنید و در Console:

```js
JSON.parse(localStorage.getItem('cart-v1')).state.items.length
// 2
```

بعد از `F5` مقدار باید همان بماند. اگر `null` است، `persist` را دور store نگذاشته‌اید یا `partialize` فیلد را حذف کرده است.

**ایست بازرسی ۳ — مهاجرت:** `version` را در persist `2` کنید و یک فیلد جدید اضافه کنید؛ اگر `migrate` ننویسید، داده‌ی قدیمی ممکن است شکل اشتباه داشته باشد. خروجی هشدار:

```text
State loaded from storage couldn't be migrated since no migrate function was provided
```

**ایست بازرسی ۴ — Context:** روی دکمه‌ی تم بزنید؛ در Elements باید ببینید:

```html
<html lang="fa" dir="rtl" data-theme="light">
```

اگر تغییر نکرد، `document.documentElement.dataset.theme` را در useEffect ست نکرده‌اید.

**تست selector بدون React:**

```ts
const total = useCart.getState().items.reduce((n, i) => n + i.qty, 0)
console.log(total)
```

`getState()` برای تست و کد غیر React است؛ در کامپوننت از selector استفاده کنید.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `context` | بخش ۲ |
| `store` | بخش ۴ |
| `selectors` | بخش ۴ و ۵ |
| `persist` | بخش ۴ و گام ۵ |
| `derived` | بخش ۷ و گام ۳ |

## ۹. مقایسه‌ی صادقانه

| معیار | Context | Zustand | RTK |
| --- | --- | --- | --- |
| کد اولیه | کم | خیلی کم | متوسط |
| کارایی با تغییرات مکرر | ضعیف | عالی | خوب |
| DevTools/time-travel | ❌ | محدود | ✅ |
| تست reducer | سخت‌تر | آسان | آسان |
| مناسب برای | تم/زبان/کاربر | اکثر اپ‌ها | تیم بزرگ، لاگ اکشن |

## ۱۰. عیب‌یابی

| نشانه | علت | راه‌حل |
| --- | --- | --- |
| Context همه را رندر می‌کند | value بدون memo / state پرتغییر | memo + شکستن Context |
| Zustand رندر بی‌پایان | selector آبجکت جدید می‌سازد | `useShallow` |
| سبد بعد از رفرش خالی است | persist پیکربندی نشده | middleware + `partialize` |
| store بیرون از React کار نمی‌کند | در RTK نیاز به store import دارد | `store.getState()` یا `useCart.getState()` |
| داده‌ی سرور قدیمی | کش/refetch | `staleTime`/invalidate |
| reducer همیشه state جدید می‌سازد | mutation بدون Immer | کپی صریح برگردانید |

## ۱۱. آزمایش‌ها (با پاسخ)

**۱.** چرا `useContext` برای مقدار input مناسب نیست؟

**پاسخ:** هر کاراکتر، Provider را دوباره رندر می‌کند و همه‌ی مصرف‌کننده‌ها را؛ input را محلی نگه دارید.

**۲.** چه تفاوتی بین `useCart()` و `useCart(useShallow(...))`؟

**پاسخ:** اولی کل store (یا آبجکت جدید در هر رندر) را برمی‌گرداند، دومی مقایسه‌ی سطحی می‌کند.

**۳.** چرا state مشتق را ذخیره نمی‌کنیم؟

**پاسخ:** ممکن است با منبع اصلی ناهماهنگ شود؛ محاسبه در رندر/selector همیشه درست است.

**۴.** چه زمانی Redux را انتخاب می‌کنید؟

**پاسخ:** دامنه‌ی بزرگ با چند تیم، نیاز به زمان‌سفر/لاگ، یا سیاست سازمانی — نه صرفاً «چون معروف است».

## ۱۲. خودآزمایی

1. پنج دسته state و ابزار هر کدام؟
2. دو راه جلوگیری از رندر اضافی در Context؟
3. selector در Zustand چه کاری می‌کند؟
4. `persist` چطور نسخه‌بندی می‌شود؟
5. Immer چه چیزی را ممکن می‌کند؟
6. چرا داده‌ی سرور در store کپی نمی‌شود؟

## ۱۳. چک‌لیست تحویل

- [ ] Context با Provider و hook دارای خطا
- [ ] store سبد با selector
- [ ] ماندگاری سبد پس از رفرش
- [ ] جمع/تعداد مشتق‌شده
- [ ] حالت خالی/خطا
- [ ] README با دلیل انتخاب ابزار
- [ ] بدون رندر اضافی محسوس
