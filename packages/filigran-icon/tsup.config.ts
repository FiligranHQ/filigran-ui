import { defineConfig } from "tsup";


export default defineConfig(() => {
  return {
    entry: ["src/index.ts"],
    splitting: true,
    treeshake: true,
    sourcemap: true,
    clean: true,
    format: ["esm", "cjs"],
    bundle: true,
    minify: true,
    minifyWhitespace: true,
  };
});
