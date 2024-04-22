import * as fs from 'fs'

const FIGMA_API_TOKEN = process.env.FIGMA_API_TOKEN;
const FIGMA_FILE_ID = process.env.FIGMA_FILE_ID;
const FIGMA_NODE_ID = '207:3731';

const createFiles = (illustrations) => {
  illustrations.forEach(obj => {
    const fileName = `${obj.name}.svg`; // File name based on object's name
    const filePath = `./assets/${fileName}`; // Path where file will be saved
    fs.writeFileSync(filePath, obj.svg); // Write SVG content to the file
    console.log(`File ${fileName} created successfully!`);
  });
}

const getIllustrationName = (components) => {
  const ids = components.map(({id}) => id);
  return fetch(
    `https://api.figma.com/v1/images/${FIGMA_FILE_ID}?ids=${ids.join()}&format=svg`,
    { headers: { 'X-Figma-Token': FIGMA_API_TOKEN } }
  )
    .then(response => response.json())
    .then(({images}) => Promise.all(
      components.map(({id, name}) => fetch(images[id])
        .then(response => response.text())
        .then(svg => ({
          name, // or "name: getIllustrationName,"
          svg, // or "svg,"
        }))
      )));
};


const fetchFigmaFile = () => {
  return fetch(
    `https://api.figma.com/v1/files/${FIGMA_FILE_ID}/nodes?ids=${FIGMA_NODE_ID}`,
    { headers: { 'X-FIGMA-TOKEN': FIGMA_API_TOKEN } }
  )
    .then(response => response.json());
}

const getComponentsFromNode = (node) => {
  return node.nodes['207:3731'].document.children;
}
async function run () {
  if(!FIGMA_API_TOKEN){
    console.error('The Figma API token is not defined, you need to set an environment variable `FIGMA_API_TOKEN` to run the script');
    return;
  }
  fetchFigmaFile()
    .then(data => getComponentsFromNode(data))
    .then(components => getIllustrationName(components))
    .then((illustrations)=> createFiles(illustrations))
}

run();
