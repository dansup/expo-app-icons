import { generateImageAsync } from '@expo/image-utils';
import { ConfigPlugin, IOSConfig, withDangerousMod, withXcodeProject, XcodeProject } from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';

import { ResolvedIcon, resolveSourcePath } from './config';

export const IOS_ASSET_PREFIX = 'AppIcon-';
const ICON_SIZE = 1024;
const ICON_FILENAME = 'App-Icon-1024x1024@1x.png';
const ALTERNATE_ICONS_BUILD_SETTING = 'ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES';

export function getIosAssetName(name: string): string {
  return `${IOS_ASSET_PREFIX}${name}`;
}

export const withIosIcons: ConfigPlugin<ResolvedIcon[]> = (config, icons) => {
  const iosIcons = icons.filter((icon) => icon.ios);
  if (iosIcons.length === 0) {
    return config;
  }

  config = withXcodeProject(config, (config) => {
    setAlternateIconNames(
      config.modResults,
      iosIcons.map((icon) => getIosAssetName(icon.name))
    );
    return config;
  });

  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      await writeIconAssetsAsync(config.modRequest.projectRoot, iosIcons);
      return config;
    },
  ]);

  return config;
};

export function setAlternateIconNames(project: XcodeProject, assetNames: string[]): void {
  const [, target] = IOSConfig.Target.findFirstNativeTarget(project);
  const value = `"${assetNames.join(' ')}"`;
  const configurations = IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
    project,
    target.buildConfigurationList
  );
  for (const [, configuration] of configurations) {
    configuration.buildSettings[ALTERNATE_ICONS_BUILD_SETTING] = value;
  }
}

export async function writeIconAssetsAsync(projectRoot: string, icons: ResolvedIcon[]): Promise<void> {
  const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
  const assetsRoot = path.join(projectRoot, 'ios', projectName, 'Images.xcassets');

  for (const icon of icons) {
    const src = resolveSourcePath(projectRoot, icon.ios!, icon.name, 'ios');
    const assetDir = path.join(assetsRoot, `${getIosAssetName(icon.name)}.appiconset`);
    await fs.promises.mkdir(assetDir, { recursive: true });

    const { source } = await generateImageAsync(
      { projectRoot, cacheType: `expo-app-icons-ios-${icon.name}` },
      {
        src,
        name: ICON_FILENAME,
        width: ICON_SIZE,
        height: ICON_SIZE,
        resizeMode: 'cover',
        backgroundColor: '#ffffff',
        removeTransparency: true,
      }
    );
    await fs.promises.writeFile(path.join(assetDir, ICON_FILENAME), source);

    const contents = {
      images: [
        {
          filename: ICON_FILENAME,
          idiom: 'universal',
          platform: 'ios',
          size: `${ICON_SIZE}x${ICON_SIZE}`,
        },
      ],
      info: { version: 1, author: 'expo' },
    };
    await fs.promises.writeFile(
      path.join(assetDir, 'Contents.json'),
      JSON.stringify(contents, null, 2) + '\n'
    );
  }
}
