import { defineConfig } from "tsup";


export default defineConfig(() => {
  return {
    entry: ["./index.ts"],
    splitting: true,
    treeshake: true,
    sourcemap: true,
    clean: true,
    dts: true,
    format: ["esm", "cjs"],
    bundle: true,
    minify: true,
    minifyWhitespace: true,
  };
});
