import { writeFileSync } from 'node:fs'

const FIGMA_API_TOKEN = process.env.FIGMA_API_TOKEN;
const FIGMA_FILE_ID = process.env.FIGMA_FILE_ID;
const FIGMA_NODE_ID = '30:39';

const replaceSvg = (svgContent) => {
  const hexColorRegex = /#([0-9A-Fa-f]{3,6})/g;
  return svgContent.replace(hexColorRegex, "currentColor");
}

const createFiles = (illustrations) => {
  illustrations.forEach(obj => {
    const fileName = `${obj.name}.svg`; // File name based on object's name
    const filePath = `./assets/${fileName}`; // Path where file will be saved
    writeFileSync(filePath, obj.svg); // Write SVG content to the file
    console.log(`File ${fileName} created successfully!`);
  });
}

const getIllustrationName = async (components) => {
  const ids = components.map(({id}) => id);
  const response = await fetch(
    `https://api.figma.com/v1/images/${FIGMA_FILE_ID}?ids=${ids.join()}&format=svg`,
    {headers: {'X-Figma-Token': FIGMA_API_TOKEN}}
  );
  const {images} = await response.json();
  await Promise.all(
    components.filter(({id}) => images[id]).map(async ({id, name}) => {
        const svgResponse = await fetch(images[id]);
        const svg = await svgResponse.text();
        return {
          name, // or "name: getIllustrationName,"
          svg: replaceSvg(svg), // or "svg,"
        };
      }
    ));
};

const getComponentsFromNode = (node) => {
  return node.nodes['30:39'].document.children.filter((doc) => doc.type !== 'TEXT');
}

const run = async () => {
  if (!FIGMA_API_TOKEN) {
    console.error('The Figma API token is not defined, you need to set an environment variable `FIGMA_API_TOKEN` to run the script');
    return;
  }
  if (!FIGMA_FILE_ID) {
    console.error('The Figma file ID is not defined, you need to set an environment variable `FIGMA_FILE_ID` to run the script');
    return;
  }

  const response = await fetch(
    `https://api.figma.com/v1/files/${FIGMA_FILE_ID}/nodes?ids=${FIGMA_NODE_ID}`,
    {headers: {'X-FIGMA-TOKEN': FIGMA_API_TOKEN}}
  );
  const data = await response.json();
  const components = getComponentsFromNode(data);
  const illustrations = getIllustrationName(components);
  createFiles(illustrations);
}

run();
