import { requireOptionalNativeModule } from 'expo';
const NativeModule = requireOptionalNativeModule('ExpoAppIcons');
export function isSupported() {
    return NativeModule?.isSupported() ?? false;
}
export function getAppIcon() {
    return NativeModule?.getAppIcon() ?? null;
}
export function getAvailableIcons() {
    return NativeModule?.getAvailableIcons() ?? [];
}
export async function setAppIcon(name) {
    if (!NativeModule) {
        throw new Error('[expo-app-icons] Native module is not available. Run `npx expo prebuild` and rebuild the app after adding the plugin.');
    }
    return NativeModule.setAppIcon(name ?? null);
}
//# sourceMappingURL=index.js.map