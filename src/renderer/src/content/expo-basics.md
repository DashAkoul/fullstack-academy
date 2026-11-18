# React Native و Expo: مبانی

> مراجع: [Expo Docs](https://docs.expo.dev/) · [React Native Docs](https://reactnative.dev/docs/getting-started)

React Native کامپوننت‌های React را به ویوهای بومی (native views) تبدیل می‌کند. Expo لایه‌ی ابزاری است که ساخت، اجرا و انتشار را بدون دردسر Xcode/Android Studio اولیه فراهم می‌کند.

## ۱. شروع پروژه

```bash
npx create-expo-app@latest habit-tracker --template default
cd habit-tracker
npx expo start        # سپس i برای iOS، a برای Android، w برای وب
```

برای اجرا روی گوشی واقعی: اپ **Expo Go** را نصب کنید و QR کد را اسکن کنید.

ساختار پیش‌فرض (با Expo Router):

```
app/                 ← مسیرها (Expo Router)
├─ _layout.tsx
└─ (tabs)/
   ├─ _layout.tsx
   └─ index.tsx
components/
constants/
```

## ۲. تفاوت‌های کلیدی با وب

| وب | React Native |
| --- | --- |
| `div`, `span`, `p` | `View`, `Text`, `ScrollView` |
| CSS فایل جدا | `StyleSheet.create` (شیء جاوااسکریپت) |
| `onClick` | `onPress` |
| `px` واحد | واحد بدون بعد (نقطه، تراکم‌محور) |
| `:hover` | ندارد (از `Pressable` و state استفاده کنید) |
| Flexbox پیش‌فرض `row` | پیش‌فرض `column` |

همه‌ی متن‌ها **باید** داخل `<Text>` باشند:

```tsx
<View>
  <Text>سلام</Text>   {/* ✅ */}
</View>
```

## ۳. StyleSheet و چیدمان

```tsx
import { StyleSheet, View, Text } from 'react-native'

export function Card({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111827',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3            // Android
  },
  title: { color: '#f9fafb', fontSize: 16, fontWeight: '600' },
  subtitle: { color: '#9ca3af', fontSize: 13 }
})
```

آرایه‌ی استایل برای شرطی‌سازی:

```tsx
<View style={[styles.card, isDone && styles.cardDone, { marginTop: 8 }]} />
```

## ۴. لیست‌ها: FlatList

برای هر لیست پویا از `FlatList` (یا `FlashList`) استفاده کنید، نه `ScrollView` + `map`.

```tsx
import { FlatList } from 'react-native'

<FlatList
  data={habits}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <HabitRow habit={item} />}
  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
  ListEmptyComponent={<Text>هنوز عادتی ثبت نشده است.</Text>}
  contentContainerStyle={{ padding: 16 }}
/>
```

ویژگی‌های مهم: `keyExtractor`، `ListEmptyComponent`، `onRefresh/refreshing`، `onEndReached` برای صفحه‌بندی.

## ۵. Pressable و بازخورد لمس

```tsx
import { Pressable, Text } from 'react-native'

<Pressable
  onPress={() => toggle(id)}
  accessibilityRole="button"
  accessibilityLabel="علامت‌زدن انجام عادت"
  hitSlop={8}
  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
>
  <Text>{item.title}</Text>
</Pressable>
```

حداقل اندازه‌ی هدف لمس **44×44** نقطه است.

## ۶. TextInput و کیبورد

```tsx
import { TextInput, KeyboardAvoidingView, Platform } from 'react-native'

<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
  <TextInput
    value={draft}
    onChangeText={setDraft}
    placeholder="عادت جدید…"
    placeholderTextColor="#6b7280"
    returnKeyType="done"
    onSubmitEditing={add}
    autoCapitalize="none"
  />
</KeyboardAvoidingView>
```

## ۷. ذخیره‌سازی محلی

```bash
npx expo install @react-native-async-storage/async-storage
```

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'

export async function loadHabits(): Promise<Habit[]> {
  try {
    const raw = await AsyncStorage.getItem('habits')
    return raw ? (JSON.parse(raw) as Habit[]) : []
  } catch (e) {
    console.warn('خواندن ناموفق', e)
    return []
  }
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  try {
    await AsyncStorage.setItem('habits', JSON.stringify(habits))
  } catch (e) {
    console.warn('ذخیره ناموفق', e)
  }
}
```

> برای داده‌ی حساس (توکن) از AsyncStorage استفاده نکنید؛ `expo-secure-store` را ببینید.

## ۸. SafeArea و امنیت ظاهری

```bash
npx expo install react-native-safe-area-context
```

```tsx
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* محتوا */}
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
```

بدون این، محتوا زیر notch یا نوار خانه‌ی آیفون می‌رود.

## ۹. پیکربندی `app.json`

```json
{
  "expo": {
    "name": "Habit Tracker",
    "slug": "habit-tracker",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "habittracker",
    "userInterfaceStyle": "automatic",
    "ios": { "supportsTablet": true, "bundleIdentifier": "com.acme.habits" },
    "android": { "package": "com.acme.habits", "adaptiveIcon": { "backgroundColor": "#0b0f17" } }
  }
}
```

## ۱۰. اشکال‌زدایی

- `npx expo doctor` برای بررسی ناسازگاری نسخه‌ها.
- همیشه با `npx expo install pkg` نصب کنید تا نسخه‌ی سازگار با SDK انتخاب شود.
- Logها در ترمینال `npx expo start` و در Expo Go دیده می‌شوند.
- برای گوشی واقعی و شبکه‌ی محدود: `npx expo start --tunnel`.

## چک‌لیست کیفیت اپ

- [ ] همه‌ی متن‌ها در `Text`
- [ ] لیست‌های پویا با `FlatList` و `keyExtractor`
- [ ] SafeArea رعایت شده
- [ ] هدف لمس ≥ 44pt
- [ ] `accessibilityLabel` روی عناصر تعاملی
- [ ] خطاهای AsyncStorage مدیریت شده
- [ ] تست روی هر دو پلتفرم

## تمرین این درس

اپ ردیاب عادت با Expo + TypeScript: FlatList، فرم افزودن با اعتبارسنجی، ذخیره با AsyncStorage، StyleSheet و SafeArea. جزئیات در تب تمرین است.
