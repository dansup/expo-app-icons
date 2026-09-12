import { ConfigPlugin, createRunOncePlugin } from 'expo/config-plugins';

import { AppIconsPluginProps, resolveIcons } from './config';
import { withAndroidIcons } from './withAndroidIcons';
import { withIosIcons } from './withIosIcons';

const pkg: { name: string; version: string } = require('../../package.json');

const withAppIcons: ConfigPlugin<AppIconsPluginProps> = (config, props) => {
  const icons = resolveIcons(props);
  config = withIosIcons(config, icons);
  config = withAndroidIcons(config, icons);
  return config;
};

export type { AppIconsPluginProps, AppIconSource, AndroidAdaptiveIconSource } from './config';

export default createRunOncePlugin(withAppIcons, pkg.name, pkg.version);
