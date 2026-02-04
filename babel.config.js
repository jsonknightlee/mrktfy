module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      //['module:react-native-dotenv', {
      //  moduleName: '@env',
      //  path: process.env.DOTENV_FILE || '.env', // <-- this is why DOTENV_FILE matters
      //  allowUndefined: true
      //}],
      //['react-native-reanimated/plugin'],
      ['react-native-worklets/plugin'], // <-- keep ONLY this for Reanimated 4
    ],
  };
};
