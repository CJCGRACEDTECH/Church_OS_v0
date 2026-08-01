const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// react-native-webview creates _tmp_ directories during install that Metro
// tries to watch but may not exist, causing an ENOENT crash on startup.
config.resolver.blockList = [
  /node_modules\/.*_tmp_.*\//,
];

module.exports = config;
