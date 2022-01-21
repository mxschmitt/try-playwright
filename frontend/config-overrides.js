// @ts-check
const assert = require('assert');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = function override(/** @type{import('webpack').Configuration} */config, /** @type{'development' | 'production'} */ env) {
  config.plugins.push(new MonacoWebpackPlugin({
    languages: ['typescript', 'javascript', 'java', 'python', 'csharp'],
    features: []
  }));
  if (env === 'production')
    assert(config.module.rules.length === 2);
  else
    assert(config.module.rules.length === 1);
  /** @type{import('webpack').RuleSetRule} */(config.module.rules[config.module.rules.length - 1]).oneOf.unshift({
    test: /\.txt/,
    type: 'asset/source',
  });
  return config;
}