module.exports = {
  apps: [
    {
      name: 'back_hiro-nuxt',
      script: '.output/server/index.mjs',
      env: {
        PORT: 3100,
      },
    },
  ],
};
