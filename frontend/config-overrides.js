const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = function override(config, env) {
  config.plugins.push(new MonacoWebpackPlugin({
    languages: ['typescript'],
    features: []
  }));
  config.optimization.splitChunks.cacheGroups = {
    monacoCommon: {
      test: /[\\/]node_modules[\\/]monaco\-editor/,
      name: 'monaco-editor-common',
      chunks: 'async'
    }
  }
  return config;
}