/*
|-------------------------------------------------------------------------------
| Development config                      https://maizzle.com/docs/environments
|-------------------------------------------------------------------------------
|
| The exported object contains the default Maizzle settings for development.
| This is used when you run `maizzle build` or `maizzle serve` and it has
| the fastest build time, since most transformations are disabled.
|
*/

/** @type {import('@maizzle/framework').Config} */
const config = {
  build: {
    content: [ 'src/templates/**/*.html' ],
    static: {
      source: [ 'src/images/**/*.*' ],
      destination: 'images',
    },
    output: {
      path: 'build_local',
      extension: 'html',
    },
  },
};



export default config;
