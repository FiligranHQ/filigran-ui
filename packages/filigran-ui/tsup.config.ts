import * as fs from 'fs'
import { promises as fsPromises } from 'fs';
import * as path from 'path'
import { defineConfig } from "tsup";

function readFilesRecursively(directory: string) {
  const files: string[] = [];

  function read(directory: string) {
    const entries = fs.readdirSync(directory);

    entries.forEach((entry) => {
      const fullPath = path.join(directory, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        read(fullPath);
      } else {
        files.push(fullPath);
      }
    });
  }

  read(directory);
  return files;
}

async function addDirectivesToChunkFiles(distPath = 'dist'): Promise<void> {
  try {
    const files = readFilesRecursively(distPath);

    for (const file of files) {
      /**
       * Skip chunk, sourcemap, other clients
       * */
      const isIgnoreFile =
        file.includes('chunk-') ||
        file.includes('.map') ||
        !file.includes('clients');

      if (isIgnoreFile) {
        continue;
      }

      const filePath = path.join('', file);

      const data = await fsPromises.readFile(filePath, 'utf8');

      const updatedContent = `"use client";${data}`;

      await fsPromises.writeFile(filePath, updatedContent, 'utf8');

      // console.log(`💚 Directive 'use client'; has been added to ${file}`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console -- We need to log the error
    console.error('⚠️ Something error:', err);
  }
}

export default defineConfig(() => {
  return {
    entry: ["src/index.ts","src/plugin.ts", "src/global.css", "src/components/**/*.{ts,tsx}"],
    splitting: true,
    treeshake: true,
    sourcemap: true,
    clean: true,
    dts: true,
    format: ["esm", "cjs"],
    bundle: true,
    minify: true,
    minifyWhitespace: true,
    onSuccess: async () => {
      await addDirectivesToChunkFiles();
    },
  };
});
