// Use require.resolve to pin the local tailwindcss v3,
// preventing the globally installed v4 from being picked up.
module.exports = {
  plugins: {
    [require.resolve("tailwindcss")]: {},
    autoprefixer: {},
  },
};
