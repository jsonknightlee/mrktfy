// babel.config.js
module.exports = function (api) {
  api.cache(true);
  const envFile =
    process.env.EAS_BUILD_PROFILE === 'production'
      ? '.env.production'
      : '.env';

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: envFile,
        allowUndefined: true,
      }],
      ['react-native-worklets/plugin'], // keep last
    ],
  };
};
