"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ICON_NAME = void 0;
exports.fail = fail;
exports.resolveIcons = resolveIcons;
exports.resolveSourcePath = resolveSourcePath;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.DEFAULT_ICON_NAME = 'default';
const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const DEFAULT_BACKGROUND_COLOR = '#FFFFFF';
function fail(message) {
    throw new Error(`[expo-app-icons] ${message}`);
}
function resolveIcons(props) {
    const icons = props?.icons;
    if (!icons || typeof icons !== 'object' || Array.isArray(icons)) {
        fail('Expected an "icons" object, e.g. ["expo-app-icons", { "icons": { "midnight": "./assets/images/icons/midnight.png" } }]');
    }
    const entries = Object.entries(icons);
    if (entries.length === 0) {
        fail('"icons" is empty. Add at least one icon.');
    }
    return entries.map(([name, source]) => resolveIcon(name, source));
}
function resolveIcon(name, source) {
    if (name === exports.DEFAULT_ICON_NAME) {
        fail(`"${exports.DEFAULT_ICON_NAME}" is reserved for the icon configured in expo.icon. Pick another name.`);
    }
    if (!NAME_PATTERN.test(name)) {
        fail(`Invalid icon name "${name}". Use lowercase letters, digits and underscores, starting with a letter.`);
    }
    if (typeof source === 'string') {
        return { name, ios: source, android: { kind: 'legacy', image: source } };
    }
    if (!source || typeof source !== 'object') {
        fail(`Icon "${name}" must be a path string or an object with "ios" and/or "android".`);
    }
    const resolved = { name };
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
function resolveAndroid(name, source) {
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
function resolveSourcePath(projectRoot, source, iconName, label) {
    const absolute = path_1.default.resolve(projectRoot, source);
    if (!fs_1.default.existsSync(absolute)) {
        fail(`Icon "${iconName}" (${label}): file not found at "${source}" (resolved to ${absolute})`);
    }
    return absolute;
}
//# sourceMappingURL=config.js.map