const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = function override(config, env) {
  config.plugins.push(new MonacoWebpackPlugin({
    languages: ['typescript', 'javascript'],
    features: []
  }));
  config.plugins = config.plugins.filter(
    (p) => p.constructor.name !== 'GenerateSW',
  )
  return config;
}