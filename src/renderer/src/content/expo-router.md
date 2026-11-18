# مسیریابی با Expo Router

> مرجع رسمی: [Expo Router](https://docs.expo.dev/router/introduction/)

Expo Router مسیریابی فایل‌محور را به React Native می‌آورد — همان مدلی که از Next.js می‌شناسید. هر فایل در `app/` یک مسیر است، و ساختار پوشه‌ها = ساختار ناوبری.

## ۱. نصب و راه‌اندازی

```bash
npx create-expo-app@latest menu-app
# قالب پیش‌فرض Expo Router را شامل می‌شود
```

```
app/
├─ _layout.tsx              ← Stack ریشه
├─ (tabs)/
│  ├─ _layout.tsx           ← Tabs
│  ├─ index.tsx             ← /  (منو)
│  ├─ orders.tsx            ← /orders
│  └─ profile.tsx           ← /profile
├─ menu/
│  └─ [id].tsx              ← /menu/:id
└─ +not-found.tsx
```

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
      </Stack>
    </SafeAreaProvider>
  )
}
```

## ۳. تب‌ها

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#818cf8',
        tabBarInactiveTintColor: '#6b7280',
        headerShown: false
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

پرانتزها `(tabs)` یعنی «گروه مسیر»: در URL اثری ندارند ولی یک layout مشترک می‌سازند.

## ۴. مسیر پویا و پارامترها

```tsx
// app/menu/[id].tsx
import { useLocalSearchParams, useRouter } from 'expo-router'
import { View, Text, ActivityIndicator, Pressable } from 'react-native'
import { useEffect, useState } from 'react'

export default function MenuItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [item, setItem] = useState<MenuItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch(`https://api.example.com/menu/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then((data) => alive && setItem(data))
      .catch(() => alive && setItem(null))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id])

  if (loading) return <ActivityIndicator />
  if (!item)
    return (
      <View>
        <Text>این غذا در منو موجود نیست.</Text>
        <Pressable onPress={() => router.back()}><Text>بازگشت</Text></Pressable>
      </View>
    )

  return (
    <View>
      <Text>{item.name}</Text>
      <Text>{item.price} تومان</Text>
    </View>
  )
}
```

## ۵. ناوبری: `Link` و `router`

```tsx
import { Link, router } from 'expo-router'

// declarative
<Link href="/menu/12" asChild>
  <Pressable><Text>مشاهده پیتزا</Text></Pressable>
</Link>

// imperative
router.push('/menu/12')
router.replace('/orders')     // بدون امکان بازگشت
router.back()
router.push({ pathname: '/menu/[id]', params: { id: '12' } })   // با تایپ
```

`asChild` استایل و رفتار `Pressable` شما را حفظ می‌کند — برای دسترس‌پذیری بهتر از `<Link><Text>` خام بله.

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

تست:

```bash
npx uri-scheme open menufast://menu/12 --ios
npx uri-scheme open menufast://menu/12 --android
```

وقتی اپ از طریق لینک باز شد، Expo Router خودکار مسیر `menu/[id]` را با پارامتر درست رندر می‌کند.

## ۷. مسیر نامعتبر

```tsx
// app/+not-found.tsx
import { Link, Stack } from 'expo-router'
import { View, Text } from 'react-native'

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'یافت نشد' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text>صفحه‌ای که دنبال آن بودید وجود ندارد.</Text>
        <Link href="/">بازگشت به منو</Link>
      </View>
    </>
  )
}
```

## ۸. داده‌ی مشترک در layout

```tsx
// app/(tabs)/orders.tsx
import { useCart } from '@/store/cart'

export default function OrdersScreen() {
  const items = useCart((s) => s.items)
  return items.length === 0 ? <Empty /> : <OrderList items={items} />
}
```

Store (Zustand/Context) در layout ریشه provider می‌شود تا بین مسیرها مشترک بماند.

## ۹. الگوهای پیشرفته

| نیاز | راه‌حل |
| --- | --- |
| مودال | `presentation: 'modal'` روی `Stack.Screen` |
| مسیر محافظت‌شده | بررسی auth در layout و `<Redirect href="/login" />` |
| تب پنهان | `options={{ href: null }}` |
| صفحه‌ی splash تا آماده شدن داده | `SplashScreen.preventAutoHideAsync()` |

```tsx
// محافظت از مسیر
import { Redirect, useSegments } from 'expo-router'
import { useAuth } from '@/store/auth'

export function useProtected() {
  const { user } = useAuth()
  const segments = useSegments()
  const inAuthGroup = segments[0] === '(auth)'
  if (!user && !inAuthGroup) return <Redirect href="/login" />
  return null
}
```

## ۱۰. خطاهای رایج

| خطا | علت |
| --- | --- |
| «No route named X» | نام فایل با نام screen یکی نیست |
| پرشدن تب‌های اضافی از فایل‌های جدید | با `href: null` پنهان کنید |
| پارامتر `undefined` | نام پارامتر در `[id]` با `useLocalSearchParams` یکی نیست |
| Deep link باز نمی‌شود | `scheme` در app.json تنظیم نشده یا بیلد دوباره نشده |

## تمرین این درس

اپ منوی رستوران: تب‌های منو/سفارش/پروفایل با `(tabs)`، مسیر پویا `menu/[id]`، ناوبری با Link/router، `scheme` برای Deep Link و `+not-found`. جزئیات در تب تمرین است.
