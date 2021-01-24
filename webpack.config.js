const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

const baseConfig = {
  devtool: false,

  externals: {
    "codemirror": "CodeMirror",
    "ractive-player": {
      commonjs: "ractive-player",
      commonjs2: "ractive-player",
      amd: "ractive-player",
      root: "RactivePlayer"
    },
    "react": {
      commonjs: "react",
      commonjs2: "react",
      amd: "react",
      root: "React"
    },
    "rp-recording": {
      commonjs: "rp-recording",
      commonjs2: "rp-recording",
      amd: "rp-recording",
      root: "RPRecording"
    },
  },

  mode: "production",

  module: {
    rules: [
     {
        test: /\.tsx?$/,
        loader: "ts-loader"
      }
    ]
  },

  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          safari10: true
        }
      })
    ],
    emitOnErrors: true
  },

  plugins: [
    new webpack.BannerPlugin({
      banner: () => require("fs").readFileSync("./LICENSE", {encoding: "utf8"})
    })
  ],

  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"]
  }
}

module.exports = [
  {
    ...baseConfig,
    entry: `${__dirname}/src/index.ts`,
    output: {
      filename: "rp-codemirror.js",
      path: __dirname,
      library: "RPCodeMirror",
      libraryTarget: "umd",
      globalObject: `(typeof self !== 'undefined' ? self : this)`
    }
  },
  {
    ...baseConfig,
    entry: `${__dirname}/src/recorder.tsx`,
    output: {
      filename: "rp-codemirror.recorder.js",
      path: __dirname,
      library: ["RPCodeMirror", "CodeRecorderPlugin"],
      libraryExport: "default",
      libraryTarget: "umd"
    }
  }
];
