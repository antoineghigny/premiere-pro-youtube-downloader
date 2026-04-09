const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env = {}) => {
  const targetBrowser = env.browser === 'firefox' ? 'firefox' : 'chrome';
  const outputDir = targetBrowser === 'firefox' ? 'dist-firefox' : 'dist';

  return {
    entry: {
      content: './src/content.ts',
      background: './src/background.ts',
      popup: './src/popup/popup.ts',
    },
    output: {
      path: path.resolve(__dirname, outputDir),
      filename: '[name].js',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({ filename: '[name].css' }),
      new CopyPlugin({
        patterns: [
          {
            from: 'src/manifest.json',
            to: 'manifest.json',
            transform(content) {
              const manifest = JSON.parse(content.toString());

              if (targetBrowser === 'firefox') {
                delete manifest.key;
              }

              return JSON.stringify(manifest, null, 2);
            },
          },
          { from: 'src/popup/popup.html', to: 'popup.html' },
          { from: 'src/icons', to: 'icons' },
        ],
      }),
    ],
  };
};
