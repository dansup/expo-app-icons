import { ConfigPlugin, XcodeProject } from 'expo/config-plugins';
import { ResolvedIcon } from './config';
export declare const IOS_ASSET_PREFIX = "AppIcon-";
export declare function getIosAssetName(name: string): string;
export declare const withIosIcons: ConfigPlugin<ResolvedIcon[]>;
export declare function setAlternateIconNames(project: XcodeProject, assetNames: string[]): void;
export declare function writeIconAssetsAsync(projectRoot: string, icons: ResolvedIcon[]): Promise<void>;
