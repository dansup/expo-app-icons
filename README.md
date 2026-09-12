# expo-app-icons

Let users switch between alternate app icons on iOS and Android. Icons are declared once in `app.json`, the config plugin generates all native assets at prebuild time, and a tiny native module flips them at runtime.

- iOS: alternate icons are either single 1024px PNGs in the asset catalog or Icon Composer `.icon` bundles (Liquid Glass). Xcode generates the `CFBundleAlternateIcons` entries itself, no Info.plist surgery.
- Android: one `activity-alias` per icon. `MainActivity` is never disabled, so deep links and App Links keep working while a custom icon is active.
- Adaptive icons, round icons and monochrome (themed) icons on Android, using the same options as Expo's own `android.adaptiveIcon`.
- Works with the New Architecture. Requires a development build (not Expo Go).

## Install

```sh
npx expo install expo-app-icons
```

## Configure

The default icon is always whatever `expo.icon` / `expo.android.adaptiveIcon` already is. Only list the alternates.

```json
{
  "expo": {
    "plugins": [
      [
        "expo-app-icons",
        {
          "icons": {
            "midnight": "./assets/images/icons/midnight.png",
            "pride": {
              "ios": "./assets/images/icons/pride.png",
              "android": {
                "foregroundImage": "./assets/images/icons/pride-fg.png",
                "backgroundColor": "#1e1b4b",
                "monochromeImage": "./assets/images/icons/pride-mono.png"
              }
            },
            "glass": {
              "ios": "./assets/images/icons/glass.icon",
              "android": "./assets/images/icons/glass.png"
            },
            "retro": {
              "ios": "./assets/images/icons/retro.png"
            }
          }
        }
      ]
    ]
  }
}
```

Each icon is either:

- a path string: used as a 1024px icon on iOS and as a legacy (non-adaptive) icon on Android, or
- an object with `ios` (a 1024px PNG or an Icon Composer `.icon` bundle) and/or `android` (path for a legacy icon, or `{ foregroundImage, backgroundColor?, backgroundImage?, monochromeImage? }` for an adaptive icon).

`.icon` bundles are iOS-only, so they always need the object form with a separate Android image.

Icon names must match `^[a-z][a-z0-9_]*$`. `default` is reserved.

Then rebuild:

```sh
npx expo prebuild --clean
```

Use `--clean` when you rename or remove icons, otherwise stale mipmaps stay behind in the native project.

## Use

```ts
import {
  getAppIcon,
  getAvailableIcons,
  isSupported,
  setAppIcon,
} from "expo-app-icons";

isSupported(); // false in Expo Go, on web, or if no icons are configured
getAvailableIcons(); // ['midnight', 'pride', 'retro'] (platform-specific)
getAppIcon(); // 'pride' or null for the default icon

await setAppIcon("midnight");
await setAppIcon(null); // back to the default icon
```

`setAppIcon` resolves with the icon name and rejects with `ERR_UNKNOWN_ICON`, `ERR_ICONS_NOT_SUPPORTED`, or `ERR_ICON_CHANGE_FAILED`.

A minimal picker:

```tsx
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { getAppIcon, getAvailableIcons, setAppIcon } from "expo-app-icons";

export default function IconPicker() {
  const [current, setCurrent] = useState(getAppIcon());
  const icons = [null, ...getAvailableIcons()];

  return (
    <View>
      {icons.map((name) => (
        <Pressable
          key={name ?? "default"}
          onPress={() => setAppIcon(name).then(setCurrent)}
        >
          <Text>
            {name ?? "Default"}
            {current === name ? " ✓" : ""}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
```

## Platform notes

### iOS

- iOS shows a system alert ("You have changed the icon for X") after every change. This package uses the public API only, so the alert stays.
- PNG icons are stored as `AppIcon-<name>.appiconset` in `Images.xcassets`. Transparency is flattened onto white, as required by App Store review.
- Icon Composer bundles are copied to `ios/<App>/AppIcon-<name>.icon` and added to the target's resources, the same way Expo handles `expo.ios.icon`. Building them requires Xcode 26 (locally or on EAS); Xcode renders flat fallbacks for devices running older iOS versions. PNG and `.icon` alternates can be mixed freely.
- Dark and tinted variants for PNG icons (iOS 18) are not supported yet. Icon Composer bundles carry their own appearance variants.

### Android

- The plugin removes the `MAIN`/`LAUNCHER` intent filter from `MainActivity` and adds one `activity-alias` per icon, plus a `.MainActivityDefault` alias that uses your regular `ic_launcher`. Only aliases are ever enabled or disabled, so `MainActivity` and all of its deep-link intent filters stay active.
- Switching enables the new alias immediately and defers disabling the old one until the app goes to the background. Disabling the alias that launched the current task is what makes some launchers (Samsung, Xiaomi) kill the app mid-session; deferring avoids that. Until then the app drawer briefly shows two entries.
- The selected icon survives app updates. If an update removes the icon a user had selected, the module falls back to the default icon on next launch so the app never disappears from the launcher.
- One-time migration cost for existing apps: on the first release that ships this package, the launcher component changes from `.MainActivity` to `.MainActivityDefault`. Some launchers drop pinned home screen shortcuts for the old component; the app drawer entry is unaffected.
- Adaptive icons need the foreground artwork inside the safe zone (center 66% of a 108dp canvas), same as Expo's `android.adaptiveIcon.foregroundImage`.

## Development

```sh
npm install        # runs `prepare`, which builds build/ and plugin/build/
npm run build      # rebuild the JS API (watch mode in a TTY)
npm run build:plugin
```

## License

MIT
