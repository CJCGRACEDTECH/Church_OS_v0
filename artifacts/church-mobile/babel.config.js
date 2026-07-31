module.exports = function (api) {
  // api.caller() requires per-caller caching, not a flat api.cache(true).
  // Invalidate the cache whenever the target platform changes.
  const platform = api.caller((c) => c?.platform);
  api.cache.invalidate(() => platform);

  // The react-native-worklets Babel plugin (v0.5.x) crashes on web when it
  // encounters negative number literals in react-native-gesture-handler.
  // Worklets are native-only, so skip the plugin entirely for web builds.
  const isWeb = platform === 'web';

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          unstable_transformImportMeta: true,
          ...(isWeb ? { worklets: false } : {}),
        },
      ],
    ],
  };
};
