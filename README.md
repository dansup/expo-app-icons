<p align="center">
  <img src="./icon.png" alt="expo-app-icons" width="180" height="180" />
</p>

<h1 align="center">expo-app-icons</h1>

<p align="center">
  Switch between alternate app icons in Expo apps on iOS and Android.
</p>

<p align="center">
  Define your icons once in <code>app.json</code>. Native assets and configuration are generated automatically at prebuild time.
</p>

---

## Features

- **iOS alternate icons**
  - Standard 1024×1024 PNG icons
  - Icon Composer `.icon` bundles with Liquid Glass
  - No manual `Info.plist` configuration

- **Android alternate icons**
  - Adaptive icons
  - Round icons
  - Monochrome / themed icons
  - Safe switching using `activity-alias`

- **Deep-link safe**
  - `MainActivity` is never disabled on Android
  - Deep Links and App Links continue working while an alternate icon is active

- **Expo native module**
  - Works with the New Architecture
  - Icons are generated automatically during prebuild
  - Small runtime API for reading and changing the active icon

> [!NOTE]
> `expo-app-icons` requires a development build or production build. It does not work in Expo Go.

## Install

```sh
npx expo install expo-app-icons
```

## Configure

Add `expo-app-icons` to your Expo config.

The default icon continues to come from `expo.icon` and/or `expo.android.adaptiveIcon`. You only need to declare alternate icons.

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

An icon can be declared as either a simple path:

```json
{
  "midnight": "./assets/images/icons/midnight.png"
}
```

or with platform-specific configuration:

```json
{
  "pride": {
    "ios": "./assets/images/icons/pride.png",
    "android": {
      "foregroundImage": "./assets/images/icons/pride-fg.png",
      "backgroundColor": "#1e1b4b",
      "monochromeImage": "./assets/images/icons/pride-mono.png"
    }
  }
}
```

### Icon configuration

A path string is used as:

- a 1024×1024 icon on iOS
- a legacy non-adaptive icon on Android

The object form supports:

- `ios`
  - 1024×1024 PNG
  - Icon Composer `.icon` bundle

- `android`
  - image path for a legacy icon
  - adaptive icon configuration:

```ts
{
  foregroundImage: string;
  backgroundColor?: string;
  backgroundImage?: string;
  monochromeImage?: string;
}
```

Icon Composer `.icon` bundles are iOS-only, so they must use the object form if you also want to provide an Android icon:

```json
{
  "glass": {
    "ios": "./assets/images/icons/glass.icon",
    "android": "./assets/images/icons/glass.png"
  }
}
```

### Icon names

Icon names must match:

```regex
^[a-z][a-z0-9_]*$
```

For example:

```text
midnight
pride
retro_2
dark_blue
```

`default` is reserved and cannot be used as an alternate icon name.

## Prebuild

After configuring your icons, regenerate the native projects:

```sh
npx expo prebuild --clean
```

Using `--clean` is especially important when renaming or removing icons. Otherwise, stale Android mipmaps or native configuration may remain in the generated project.

## Usage

```ts
import {
  getAppIcon,
  getAvailableIcons,
  isSupported,
  setAppIcon,
} from "expo-app-icons";
```

### Check support

```ts
isSupported();
```

Returns `false` when:

- running in Expo Go
- running on web
- no alternate icons are configured
- the platform does not support changing app icons

### Get available icons

```ts
const icons = getAvailableIcons();

console.log(icons);
// ['midnight', 'pride', 'glass', 'retro']
```

The returned list is platform-specific. Icons configured only for another platform are omitted.

### Get the current icon

```ts
const icon = getAppIcon();

console.log(icon);
// 'pride'
```

The default app icon is represented by `null`:

```ts
getAppIcon();
// null
```

### Change the icon

```ts
await setAppIcon("midnight");
```

Restore the default icon with:

```ts
await setAppIcon(null);
```

`setAppIcon()` resolves with the selected icon name, or `null` when restoring the default icon.

It may reject with:

| Error                     | Meaning                                                 |
| ------------------------- | ------------------------------------------------------- |
| `ERR_UNKNOWN_ICON`        | The requested icon is not configured                    |
| `ERR_ICONS_NOT_SUPPORTED` | Alternate icons are unavailable on the current platform |
| `ERR_ICON_CHANGE_FAILED`  | The native platform failed to change the icon           |

## Example picker

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

iOS displays a system alert after each icon change:

> You have changed the icon for X.

`expo-app-icons` uses Apple's public alternate icon API, so this alert cannot be suppressed.

#### PNG icons

PNG alternate icons are stored as:

```text
AppIcon-<name>.appiconset
```

inside `Images.xcassets`.

Transparency is flattened onto white to satisfy App Store icon requirements.

#### Icon Composer

Icon Composer `.icon` bundles are copied to:

```text
ios/<App>/AppIcon-<name>.icon
```

and added to the application's resource target in the same way Expo handles `expo.ios.icon`.

Building Icon Composer icons requires **Xcode 26** locally or through EAS Build.

Xcode automatically renders flat fallbacks for devices running older versions of iOS.

PNG and `.icon` alternate icons can be mixed freely.

> [!NOTE]
> Dark and tinted variants for PNG alternate icons introduced with iOS 18 are not currently supported. Icon Composer bundles can carry their own appearance variants.

### Android

Android alternate icons are implemented using `activity-alias`.

The plugin removes the `MAIN` / `LAUNCHER` intent filter from `MainActivity` and creates:

```text
.MainActivityDefault
```

for the default launcher icon, plus one alias for each configured alternate icon.

`MainActivity` itself is never enabled or disabled.

This means its Deep Link and App Link intent filters remain active regardless of which launcher icon is selected.

#### Switching icons

When switching icons, the new alias is enabled immediately.

The previous alias is disabled after the app moves to the background.

This avoids an Android launcher issue where disabling the alias that launched the current task can cause some launchers — particularly Samsung and Xiaomi devices — to terminate the app mid-session.

During this short period, the app drawer may temporarily display both icons.

#### App updates

The selected icon survives application updates.

If an update removes an icon that a user previously selected, `expo-app-icons` automatically falls back to the default icon the next time the application launches.

This prevents the application from disappearing from the launcher.

#### Existing applications

There is a one-time migration consideration when adding `expo-app-icons` to an existing Android application.

The launcher component changes from:

```text
.MainActivity
```

to:

```text
.MainActivityDefault
```

Some Android launchers may remove existing pinned home-screen shortcuts referencing the old launcher component.

The app drawer entry is unaffected.

#### Adaptive icon safe zone

Adaptive icon foreground artwork should remain inside the Android safe zone:

```text
center 66% of a 108dp canvas
```

This is the same requirement as Expo's `android.adaptiveIcon.foregroundImage`.

## Development

Install dependencies:

```sh
npm install
```

`npm install` runs `prepare`, which builds both the JavaScript API and config plugin.

Build the JavaScript/native module API:

```sh
npm run build
```

When running in a TTY, this uses watch mode.

Build the config plugin:

```sh
npm run build:plugin
```

## License

MIT
