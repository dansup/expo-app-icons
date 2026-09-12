"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withIosIcons = exports.IOS_ASSET_PREFIX = void 0;
exports.getIosAssetName = getIosAssetName;
exports.setAlternateIconNames = setAlternateIconNames;
exports.writeIconAssetsAsync = writeIconAssetsAsync;
const image_utils_1 = require("@expo/image-utils");
const config_plugins_1 = require("expo/config-plugins");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
exports.IOS_ASSET_PREFIX = 'AppIcon-';
const ICON_SIZE = 1024;
const ICON_FILENAME = 'App-Icon-1024x1024@1x.png';
const ALTERNATE_ICONS_BUILD_SETTING = 'ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES';
function getIosAssetName(name) {
    return `${exports.IOS_ASSET_PREFIX}${name}`;
}
const withIosIcons = (config, icons) => {
    const iosIcons = icons.filter((icon) => icon.ios);
    if (iosIcons.length === 0) {
        return config;
    }
    config = (0, config_plugins_1.withXcodeProject)(config, (config) => {
        setAlternateIconNames(config.modResults, iosIcons.map((icon) => getIosAssetName(icon.name)));
        return config;
    });
    config = (0, config_plugins_1.withDangerousMod)(config, [
        'ios',
        async (config) => {
            await writeIconAssetsAsync(config.modRequest.projectRoot, iosIcons);
            return config;
        },
    ]);
    return config;
};
exports.withIosIcons = withIosIcons;
function setAlternateIconNames(project, assetNames) {
    const [, target] = config_plugins_1.IOSConfig.Target.findFirstNativeTarget(project);
    const value = `"${assetNames.join(' ')}"`;
    const configurations = config_plugins_1.IOSConfig.XcodeUtils.getBuildConfigurationsForListId(project, target.buildConfigurationList);
    for (const [, configuration] of configurations) {
        configuration.buildSettings[ALTERNATE_ICONS_BUILD_SETTING] = value;
    }
}
async function writeIconAssetsAsync(projectRoot, icons) {
    const projectName = config_plugins_1.IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const assetsRoot = path_1.default.join(projectRoot, 'ios', projectName, 'Images.xcassets');
    for (const icon of icons) {
        const src = (0, config_1.resolveSourcePath)(projectRoot, icon.ios, icon.name, 'ios');
        const assetDir = path_1.default.join(assetsRoot, `${getIosAssetName(icon.name)}.appiconset`);
        await fs_1.default.promises.mkdir(assetDir, { recursive: true });
        const { source } = await (0, image_utils_1.generateImageAsync)({ projectRoot, cacheType: `expo-app-icons-ios-${icon.name}` }, {
            src,
            name: ICON_FILENAME,
            width: ICON_SIZE,
            height: ICON_SIZE,
            resizeMode: 'cover',
            backgroundColor: '#ffffff',
            removeTransparency: true,
        });
        await fs_1.default.promises.writeFile(path_1.default.join(assetDir, ICON_FILENAME), source);
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
        await fs_1.default.promises.writeFile(path_1.default.join(assetDir, 'Contents.json'), JSON.stringify(contents, null, 2) + '\n');
    }
}
//# sourceMappingURL=withIosIcons.js.map