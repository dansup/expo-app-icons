export type AndroidAdaptiveIconSource = {
    foregroundImage: string;
    backgroundColor?: string;
    backgroundImage?: string;
    monochromeImage?: string;
};
export type AppIconSource = string | {
    ios?: string;
    android?: string | AndroidAdaptiveIconSource;
};
export type AppIconsPluginProps = {
    icons: Record<string, AppIconSource>;
};
export type ResolvedAndroidIcon = {
    kind: 'legacy';
    image: string;
} | {
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
export declare const DEFAULT_ICON_NAME = "default";
export declare function fail(message: string): never;
export declare function resolveIcons(props: AppIconsPluginProps | undefined): ResolvedIcon[];
export declare function resolveSourcePath(projectRoot: string, source: string, iconName: string, label: string): string;
