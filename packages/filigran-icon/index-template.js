const path = require('path');

function defaultIndexTemplate(filePaths) {
  const exportEntries = filePaths.map(({ path: filePath, originalPath }) => {
    const basename = path.basename(filePath, path.extname(filePath));
    const componentName = /^\d/.test(basename) ? `Svg${basename}Icon` : `${basename}Icon`;
    return `export const ${componentName} = lazy(() => import('./${basename}'))`;
  });
  return [`import { lazy } from 'react';`,...exportEntries].join('\n');
}

module.exports = defaultIndexTemplate;
