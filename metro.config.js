const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.watchFolders = [
  path.resolve(__dirname, 'my-module'),
];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

config.resolver.extraNodeModules = {
  'react': path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  'expo': path.resolve(__dirname, 'node_modules/expo'),
  'expo-modules-core': path.resolve(__dirname, 'node_modules/expo-modules-core'),
};

// Excluir node_modules del módulo del bundling
config.resolver.blockList = [
  /my-module[\/\\]node_modules[\/\\].*/,
];

module.exports = config;