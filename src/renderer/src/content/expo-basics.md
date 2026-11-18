# React Native و Expo: مبانی

> مراجع: [Expo Docs](https://docs.expo.dev/) · [React Native Docs](https://reactnative.dev/docs/getting-started) · [Expo Router](https://docs.expo.dev/router/introduction/)

## در این درس چه یاد می‌گیرید؟

می‌فهمید React Native چه چیزی را به‌طور واقعی رندر می‌کند، تفاوت‌های کلیدی با وب چیست و چطور یک اپ قابل اجرا روی iOS و Android بسازید: لیست بهینه، فرم، ذخیره‌سازی محلی، Safe Area و استایل‌دهی. در پایان، اپ ردیاب عادت تمرین را روی گوشی/شبیه‌ساز اجرا می‌کنید.

---

## ۱. Expo Go یا Development Build؟

| | Expo Go | Development Build |
| --- | --- | --- |
| شروع | فوری (QR) | نیاز به بیلد بومی |
| کتابخانه‌های بومی سفارشی | ❌ | ✅ |
| مناسب | آموزش و اپ‌های استاندارد | پروژه‌ی واقعی |

```bash
npx create-expo-app@latest habit-tracker --template default
cd habit-tracker
npx expo start
```

سپس `a` برای Android، `i` برای iOS (فقط مک) و `w` برای وب. برای گوشی واقعی، Expo Go را نصب و QR را اسکن کنید.

```bash
npx expo install expo-image-picker   # همیشه با expo install تا نسخه سازگار SDK
npx expo doctor                      # بررسی ناسازگاری نسخه‌ها
```

## ۲. React Native چه چیزی را رندر می‌کند؟

React همان مدل رندر را دارد، اما به‌جای DOM، دستورهایی به ویوهای بومی می‌فرستد: `View` → `UIView`/`android.view.View`، `Text` → `UILabel`/`TextView`.

| وب | React Native |
| --- | --- |
| `div`, `span`, `p` | `View`, `Text` |
| CSS جدا | `StyleSheet.create` (شیء JS) |
| `onClick` | `onPress` |
| `:hover` | ندارد |
| Flexbox پیش‌فرض `row` | پیش‌فرض `column` |
| `px` | واحد بدون بعد و تراکم‌محور |

**همه‌ی متن‌ها باید داخل `<Text>` باشند.** متن لخت بیرون از Text خطا می‌دهد:

```tsx
<View>
  <Text>سلام</Text>
</View>
```

## ۳. استایل و چیدمان

```tsx
import { StyleSheet, View, Text } from 'react-native'

export function HabitRow({ title, streak }: { title: string; streak: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.streak}>🔥 {streak}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  title: { color: '#f9fafb', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  streak: { color: '#fbbf24', fontSize: 13 }
})
```

- `flex: 1` یعنی پر کردن فضای باقی‌مانده.
- `gap` در نسخه‌های جدید پشتیبانی می‌شود؛ از آن به‌جای marginهای دستی استفاده کنید.
- برای متن بلند `numberOfLines` و `flexShrink: 1` لازم است.
- استایل شرطی: `style={[styles.row, done && styles.done]}`.
- `useWindowDimensions()` برای واکنش به چرخش صفحه.

## ۴. لیست‌ها: FlatList، نه ScrollView + map

```tsx
import { FlatList, Text, View } from 'react-native'

<FlatList
  data={habits}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <HabitRow title={item.title} streak={item.streak} />}
  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
  ListEmptyComponent={<Text style={{ color: '#9ca3af' }}>هنوز عادتی ثبت نشده است.</Text>}
  contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
  refreshing={refreshing}
  onRefresh={onRefresh}
/>
```

`ScrollView` همه‌ی فرزندان را یک‌جا mount می‌کند؛ برای لیست‌های بلند از FlatList/FlashList استفاده کنید که virtualization دارد. برای لیست‌های خیلی بزرگ، `FlashList` (از Shopify) کارایی بهتری می‌دهد.

## ۵. تعامل و دسترس‌پذیری

```tsx
import { Pressable, Text } from 'react-native'

<Pressable
  onPress={() => toggle(item.id)}
  onLongPress={() => remove(item.id)}
  accessibilityRole="button"
  accessibilityLabel={`علامت‌زدن ${item.title}`}
  accessibilityState={{ checked: item.done }}
  hitSlop={8}
  style={({ pressed }) => [styles.check, pressed && { opacity: 0.5 }]}
>
  <Text>{item.done ? '✓' : '○'}</Text>
</Pressable>
```

- هدف لمس حداقل **۴۴×۴۴** نقطه.
- `hitSlop` ناحیه‌ی لمس را بدون تغییر ظاهر بزرگ می‌کند.
- برای فهرست بازشو، `accessibilityState` را درست تنظیم کنید.

## ۶. فرم و کیبورد

```tsx
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, TextInput, Pressable, Text, View } from 'react-native'

export function HabitForm({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const value = title.trim()
    if (value.length < 2) return setError('نام عادت خیلی کوتاه است.')
    onAdd(value)
    setTitle('')
    setError(null)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ gap: 8 }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="عادت جدید…"
          placeholderTextColor="#6b7280"
          returnKeyType="done"
          onSubmitEditing={submit}
          style={{ backgroundColor: '#1f2937', color: '#f9fafb', borderRadius: 10, padding: 12 }}
        />
        {error && <Text style={{ color: '#f87171' }}>{error}</Text>}
        <Pressable onPress={submit} style={{ backgroundColor: '#6366f1', padding: 12, borderRadius: 10 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>افزودن</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
```

## ۷. ذخیره‌سازی محلی

```bash
npx expo install @react-native-async-storage/async-storage
```

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'habits-v1'

export async function loadHabits(): Promise<Habit[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Habit[]) : []
  } catch (err) {
    console.warn('خواندن ناموفق', err)
    return []
  }
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(habits))
  } catch (err) {
    console.warn('ذخیره ناموفق', err)
  }
}
```

برای توکن و داده‌ی حساس از AsyncStorage استفاده نکنید؛ `expo-secure-store` (درس APIهای بومی).

## ۸. Safe Area و نوار وضعیت

```bash
npx expo install react-native-safe-area-context
```

```tsx
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0b0f17' }} edges={['top', 'bottom']}>
        {/* محتوا */}
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
```

بدون Safe Area، محتوا زیر notch یا نوار خانه‌ی آیفون می‌رود.

## ۹. app.json و تفاوت پلتفرم‌ها

```json
{
  "expo": {
    "name": "ردیاب عادت",
    "slug": "habit-tracker",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "habits",
    "userInterfaceStyle": "automatic",
    "ios": { "supportsTablet": true, "bundleIdentifier": "com.acme.habits" },
    "android": { "package": "com.acme.habits", "edgeToEdgeEnabled": true }
  }
}
```

```tsx
import { Platform } from 'react-native'
const top = Platform.select({ ios: 12, android: 8, default: 0 })
```

## ۱۰. ساخت گام‌به‌گام ردیاب عادت (تمرین)

**گام ۱ — مدل داده**

```ts
export interface Habit {
  id: string
  title: string
  streak: number
  lastDone: string | null   // YYYY-MM-DD
}
```

**گام ۲ — لایه‌ی ذخیره‌سازی** (`storage.ts` با load/save و مدیریت خطا).

**گام ۳ — state اصلی:** `habits`، `loading`؛ در `useEffect` اولیه بارگذاری و در تغییرات ذخیره.

**گام ۴ — FlatList** با `keyExtractor`، `ListEmptyComponent` و separator.

**گام ۵ — افزودن** با فرم و اعتبارسنجی؛ برای id از `expo-crypto` استفاده کنید:

```bash
npx expo install expo-crypto
```

```ts
import * as Crypto from 'expo-crypto'
const id = Crypto.randomUUID()
```

**گام ۶ — انجام روزانه:** اگر `lastDone` امروز نیست، streak را +۱ و `lastDone` را امروز کن.

**گام ۷ — حذف** با `onLongPress` و تأیید (`Alert.alert`).

**گام ۸ — SafeArea و KeyboardAvoidingView** و تست در هر دو پلتفرم.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `expo-ts` | بخش ۱ و ۹ |
| `flatlist` | بخش ۴ |
| `styles` | بخش ۳ |
| `storage` | بخش ۷ |
| `safe-area` | بخش ۵ و ۸ |

## ۱۱. عیب‌یابی

| مشکل | علت | راه‌حل |
| --- | --- | --- |
| متن بیرون Text | متن خام | `<Text>` |
| لیست کند/کرش | `ScrollView + map` | FlatList |
| کیبورد روی فرم می‌افتد | بدون KeyboardAvoidingView | بخش ۶ |
| تصویر کوچک/کشیده | بدون width/height یا resizeMode | استایل صریح |
| خطای نسخه‌ی کتابخانه | نصب با npm | `npx expo install` |
| `Unable to resolve module` | کش | `npx expo start -c` |
| SafeArea بی‌اثر | بدون Provider | SafeAreaProvider |

## ۱۲. آزمایش‌ها (با پاسخ)

**۱.** چرا `flexDirection` پیش‌فرض برای شما عجیب است؟

**پاسخ:** در React Native پیش‌فرض `column` است (وب `row`)؛ برای ردیف باید صریح `row` بدهید.

**۲.** چرا `FlatList` بهتر از map داخل ScrollView است؟

**پاسخ:** virtualization: فقط آیتم‌های نزدیک viewport mount می‌شوند.

**۳.** چطور مطمئن شوید داده بعد از بستن اپ می‌ماند؟

**پاسخ:** ذخیره در AsyncStorage بعد از هر تغییر + بارگذاری اولیه با متغیر loading.

**۴.** چرا `expo install` بهتر از `npm install` است؟

**پاسخ:** نسخه‌ی سازگار با SDK پروژه را انتخاب می‌کند.

## ۱۳. خودآزمایی

1. تفاوت View و Text با div و span؟
2. FlatList چه propsهایی برای لیست خالی و جداکننده دارد؟
3. SafeArea چه مشکلی را حل می‌کند؟
4. Flexbox در موبایل چه تفاوتی با وب دارد؟
5. AsyncStorage برای چه داده‌ای مناسب نیست؟
6. KeyboardAvoidingView را کجا می‌گذارید؟

## ۱۴. چک‌لیست تحویل

- [ ] پروژه Expo با TypeScript و app.json
- [ ] FlatList با keyExtractor و empty state
- [ ] استایل با StyleSheet و gap
- [ ] ذخیره/بازیابی با مدیریت خطا
- [ ] SafeArea و KeyboardAvoidingView
- [ ] هدف لمس ≥44 و accessibilityLabel
- [ ] تست روی Android و iOS (یا شبیه‌ساز)
