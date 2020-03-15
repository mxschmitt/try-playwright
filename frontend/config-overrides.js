const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const WorkboxWebpackPlugin = require('workbox-webpack-plugin');

module.exports = function override(config, env) {
  config.plugins.push(new MonacoWebpackPlugin({
    languages: ['typescript'],
    features: []
  }));
  config.plugins = config.plugins.filter(
    (p) => p.constructor.name !== 'GenerateSW',
  )
  if (process.env.NODE_ENV === "production") {
    // https://github.com/facebook/create-react-app/blob/4d26208d401161bffce482f3ad161412457850ab/packages/react-scripts/config/webpack.config.js#L659-L674
    config.plugins.push(new WorkboxWebpackPlugin.GenerateSW({
      clientsClaim: true,
      skipWaiting: true,
      exclude: [/\.map$/, /asset-manifest\.json$/, /index.html$/],
    }))
  }
  return config;
}