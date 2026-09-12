"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAndroidIcons = exports.ICON_META_DATA_NAME = void 0;
exports.getResourceName = getResourceName;
exports.getColorName = getColorName;
exports.getAliasName = getAliasName;
exports.setLauncherAliases = setLauncherAliases;
exports.writeIconResourcesAsync = writeIconResourcesAsync;
const image_utils_1 = require("@expo/image-utils");
const config_plugins_1 = require("expo/config-plugins");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
exports.ICON_META_DATA_NAME = 'expo.modules.appicons.icon';
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
function getResourceName(name, suffix = '') {
    return `ic_launcher_${name}${suffix}`;
}
function getColorName(name) {
    return `icon_background_${name}`;
}
function getAliasName(name) {
    return `.MainActivity${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}
const withAndroidIcons = (config, icons) => {
    const androidIcons = icons.filter((icon) => icon.android);
    if (androidIcons.length === 0) {
        return config;
    }
    config = (0, config_plugins_1.withAndroidManifest)(config, (config) => {
        config.modResults = setLauncherAliases(config.modResults, androidIcons);
        return config;
    });
    config = (0, config_plugins_1.withAndroidColors)(config, (config) => {
        for (const icon of androidIcons) {
            if (icon.android?.kind === 'adaptive') {
                config.modResults = config_plugins_1.AndroidConfig.Colors.assignColorValue(config.modResults, {
                    name: getColorName(icon.name),
                    value: icon.android.backgroundColor,
                });
            }
        }
        return config;
    });
    config = (0, config_plugins_1.withDangerousMod)(config, [
        'android',
        async (config) => {
            await writeIconResourcesAsync(config.modRequest.projectRoot, androidIcons);
            return config;
        },
    ]);
    return config;
};
exports.withAndroidIcons = withAndroidIcons;
function setLauncherAliases(manifest, icons) {
    const application = config_plugins_1.AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    const mainActivity = config_plugins_1.AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    const targetActivity = mainActivity.$['android:name'];
    mainActivity['intent-filter'] = (mainActivity['intent-filter'] ?? []).filter((filter) => !isLauncherFilter(filter));
    const foreignAliases = (application['activity-alias'] ?? []).filter((alias) => !isManagedAlias(alias));
    const managedAliases = [
        createAlias({
            iconName: config_1.DEFAULT_ICON_NAME,
            targetActivity,
            enabled: true,
            icon: 'ic_launcher',
            roundIcon: 'ic_launcher_round',
        }),
        ...icons.map((icon) => createAlias({
            iconName: icon.name,
            targetActivity,
            enabled: false,
            icon: getResourceName(icon.name),
            roundIcon: getResourceName(icon.name, '_round'),
        })),
    ];
    application['activity-alias'] = [...foreignAliases, ...managedAliases];
    return manifest;
}
function createAlias(options) {
    return {
        $: {
            'android:name': getAliasName(options.iconName),
            'android:targetActivity': options.targetActivity,
            'android:enabled': options.enabled ? 'true' : 'false',
            'android:exported': 'true',
            'android:icon': `@mipmap/${options.icon}`,
            'android:roundIcon': `@mipmap/${options.roundIcon}`,
        },
        'intent-filter': [
            {
                action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
            },
        ],
        'meta-data': [
            {
                $: { 'android:name': exports.ICON_META_DATA_NAME, 'android:value': options.iconName },
            },
        ],
    };
}
function isLauncherFilter(filter) {
    return (filter.category ?? []).some((category) => category.$['android:name'] === 'android.intent.category.LAUNCHER');
}
function isManagedAlias(alias) {
    return (alias['meta-data'] ?? []).some((meta) => meta.$['android:name'] === exports.ICON_META_DATA_NAME);
}
async function writeIconResourcesAsync(projectRoot, icons) {
    const resRoot = path_1.default.join(projectRoot, RES_PATH);
    for (const icon of icons) {
        const android = icon.android;
        const base = getResourceName(icon.name);
        if (android.kind === 'legacy') {
            const image = (0, config_1.resolveSourcePath)(projectRoot, android.image, icon.name, 'android');
            await writeLegacyIconsAsync(projectRoot, resRoot, icon.name, image, undefined, 'transparent');
            await removeAdaptiveXmlAsync(resRoot, base);
            continue;
        }
        const foreground = (0, config_1.resolveSourcePath)(projectRoot, android.foregroundImage, icon.name, 'android.foregroundImage');
        const background = android.backgroundImage
            ? (0, config_1.resolveSourcePath)(projectRoot, android.backgroundImage, icon.name, 'android.backgroundImage')
            : undefined;
        const monochrome = android.monochromeImage
            ? (0, config_1.resolveSourcePath)(projectRoot, android.monochromeImage, icon.name, 'android.monochromeImage')
            : undefined;
        await writeLegacyIconsAsync(projectRoot, resRoot, icon.name, foreground, background, android.backgroundColor);
        await writeAdaptiveLayersAsync(projectRoot, resRoot, icon.name, foreground, background, monochrome);
        await writeAdaptiveXmlAsync(resRoot, icon.name, Boolean(background), Boolean(monochrome));
    }
}
async function writeLegacyIconsAsync(projectRoot, resRoot, name, image, background, backgroundColor) {
    const base = getResourceName(name);
    await Promise.all(DENSITIES.map(async ({ folder, scale }) => {
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
            square = await (0, image_utils_1.compositeImagesAsync)({ foreground: square, background: squareBackground });
            round = await (0, image_utils_1.compositeImagesAsync)({ foreground: round, background: roundBackground });
        }
        const folderPath = path_1.default.join(resRoot, folder);
        await fs_1.default.promises.mkdir(folderPath, { recursive: true });
        await fs_1.default.promises.writeFile(path_1.default.join(folderPath, `${base}.png`), square);
        await fs_1.default.promises.writeFile(path_1.default.join(folderPath, `${base}_round.png`), round);
    }));
}
async function writeAdaptiveLayersAsync(projectRoot, resRoot, name, foreground, background, monochrome) {
    await Promise.all(DENSITIES.map(async ({ folder, scale }) => {
        const size = BASELINE_PIXEL_SIZE * scale;
        const folderPath = path_1.default.join(resRoot, folder);
        await fs_1.default.promises.mkdir(folderPath, { recursive: true });
        const layers = [
            ['_foreground', foreground],
            ['_background', background],
            ['_monochrome', monochrome],
        ];
        for (const [suffix, source] of layers) {
            const file = path_1.default.join(folderPath, `${getResourceName(name, suffix)}.png`);
            if (!source) {
                await fs_1.default.promises.rm(file, { force: true });
                continue;
            }
            const buffer = await renderAsync(projectRoot, `${name}${suffix}`, source, size, {
                backgroundColor: 'transparent',
            });
            await fs_1.default.promises.writeFile(file, buffer);
        }
    }));
}
async function writeAdaptiveXmlAsync(resRoot, name, hasBackgroundImage, hasMonochrome) {
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
    const folderPath = path_1.default.join(resRoot, ADAPTIVE_FOLDER);
    await fs_1.default.promises.mkdir(folderPath, { recursive: true });
    const xml = lines.join('\n');
    await fs_1.default.promises.writeFile(path_1.default.join(folderPath, `${base}.xml`), xml);
    await fs_1.default.promises.writeFile(path_1.default.join(folderPath, `${base}_round.xml`), xml);
}
async function removeAdaptiveXmlAsync(resRoot, base) {
    const folderPath = path_1.default.join(resRoot, ADAPTIVE_FOLDER);
    await fs_1.default.promises.rm(path_1.default.join(folderPath, `${base}.xml`), { force: true });
    await fs_1.default.promises.rm(path_1.default.join(folderPath, `${base}_round.xml`), { force: true });
}
async function renderAsync(projectRoot, cacheKey, src, size, options) {
    const { source } = await (0, image_utils_1.generateImageAsync)({ projectRoot, cacheType: `expo-app-icons-android-${cacheKey}` }, {
        src,
        width: size,
        height: size,
        resizeMode: 'cover',
        backgroundColor: options.backgroundColor,
        borderRadius: options.borderRadius,
    });
    return source;
}
//# sourceMappingURL=withAndroidIcons.js.map