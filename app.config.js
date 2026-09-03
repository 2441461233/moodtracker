module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    // EAS rejects empty env values; explicitly separate native builds from Pages.
    baseUrl:
      process.env.MOODTRACKER_BUILD_TARGET === 'native'
        ? ''
        : process.env.EXPO_PUBLIC_BASE_URL || '',
  },
});
