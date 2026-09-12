import { generateImageAsync } from "@expo/image-utils";
import {
  ConfigPlugin,
  IOSConfig,
  withDangerousMod,
  withXcodeProject,
  XcodeProject,
} from "expo/config-plugins";
import fs from "fs";
import path from "path";

import {
  ICON_COMPOSER_EXTENSION,
  ResolvedIcon,
  isIconComposerBundle,
  resolveSourcePath,
} from "./config";

export const IOS_ASSET_PREFIX = "AppIcon-";
const ICON_SIZE = 1024;
const ICON_FILENAME = "App-Icon-1024x1024@1x.png";
const ALTERNATE_ICONS_BUILD_SETTING =
  "ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES";

export function getIosAssetName(name: string): string {
  return `${IOS_ASSET_PREFIX}${name}`;
}

export const withIosIcons: ConfigPlugin<ResolvedIcon[]> = (config, icons) => {
  const iosIcons = icons.filter((icon) => icon.ios);
  if (iosIcons.length === 0) {
    return config;
  }

  config = withXcodeProject(config, (config) => {
    const projectName =
      config.modRequest.projectName ??
      IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    setAlternateIconNames(
      config.modResults,
      iosIcons.map((icon) => getIosAssetName(icon.name)),
    );
    for (const icon of iosIcons) {
      if (isIconComposerBundle(icon.ios!)) {
        addIconComposerBundleToProject(
          config.modResults,
          projectName,
          getIosAssetName(icon.name),
        );
      }
    }
    return config;
  });

  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      await writeIconAssetsAsync(config.modRequest.projectRoot, iosIcons);
      return config;
    },
  ]);

  return config;
};

export function setAlternateIconNames(
  project: XcodeProject,
  assetNames: string[],
): void {
  const [, target] = IOSConfig.Target.findFirstNativeTarget(project);
  const value = `"${assetNames.join(" ")}"`;
  const configurations = IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
    project,
    target.buildConfigurationList,
  );
  for (const [, configuration] of configurations) {
    configuration.buildSettings[ALTERNATE_ICONS_BUILD_SETTING] = value;
  }
}

export function addIconComposerBundleToProject(
  project: XcodeProject,
  projectName: string,
  assetName: string,
): void {
  IOSConfig.XcodeUtils.addResourceFileToGroup({
    filepath: `${projectName}/${assetName}${ICON_COMPOSER_EXTENSION}`,
    groupName: projectName,
    project,
    isBuildFile: true,
    verbose: false,
  });
}

export async function writeIconAssetsAsync(
  projectRoot: string,
  icons: ResolvedIcon[],
): Promise<void> {
  const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
  const iosProjectRoot = path.join(projectRoot, "ios", projectName);
  const assetsRoot = path.join(iosProjectRoot, "Images.xcassets");

  for (const icon of icons) {
    const assetName = getIosAssetName(icon.name);
    const appIconSetDir = path.join(assetsRoot, `${assetName}.appiconset`);
    const composerBundleDir = path.join(
      iosProjectRoot,
      `${assetName}${ICON_COMPOSER_EXTENSION}`,
    );

    if (isIconComposerBundle(icon.ios!)) {
      const src = resolveSourcePath(projectRoot, icon.ios!, icon.name, "ios");
      await fs.promises.rm(appIconSetDir, { recursive: true, force: true });
      await fs.promises.rm(composerBundleDir, { recursive: true, force: true });
      await fs.promises.cp(src, composerBundleDir, { recursive: true });
      continue;
    }

    await fs.promises.rm(composerBundleDir, { recursive: true, force: true });
    await writeAppIconSetAsync(projectRoot, appIconSetDir, icon);
  }
}

async function writeAppIconSetAsync(
  projectRoot: string,
  assetDir: string,
  icon: ResolvedIcon,
): Promise<void> {
  const src = resolveSourcePath(projectRoot, icon.ios!, icon.name, "ios");
  await fs.promises.mkdir(assetDir, { recursive: true });

  const { source } = await generateImageAsync(
    { projectRoot, cacheType: `expo-app-icons-ios-${icon.name}` },
    {
      src,
      name: ICON_FILENAME,
      width: ICON_SIZE,
      height: ICON_SIZE,
      resizeMode: "cover",
      backgroundColor: "#ffffff",
      removeTransparency: true,
    },
  );
  await fs.promises.writeFile(path.join(assetDir, ICON_FILENAME), source);

  const contents = {
    images: [
      {
        filename: ICON_FILENAME,
        idiom: "universal",
        platform: "ios",
        size: `${ICON_SIZE}x${ICON_SIZE}`,
      },
    ],
    info: { version: 1, author: "expo" },
  };
  await fs.promises.writeFile(
    path.join(assetDir, "Contents.json"),
    JSON.stringify(contents, null, 2) + "\n",
  );
}
