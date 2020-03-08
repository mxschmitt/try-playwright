const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const webpack = require("webpack")

module.exports = function override(config, env) {
  config.plugins.push(new MonacoWebpackPlugin({
    languages: ['typescript'],
    features: []
  }));
  return config;
}