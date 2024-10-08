const path = require('path');

module.exports = {
  mode: 'development',
  // The entry point file described above
  entry: {
    index: './src/index.js',
  },
  // The location of the build folder described above
  output: {
    path: path.resolve(__dirname, './'),
    filename: 'bundle.js'
  },
  devtool: 'inline-source-map',
  devServer: {
    static: './',
  },
  // Optional and for development only. This provides the ability to
  // map the built code back to the original source format when debugging.
  // devtool: 'eval-source-map',
};