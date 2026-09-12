import { requireOptionalNativeModule } from 'expo';

type ExpoAppIconsNativeModule = {
  isSupported(): boolean;
  getAppIcon(): string | null;
  getAvailableIcons(): string[];
  setAppIcon(name: string | null): Promise<string | null>;
};

const NativeModule = requireOptionalNativeModule<ExpoAppIconsNativeModule>('ExpoAppIcons');

export function isSupported(): boolean {
  return NativeModule?.isSupported() ?? false;
}

export function getAppIcon(): string | null {
  return NativeModule?.getAppIcon() ?? null;
}

export function getAvailableIcons(): string[] {
  return NativeModule?.getAvailableIcons() ?? [];
}

export async function setAppIcon(name: string | null): Promise<string | null> {
  if (!NativeModule) {
    throw new Error(
      '[expo-app-icons] Native module is not available. Run `npx expo prebuild` and rebuild the app after adding the plugin.'
    );
  }
  return NativeModule.setAppIcon(name ?? null);
}
