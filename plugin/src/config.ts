import fs from 'fs';
import path from 'path';

export type AndroidAdaptiveIconSource = {
  foregroundImage: string;
  backgroundColor?: string;
  backgroundImage?: string;
  monochromeImage?: string;
};

export type AppIconSource =
  | string
  | {
      ios?: string;
      android?: string | AndroidAdaptiveIconSource;
    };

export type AppIconsPluginProps = {
  icons: Record<string, AppIconSource>;
};

export type ResolvedAndroidIcon =
  | { kind: 'legacy'; image: string }
  | {
      kind: 'adaptive';
      foregroundImage: string;
      backgroundColor: string;
      backgroundImage?: string;
      monochromeImage?: string;
    };

export type ResolvedIcon = {
  name: string;
  ios?: string;
  android?: ResolvedAndroidIcon;
};

export const DEFAULT_ICON_NAME = 'default';

const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const DEFAULT_BACKGROUND_COLOR = '#FFFFFF';

export function fail(message: string): never {
  throw new Error(`[expo-app-icons] ${message}`);
}

export function resolveIcons(props: AppIconsPluginProps | undefined): ResolvedIcon[] {
  const icons = props?.icons;
  if (!icons || typeof icons !== 'object' || Array.isArray(icons)) {
    fail(
      'Expected an "icons" object, e.g. ["expo-app-icons", { "icons": { "midnight": "./assets/images/icons/midnight.png" } }]'
    );
  }

  const entries = Object.entries(icons);
  if (entries.length === 0) {
    fail('"icons" is empty. Add at least one icon.');
  }

  return entries.map(([name, source]) => resolveIcon(name, source));
}

function resolveIcon(name: string, source: AppIconSource): ResolvedIcon {
  if (name === DEFAULT_ICON_NAME) {
    fail(`"${DEFAULT_ICON_NAME}" is reserved for the icon configured in expo.icon. Pick another name.`);
  }
  if (!NAME_PATTERN.test(name)) {
    fail(
      `Invalid icon name "${name}". Use lowercase letters, digits and underscores, starting with a letter.`
    );
  }

  if (typeof source === 'string') {
    return { name, ios: source, android: { kind: 'legacy', image: source } };
  }
  if (!source || typeof source !== 'object') {
    fail(`Icon "${name}" must be a path string or an object with "ios" and/or "android".`);
  }

  const resolved: ResolvedIcon = { name };

  if (source.ios !== undefined) {
    if (typeof source.ios !== 'string') {
      fail(`Icon "${name}": "ios" must be a path string.`);
    }
    resolved.ios = source.ios;
  }

  if (source.android !== undefined) {
    resolved.android = resolveAndroid(name, source.android);
  }

  if (!resolved.ios && !resolved.android) {
    fail(`Icon "${name}" has no "ios" or "android" source.`);
  }

  return resolved;
}

function resolveAndroid(name: string, source: string | AndroidAdaptiveIconSource): ResolvedAndroidIcon {
  if (typeof source === 'string') {
    return { kind: 'legacy', image: source };
  }
  if (!source || typeof source !== 'object' || typeof source.foregroundImage !== 'string') {
    fail(`Icon "${name}": "android" must be a path string or an object with "foregroundImage".`);
  }
  return {
    kind: 'adaptive',
    foregroundImage: source.foregroundImage,
    backgroundColor: source.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    backgroundImage: source.backgroundImage,
    monochromeImage: source.monochromeImage,
  };
}

export function resolveSourcePath(
  projectRoot: string,
  source: string,
  iconName: string,
  label: string
): string {
  const absolute = path.resolve(projectRoot, source);
  if (!fs.existsSync(absolute)) {
    fail(`Icon "${iconName}" (${label}): file not found at "${source}" (resolved to ${absolute})`);
  }
  return absolute;
}
