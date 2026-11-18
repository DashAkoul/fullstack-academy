# APIهای بومی و Native Modules

> مراجع: [Expo Permissions](https://docs.expo.dev/guides/permissions/) · [expo-location](https://docs.expo.dev/versions/latest/sdk/location/) · [expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) · [Expo Modules API](https://docs.expo.dev/modules/overview/)

## در این درس چه یاد می‌گیرید؟

الگوی درست درخواست مجوز، کار با دوربین/گالری، موقعیت مکانی، اعلان‌ها و ذخیره‌ی امن را یاد می‌گیرید و می‌بینید وقتی کتابخانه‌ی آماده نیست چطور ماژول بومی بسازید. در پایان، اپ «گزارش خرابی شهری» تمرین را با مدیریت کامل حالت رد شدن مجوز می‌سازید.

---

## ۱. مدل مجوز: در لحظه‌ی نیاز، با توضیح

هر مجوز سه حالت دارد: `granted`، `denied` (می‌توان دوباره پرسید) و `denied` دائمی (`canAskAgain: false`).

```tsx
import { Linking, Alert } from 'react-native'
import * as Location from 'expo-location'

export async function ensureLocation(): Promise<boolean> {
  const services = await Location.hasServicesEnabledAsync()
  if (!services) {
    Alert.alert('مکان‌یابی خاموش است', 'برای ثبت محل خرابی، GPS را روشن کنید.')
    return false
  }

  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync()
  if (status === 'granted') return true

  if (!canAskAgain) {
    Alert.alert(
      'دسترسی به موقعیت بسته است',
      'در تنظیمات اپ، دسترسی موقعیت را فعال کنید.',
      [
        { text: 'باز کردن تنظیمات', onPress: () => Linking.openSettings() },
        { text: 'بعداً', style: 'cancel' }
      ]
    )
  }
  return false
}
```

قواعد:

- مجوز را **هنگام باز شدن اپ** نپرسید؛ درست قبل از استفاده بپرسید.
- متن توضیح مجوز باید بگوید **چرا** و **چه چیزی** (نه «برای بهبود تجربه»).
- همیشه حالت رد شدن را طراحی کنید؛ اپ نباید بلاک شود.

## ۲. دوربین و گالری

```bash
npx expo install expo-image-picker
```

```tsx
import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

export function PhotoInput({ onPicked }: { onPicked: (uri: string) => void }) {
  const [uri, setUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(from: 'camera' | 'library') {
    setError(null)
    const perm = from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!perm.granted) {
      setError('برای انتخاب عکس به دسترسی نیاز داریم.')
      return
    }

    const result = from === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })

    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset) return
    setUri(asset.uri)
    onPicked(asset.uri)
  }

  return (
    <View style={{ gap: 8 }}>
      {uri && <Image source={{ uri }} style={{ width: 200, height: 150, borderRadius: 12 }} />}
      {error && <Text style={{ color: '#f87171' }}>{error}</Text>}
      <Pressable onPress={() => pick('camera')}><Text>گرفتن عکس</Text></Pressable>
      <Pressable onPress={() => pick('library')}><Text>انتخاب از گالری</Text></Pressable>
    </View>
  )
}
```

- کیفیت را کم کنید (`quality: 0.7`) تا آپلود و حافظه بهتر شود.
- `allowsEditing` تجربه‌ی برش را می‌دهد.
- URI در `cache` است؛ برای نگه‌داری بلندمدت فایل را با `expo-file-system` کپی کنید.

## ۳. موقعیت مکانی

```ts
import * as Location from 'expo-location'

export async function getCoords(): Promise<{ lat: number; lng: number } | null> {
  const ok = await ensureLocation()
  if (!ok) return null

  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    return { lat: pos.coords.latitude, lng: pos.coords.longitude }
  } catch (err) {
    console.warn('خطای موقعیت', err)
    return null
  }
}
```

| گزینه | کاربرد |
| --- | --- |
| `Accuracy.Lowest/…/BestForNavigation` | تعادل دقت/باتری |
| `getLastKnownPositionAsync` | سریع اما ممکن است قدیمی باشد |
| `watchPositionAsync({ distanceInterval })` | ردیابی مسیر با مصرف کنترل‌شده |
| `reverseGeocodeAsync` | تبدیل مختصات به آدرس (نیاز به شبکه) |

مجوز پس‌زمینه (`requestBackgroundPermissionsAsync`) فقط اگر واقعاً لازم است؛ نیاز به توضیح در App Store و مصرف باتری بالا دارد.

## ۴. اعلان‌ها

```bash
npx expo install expo-notifications
```

```ts
import * as Notifications from 'expo-notifications'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
})

export async function scheduleDaily(hour = 20, minute = 0) {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return null

  await Notifications.cancelAllScheduledNotificationsAsync()
  return Notifications.scheduleNotificationAsync({
    content: { title: 'یادآوری', body: 'عادت‌های امروز را ثبت کردی؟' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute }
  })
}
```

- این «اعلان محلی» است و سرور لازم ندارد.
- برای push واقعی (ارسال از سرور) به توکن Expo و سرویس push نیاز دارید.
- در Android کانال اعلان تعریف کنید تا کاربر بتواند صدا را کنترل کند.

## ۵. ذخیره‌ی امن

```bash
npx expo install expo-secure-store
```

```ts
import * as SecureStore from 'expo-secure-store'

export const tokenStore = {
  async save(token: string) {
    await SecureStore.setItemAsync('auth_token', token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED
    })
  },
  get: () => SecureStore.getItemAsync('auth_token'),
  clear: () => SecureStore.deleteItemAsync('auth_token')
}
```

| داده | ابزار |
| --- | --- |
| توکن/رمز | SecureStore (Keychain/Keystore) |
| تنظیمات UI | AsyncStorage |
| داده‌ی ساختاریافته‌ی بزرگ | expo-sqlite |

SecureStore برای مقادیر کوچک (چند KB) طراحی شده است.

## ۶. Config Plugins و توضیح مجوزها

```json
{
  "expo": {
    "plugins": [
      ["expo-image-picker", {
        "photosPermission": "برای انتخاب عکس خرابی از گالری شما استفاده می‌کنیم.",
        "cameraPermission": "برای ثبت عکس خرابی به دوربین نیاز داریم."
      }],
      ["expo-location", {
        "locationWhenInUsePermission": "موقعیت شما برای ثبت دقیق محل خرابی استفاده می‌شود."
      }]
    ],
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "برای ثبت عکس خرابی به دوربین نیاز داریم."
      }
    },
    "android": {
      "permissions": ["ACCESS_FINE_LOCATION"]
    }
  }
}
```

متن عمومی باعث رد شدن در بازبینی App Store می‌شود؛ مشخص بنویسید.

## ۷. Development Build و Native Modules

کتابخانه‌های بومی در Expo Go فقط اگر از قبل داخلش باشند کار می‌کنند. برای ماژول سفارشی:

```bash
npx expo run:ios       # بیلد native
npx expo run:android
npx create-expo-module@latest --local my-sdk
```

```swift
// ios/MySdkModule.swift
import ExpoModulesCore

public class MySdkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MySdk")
    Function("greet") { (name: String) -> String in
      "سلام \(name)"
    }
  }
}
```

```kotlin
// android/.../MySdkModule.kt
class MySdkModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MySdk")
    Function("greet") { name: String -> "سلام $name" }
  }
}
```

```ts
import { requireNativeModule } from 'expo-modules-core'
const MySdk = requireNativeModule<{ greet(name: string): string }>('MySdk')
```

پس از افزودن ماژول بومی، Expo Go کافی نیست؛ باید development build بسازید.

## ۸. ساخت گام‌به‌گام گزارش خرابی شهری (تمرین)

**گام ۱ — مدل داده**

```ts
interface Report {
  id: string
  title: string
  photoUri: string
  location: { lat: number; lng: number } | null
  createdAt: string
}
```

**گام ۲ — فرم:** عنوان، توضیح، دکمه‌ی عکس، دکمه‌ی «دریافت موقعیت»، دکمه‌ی ارسال.

**گام ۳ — عکس:** `PhotoInput` بخش ۲ با مدیریت denied.

**گام ۴ — موقعیت:** `getCoords` با مدیریت GPS خاموش و خطا؛ نمایش مختصات با ۵ رقم اعشار.

**گام ۵ — ارسال:** بدون موقعیت هم اجازه بدهید اما هشدار بدهید («موقعیت ثبت نشد»).

**گام ۶ — ذخیره‌ی محلی:** گزارش‌ها در AsyncStorage؛ توکن فرضی با SecureStore.

**گام ۷ — اعلان:** بعد از ثبت، امکان یادآوری روزانه.

**گام ۸ — تست:** مجوز را رد کنید و مطمئن شوید اپ کرش نمی‌کند؛ در تنظیمات فعال و برگردید.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `permissions` | بخش ۱ |
| `camera` | بخش ۲ |
| `location` | بخش ۳ |
| `secure` | بخش ۵ |
| `config` | بخش ۶ |

## ۹. عیب‌یابی

| مشکل | علت | راه‌حل |
| --- | --- | --- |
| مجوز هر بار پرسیده می‌شود | بدون بررسی `status` قبلی | وضعیت را بخوانید و فقط در نیاز بپرسید |
| عکس پس از ری‌استارت نیست | URI کش موقت | کپی به حافظه‌ی دائمی |
| موقعیت همیشه null | شبیه‌ساز بدون لوکیشن | تنظیم موقعیت شبیه‌ساز یا دستگاه واقعی |
| اعلان نمی‌رسد | مجوز/کانال | مجوز + کانال Android |
| SecureStore خطا | مقدار بزرگ | داده را کم کنید یا SQLite |
| ماژول بومی پیدا نمی‌شود | Expo Go | development build |
| متن مجوز رد شد | توضیح مبهم | بخش ۶ |

## ۱۰. آزمایش‌ها (با پاسخ)

**۱.** تفاوت `requestForegroundPermissionsAsync` و `requestBackgroundPermissionsAsync`؟

**پاسخ:** اولی وقتی اپ باز است؛ دومی برای دریافت موقعیت در پس‌زمینه (مصرف باتری و سخت‌گیری بیشتر).

**۲.** چرا بعد از `denied` دائمی نباید دوباره درخواست داد؟

**پاسخ:** سیستم دیگر دیالوگ نشان نمی‌دهد؛ باید کاربر را به تنظیمات هدایت کرد.

**۳.** چرا توکن را در AsyncStorage نگه نمی‌داریم؟

**پاسخ:** بدون رمزنگاری است و در دستگاه روت/بکاپ قابل خواندن؛ SecureStore استفاده کنید.

**۴.** چه زمانی Native Module می‌نویسیم؟

**پاسخ:** وقتی API بومی لازم است و کتابخانه/ماژول آماده‌ای وجود ندارد (یا باید SDK داخلی را وصل کنیم).

## ۱۱. خودآزمایی

1. سه حالت مجوز و رفتار درست هر کدام؟
2. چطور کیفیت/حجم عکس را کنترل می‌کنید؟
3. تفاوت اعلان محلی و push؟
4. SecureStore چه محدودیتی دارد؟
5. Config Plugin چه کاری انجام می‌دهد؟
6. چرا Expo Go برای ماژول بومی کافی نیست؟

## ۱۲. چک‌لیست تحویل

- [ ] درخواست مجوز در لحظه‌ی نیاز با متن مشخص
- [ ] مدیریت `denied` و `canAskAgain: false`
- [ ] عکس با پیش‌نمایش و خطا
- [ ] موقعیت با GPS خاموش/خطا
- [ ] توکن در SecureStore
- [ ] متن مجوزها در app.json
- [ ] بدون کرش در حالت رد مجوز
- [ ] تست روی دستگاه واقعی برای دوربین/GPS
