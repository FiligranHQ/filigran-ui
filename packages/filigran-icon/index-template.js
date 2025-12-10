import path from 'node:path';

const defaultIndexTemplate = (filePaths) => {
  const exportEntries = filePaths.map(({ path: filePath }) => {
    const basename = path.basename(filePath, path.extname(filePath));
    const componentName = /^\d/.test(basename) ? `Svg${basename}Icon` : `${basename}Icon`;
    return `export { default as ${componentName} } from './${basename}'`;
  });
  return exportEntries.join('\n');
}

export default defaultIndexTemplate;
