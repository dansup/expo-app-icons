"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("expo/config-plugins");
const config_1 = require("./config");
const withAndroidIcons_1 = require("./withAndroidIcons");
const withIosIcons_1 = require("./withIosIcons");
const pkg = require('../../package.json');
const withAppIcons = (config, props) => {
    const icons = (0, config_1.resolveIcons)(props);
    config = (0, withIosIcons_1.withIosIcons)(config, icons);
    config = (0, withAndroidIcons_1.withAndroidIcons)(config, icons);
    return config;
};
exports.default = (0, config_plugins_1.createRunOncePlugin)(withAppIcons, pkg.name, pkg.version);
//# sourceMappingURL=index.js.map