const presets = [
  [
    '@babel/preset-env',
    {
      targets: { electron: 6 }
    }
  ],
  ['@babel/preset-react']
];

module.exports = { presets };
