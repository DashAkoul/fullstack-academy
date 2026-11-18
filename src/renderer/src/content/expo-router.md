# مسیریابی با Expo Router

> مرجع رسمی: [Expo Router Docs](https://docs.expo.dev/router/introduction/) · [Layouts](https://docs.expo.dev/router/basics/layout/) · [Linking](https://docs.expo.dev/linking/overview/)

## در این درس چه یاد می‌گیرید؟

مسیریابی فایل‌محور را مثل Next.js در موبایل پیاده می‌کنید: Stack، Tabs، گروه‌ها، مسیرهای پویا، مودال، Deep Link و محافظت از مسیر. در پایان، اپ منوی رستوران تمرین را با تب‌ها و صفحه‌ی جزئیات غذا می‌سازید.

---

## ۱. هر فایل یک مسیر است

```
app/
├─ _layout.tsx              ← Stack ریشه
├─ (tabs)/
│  ├─ _layout.tsx           ← Tabs
│  ├─ index.tsx             ← /
│  ├─ orders.tsx            ← /orders
│  └─ profile.tsx           ← /profile
├─ menu/
│  └─ [id].tsx              ← /menu/:id
├─ login.tsx                ← /login
└─ +not-found.tsx
```

| فایل | معنا |
| --- | --- |
| `index.tsx` | مسیر ریشه‌ی همان پوشه |
| `[id].tsx` | پارامتر پویا |
| `(tabs)` | گروه بدون اثر در URL، با layout مشترک |
| `_layout.tsx` | قالب مشترک و ناوبری والد |
| `+not-found.tsx` | مسیر نامعتبر |
| `+html.tsx` | فقط وب |

## ۲. Stack ریشه

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0b0f17' },
          headerTintColor: '#f9fafb',
          contentStyle: { backgroundColor: '#0b0f17' }
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="menu/[id]" options={{ title: 'جزئیات غذا' }} />
        <Stack.Screen name="login" options={{ presentation: 'modal', title: 'ورود' }} />
      </Stack>
    </SafeAreaProvider>
  )
}
```

`Stack.Screen` فقط تنظیمات مسیر را تعریف می‌کند؛ فایل باید وجود داشته باشد.

## ۳. Tabs

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#818cf8',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: { backgroundColor: '#111827' }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'منو',
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'سفارش‌ها',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'پروفایل',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />
        }}
      />
    </Tabs>
  )
}
```

برای پنهان کردن یک مسیر از تب‌ها بدون حذف فایل: `options={{ href: null }}`.

## ۴. مسیر پویا و پارامتر

```tsx
// app/menu/[id].tsx
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { getMenuItem, type MenuItem } from '@/lib/menu'

export default function MenuItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [item, setItem] = useState<MenuItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getMenuItem(id)
      .then((data) => alive && setItem(data))
      .catch(() => alive && setItem(null))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id])

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />

  if (!item) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Stack.Screen options={{ title: 'یافت نشد' }} />
        <Text>این غذا در منو موجود نیست.</Text>
        <Pressable onPress={() => router.back()}><Text>بازگشت</Text></Pressable>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 8 }}>
      <Stack.Screen options={{ title: item.name }} />
      <Text style={{ fontSize: 22, fontWeight: '700' }}>{item.name}</Text>
      <Text>{item.description}</Text>
      <Text>{item.price.toLocaleString('fa-IR')} تومان</Text>
    </View>
  )
}
```

`useLocalSearchParams` مقدار را به‌صورت **رشته** می‌دهد؛ برای عدد خودتان تبدیل و اعتبارسنجی کنید.

## ۵. ناوبری: Link و router

```tsx
import { Link, router } from 'expo-router'

<Link href="/menu/12" asChild>
  <Pressable accessibilityRole="link">
    <Text>مشاهده پیتزا</Text>
  </Pressable>
</Link>

router.push('/menu/12')
router.replace('/orders')          // بدون امکان بازگشت
router.back()
router.dismissAll()
router.push({ pathname: '/menu/[id]', params: { id: '12' } })
```

- `asChild` استایل و دسترس‌پذیری `Pressable` شما را حفظ می‌کند.
- `replace` برای بعد از ورود/خروج (login) مناسب است تا بازگشت به صفحه‌ی قبلی منطقی نباشد.

## ۶. Deep Linking

```json
{
  "expo": {
    "scheme": "menufast",
    "ios": { "bundleIdentifier": "com.acme.menufast" },
    "android": { "package": "com.acme.menufast" }
  }
}
```

```bash
npx uri-scheme open menufast://menu/12 --ios
npx uri-scheme open menufast://menu/12 --android
```

اگر `scheme` تنظیم باشد، Expo Router خودکار مسیر `menu/[id]` را با پارامتر درست باز می‌کند. برای Universal Links دامنه و فایل‌های `apple-app-site-association` / `assetlinks.json` هم لازم است.

## ۷. محافظت از مسیر و Redirect

```tsx
// app/(app)/_layout.tsx
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/store/auth'

export default function AppLayout() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Redirect href="/login" />
  return <Stack />
}
```

الگوی بهتر: دو گروه `(auth)` و `(app)`؛ layout گروه `(app)` کاربر را بررسی می‌کند. این کار باعث می‌شود صفحه‌ی login اصلاً در پشته‌ی محافظت‌شده نباشد.

## ۸. مودال و صفحه‌های ویژه

```tsx
<Stack.Screen name="login" options={{ presentation: 'modal' }} />
<Stack.Screen name="filters" options={{ presentation: 'transparentModal', animation: 'fade' }} />
```

برای مودالی که باید روی همه چیز بیاید، مودال را بیرون از Tabs در Stack ریشه تعریف کنید.

## ۹. ساخت گام‌به‌گام منوی رستوران (تمرین)

**گام ۱ — ساختار**

```
app/
├─ _layout.tsx
├─ (tabs)/
│  ├─ _layout.tsx
│  ├─ index.tsx      ← لیست منو
│  ├─ orders.tsx
│  └─ profile.tsx
├─ menu/[id].tsx
└─ +not-found.tsx
```

**گام ۲ — داده:** `lib/menu.ts` با آرایه‌ی غذاها و `getMenuItem(id)`.

**گام ۳ — تب‌ها:** سه تب با آیکون و رنگ فعال؛ `headerShown: false` و هدر مخصوص هر تب.

**گام ۴ — لیست:** FlatList از غذاها؛ هر آیتم یک `Link asChild` به `/menu/${item.id}`.

**گام ۵ — جزئیات:** پارامتر، loading، حالت «پیدا نشد» و `Stack.Screen` برای عنوان پویا.

**گام ۶ — سفارش:** دکمه‌ی افزودن به سبد (Zustand) در صفحه‌ی جزئیات؛ تب orders از store بخواند.

**گام ۷ — Deep Link:** `scheme` را تنظیم و با `uri-scheme` تست کنید.

**گام ۸ — not-found:** لینک بازگشت به منو.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `tabs` | بخش ۳ |
| `dynamic` | بخش ۴ |
| `navigation` | بخش ۵ |
| `scheme` | بخش ۶ |
| `not-found` | بخش ۴ و ۸ |

## ۱۰. عیب‌یابی

| پیام | علت | راه‌حل |
| --- | --- | --- |
| `No route named "x"` | نام فایل با `Stack.Screen` یکی نیست | نام‌ها را هم‌راستا کنید |
| تب اضافی ظاهر شد | هر فایل در `(tabs)` یک تب است | `href: null` |
| پارامتر `undefined` | نام پارامتر ناهماهنگ | `[id]` ↔ `{ id }` |
| Deep link باز نمی‌شود | scheme تنظیم/بیلد نشده | app.json + rebuild |
| بازگشت به صفحه‌ی login | push به‌جای replace بعد از ورود | `router.replace('/(app)')` |
| مسیر محافظت‌شده پرش می‌کند | بررسی auth در layout دیر اجرا می‌شود | صفحه‌ی loading تا مشخص شدن وضعیت |

## ۱۱. آزمایش‌ها (با پاسخ)

**۱.** تفاوت `(tabs)` و `tabs` در نام پوشه؟

**پاسخ:** پرانتز یعنی گروه مسیر و در URL ظاهر نمی‌شود؛ بدون پرانتز، بخشی از مسیر می‌شود.

**۲.** چرا بعد از login از `router.replace` استفاده می‌کنیم؟

**پاسخ:** تا کاربر با دکمه‌ی back به صفحه‌ی login برنگردد.

**۳.** چگونه مسیری را از تب‌ها پنهان کنیم ولی آدرس‌پذیر بماند؟

**پاسخ:** `options={{ href: null }}`.

**۴.** پارامتر عددی `id` را چطور امن کنیم؟

**پاسخ:** `const n = Number(id); if (!Number.isInteger(n) || n <= 0) return <Redirect ... />`.

## ۱۲. خودآزمایی

1. `_layout.tsx` چه کاری می‌کند؟
2. مسیر پویا چگونه تعریف می‌شود؟
3. Link و router چه تفاوتی دارند؟
4. مودال را کجا تعریف می‌کنیم؟
5. محافظت از مسیر با چه الگویی بهتر است؟
6. Deep Link برای تست به چه چیزی نیاز دارد؟

## ۱۳. چک‌لیست تحویل

- [ ] ساختار `app/` با Stack و Tabs
- [ ] مسیر پویا با تایپ پارامتر
- [ ] ناوبری Link/router و replace در auth
- [ ] `scheme` و تست Deep Link
- [ ] `+not-found.tsx`
- [ ] حالت loading و «پیدا نشد»
- [ ] عنوان پویا با `Stack.Screen`
