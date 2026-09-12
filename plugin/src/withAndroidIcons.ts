import { compositeImagesAsync, generateImageAsync } from '@expo/image-utils';
import {
  AndroidConfig,
  ConfigPlugin,
  withAndroidColors,
  withAndroidManifest,
  withDangerousMod,
} from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';

import { DEFAULT_ICON_NAME, ResolvedIcon, resolveSourcePath } from './config';

type AndroidManifest = AndroidConfig.Manifest.AndroidManifest;
type ManifestIntentFilter = AndroidConfig.Manifest.ManifestIntentFilter;
type ManifestActivityAlias = AndroidConfig.Manifest.ManifestActivityAlias;

export const ICON_META_DATA_NAME = 'expo.modules.appicons.icon';

const RES_PATH = 'android/app/src/main/res';
const ADAPTIVE_FOLDER = 'mipmap-anydpi-v26';
const BASELINE_PIXEL_SIZE = 108;
const DENSITIES = [
  { folder: 'mipmap-mdpi', scale: 1 },
  { folder: 'mipmap-hdpi', scale: 1.5 },
  { folder: 'mipmap-xhdpi', scale: 2 },
  { folder: 'mipmap-xxhdpi', scale: 3 },
  { folder: 'mipmap-xxxhdpi', scale: 4 },
];

export function getResourceName(name: string, suffix = ''): string {
  return `ic_launcher_${name}${suffix}`;
}

export function getColorName(name: string): string {
  return `icon_background_${name}`;
}

export function getAliasName(name: string): string {
  return `.MainActivity${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

export const withAndroidIcons: ConfigPlugin<ResolvedIcon[]> = (config, icons) => {
  const androidIcons = icons.filter((icon) => icon.android);
  if (androidIcons.length === 0) {
    return config;
  }

  config = withAndroidManifest(config, (config) => {
    config.modResults = setLauncherAliases(config.modResults, androidIcons);
    return config;
  });

  config = withAndroidColors(config, (config) => {
    for (const icon of androidIcons) {
      if (icon.android?.kind === 'adaptive') {
        config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, {
          name: getColorName(icon.name),
          value: icon.android.backgroundColor,
        });
      }
    }
    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      await writeIconResourcesAsync(config.modRequest.projectRoot, androidIcons);
      return config;
    },
  ]);

  return config;
};

export function setLauncherAliases(manifest: AndroidManifest, icons: ResolvedIcon[]): AndroidManifest {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  const targetActivity = mainActivity.$['android:name'];

  mainActivity['intent-filter'] = (mainActivity['intent-filter'] ?? []).filter(
    (filter) => !isLauncherFilter(filter)
  );

  const foreignAliases = (application['activity-alias'] ?? []).filter(
    (alias) => !isManagedAlias(alias)
  );

  const managedAliases: ManifestActivityAlias[] = [
    createAlias({
      iconName: DEFAULT_ICON_NAME,
      targetActivity,
      enabled: true,
      icon: 'ic_launcher',
      roundIcon: 'ic_launcher_round',
    }),
    ...icons.map((icon) =>
      createAlias({
        iconName: icon.name,
        targetActivity,
        enabled: false,
        icon: getResourceName(icon.name),
        roundIcon: getResourceName(icon.name, '_round'),
      })
    ),
  ];

  application['activity-alias'] = [...foreignAliases, ...managedAliases];
  return manifest;
}

function createAlias(options: {
  iconName: string;
  targetActivity: string;
  enabled: boolean;
  icon: string;
  roundIcon: string;
}): ManifestActivityAlias {
  return {
    $: {
      'android:name': getAliasName(options.iconName),
      'android:targetActivity': options.targetActivity,
      'android:enabled': options.enabled ? 'true' : 'false',
      'android:exported': 'true',
      'android:icon': `@mipmap/${options.icon}`,
      'android:roundIcon': `@mipmap/${options.roundIcon}`,
    } as ManifestActivityAlias['$'],
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      },
    ],
    'meta-data': [
      {
        $: { 'android:name': ICON_META_DATA_NAME, 'android:value': options.iconName },
      },
    ],
  };
}

function isLauncherFilter(filter: ManifestIntentFilter): boolean {
  return (filter.category ?? []).some(
    (category) => category.$['android:name'] === 'android.intent.category.LAUNCHER'
  );
}

function isManagedAlias(alias: ManifestActivityAlias): boolean {
  return (alias['meta-data'] ?? []).some(
    (meta) => meta.$['android:name'] === ICON_META_DATA_NAME
  );
}

export async function writeIconResourcesAsync(projectRoot: string, icons: ResolvedIcon[]): Promise<void> {
  const resRoot = path.join(projectRoot, RES_PATH);

  for (const icon of icons) {
    const android = icon.android!;
    const base = getResourceName(icon.name);

    if (android.kind === 'legacy') {
      const image = resolveSourcePath(projectRoot, android.image, icon.name, 'android');
      await writeLegacyIconsAsync(projectRoot, resRoot, icon.name, image, undefined, 'transparent');
      await removeAdaptiveXmlAsync(resRoot, base);
      continue;
    }

    const foreground = resolveSourcePath(projectRoot, android.foregroundImage, icon.name, 'android.foregroundImage');
    const background = android.backgroundImage
      ? resolveSourcePath(projectRoot, android.backgroundImage, icon.name, 'android.backgroundImage')
      : undefined;
    const monochrome = android.monochromeImage
      ? resolveSourcePath(projectRoot, android.monochromeImage, icon.name, 'android.monochromeImage')
      : undefined;

    await writeLegacyIconsAsync(projectRoot, resRoot, icon.name, foreground, background, android.backgroundColor);
    await writeAdaptiveLayersAsync(projectRoot, resRoot, icon.name, foreground, background, monochrome);
    await writeAdaptiveXmlAsync(resRoot, icon.name, Boolean(background), Boolean(monochrome));
  }
}

async function writeLegacyIconsAsync(
  projectRoot: string,
  resRoot: string,
  name: string,
  image: string,
  background: string | undefined,
  backgroundColor: string
): Promise<void> {
  const base = getResourceName(name);

  await Promise.all(
    DENSITIES.map(async ({ folder, scale }) => {
      const size = BASELINE_PIXEL_SIZE * scale;
      const foregroundColor = background ? 'transparent' : backgroundColor;

      let square = await renderAsync(projectRoot, `${name}-legacy`, image, size, {
        backgroundColor: foregroundColor,
      });
      let round = await renderAsync(projectRoot, `${name}-legacy-round`, image, size, {
        backgroundColor: foregroundColor,
        borderRadius: size / 2,
      });

      if (background) {
        const squareBackground = await renderAsync(projectRoot, `${name}-legacy-bg`, background, size, {
          backgroundColor,
        });
        const roundBackground = await renderAsync(projectRoot, `${name}-legacy-bg-round`, background, size, {
          backgroundColor,
          borderRadius: size / 2,
        });
        square = await compositeImagesAsync({ foreground: square, background: squareBackground });
        round = await compositeImagesAsync({ foreground: round, background: roundBackground });
      }

      const folderPath = path.join(resRoot, folder);
      await fs.promises.mkdir(folderPath, { recursive: true });
      await fs.promises.writeFile(path.join(folderPath, `${base}.png`), square);
      await fs.promises.writeFile(path.join(folderPath, `${base}_round.png`), round);
    })
  );
}

async function writeAdaptiveLayersAsync(
  projectRoot: string,
  resRoot: string,
  name: string,
  foreground: string,
  background: string | undefined,
  monochrome: string | undefined
): Promise<void> {
  await Promise.all(
    DENSITIES.map(async ({ folder, scale }) => {
      const size = BASELINE_PIXEL_SIZE * scale;
      const folderPath = path.join(resRoot, folder);
      await fs.promises.mkdir(folderPath, { recursive: true });

      const layers: [string, string | undefined][] = [
        ['_foreground', foreground],
        ['_background', background],
        ['_monochrome', monochrome],
      ];

      for (const [suffix, source] of layers) {
        const file = path.join(folderPath, `${getResourceName(name, suffix)}.png`);
        if (!source) {
          await fs.promises.rm(file, { force: true });
          continue;
        }
        const buffer = await renderAsync(projectRoot, `${name}${suffix}`, source, size, {
          backgroundColor: 'transparent',
        });
        await fs.promises.writeFile(file, buffer);
      }
    })
  );
}

async function writeAdaptiveXmlAsync(
  resRoot: string,
  name: string,
  hasBackgroundImage: boolean,
  hasMonochrome: boolean
): Promise<void> {
  const base = getResourceName(name);
  const backgroundDrawable = hasBackgroundImage
    ? `@mipmap/${getResourceName(name, '_background')}`
    : `@color/${getColorName(name)}`;
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
    `  <background android:drawable="${backgroundDrawable}"/>`,
    `  <foreground android:drawable="@mipmap/${getResourceName(name, '_foreground')}"/>`,
  ];
  if (hasMonochrome) {
    lines.push(`  <monochrome android:drawable="@mipmap/${getResourceName(name, '_monochrome')}"/>`);
  }
  lines.push('</adaptive-icon>', '');

  const folderPath = path.join(resRoot, ADAPTIVE_FOLDER);
  await fs.promises.mkdir(folderPath, { recursive: true });
  const xml = lines.join('\n');
  await fs.promises.writeFile(path.join(folderPath, `${base}.xml`), xml);
  await fs.promises.writeFile(path.join(folderPath, `${base}_round.xml`), xml);
}

async function removeAdaptiveXmlAsync(resRoot: string, base: string): Promise<void> {
  const folderPath = path.join(resRoot, ADAPTIVE_FOLDER);
  await fs.promises.rm(path.join(folderPath, `${base}.xml`), { force: true });
  await fs.promises.rm(path.join(folderPath, `${base}_round.xml`), { force: true });
}

async function renderAsync(
  projectRoot: string,
  cacheKey: string,
  src: string,
  size: number,
  options: { backgroundColor: string; borderRadius?: number }
): Promise<Buffer> {
  const { source } = await generateImageAsync(
    { projectRoot, cacheType: `expo-app-icons-android-${cacheKey}` },
    {
      src,
      width: size,
      height: size,
      resizeMode: 'cover',
      backgroundColor: options.backgroundColor,
      borderRadius: options.borderRadius,
    }
  );
  return source;
}
