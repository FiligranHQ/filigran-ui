import fs from 'fs'
import path from 'path'
import {serialize} from 'next-mdx-remote/serialize'

export interface ContentMenu {
  title: string
  content: ContentMenu[]
  slug?: string
}
async function parseFrontmatter(fileContent: string) {
  // Need to find a better way to extract Frontmatter. Maybe Gray-matter ? https://github.com/jonschlinkert/gray-matter
  const {frontmatter} = await serialize(fileContent, {
    parseFrontmatter: true,
    mdxOptions: {},
  })
  return {frontmatter}
}

function getMDXFiles(dir: string, withIndex: boolean = false) {
  const mdxFiles: string[] = []
  fs.readdirSync(dir).forEach((file) => {
    if (file === 'index.mdx' && !withIndex) {
      return
    }
    if (path.extname(file) === '.mdx' || path.extname(file) === '.md') {
      mdxFiles.push(file)
    } else {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        mdxFiles.push(...getMDXFiles(filePath).map((f) => `${file}/${f}`))
      }
    }
  })
  return mdxFiles
}

async function getMDXMenu(
  dir: string,
  parentDir?: string
): Promise<ContentMenu> {
  const data: ContentMenu = {
    title: 'Missing title',
    content: [],
  }
  for (const file of fs.readdirSync(dir)) {
    if (path.extname(file) === '.mdx' || path.extname(file) === '.md') {
      let {metadata} = await readMDXFile(path.join(dir, file))
      if (file === 'index.mdx') {
        data.title = metadata.frontmatter.title as string
      } else {
        data.content.push({
          title: metadata?.frontmatter.title as string,
          slug: `${parentDir ? `${parentDir}/` : ''}${file.replace('.mdx', '')}`,
          content: [],
        })
      }
    } else {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        const childMenu = await getMDXMenu(`${filePath}`, file)
        data.content.push(childMenu)
      }
    }
  }
  return data
}

async function readMDXFile(filePath: string) {
  const rawContent = fs.readFileSync(filePath, 'utf-8')
  const frontmatterRegex = /---\s*([\s\S]*?)\s*---/
  const content = rawContent.replace(frontmatterRegex, '').trim()
  return {
    metadata: await parseFrontmatter(rawContent),
    content,
  }
}

async function getMDXData(dir: string) {
  const mdxFiles = getMDXFiles(dir)
  const data = []
  for (const file of mdxFiles) {
    const {content, metadata} = await readMDXFile(path.join(dir, file));
    data.push({
      slug: file.replace('.mdx', ''),
      content,
      metadata,
    })
  }
  return data
}

export function getAllContents(contentPath: string = 'docs') {
  return getMDXData(path.join(process.cwd(), `content/${contentPath}`))
}

export function getContentMenu(
  contentPath: string = 'docs'
): Promise<ContentMenu> {
  return getMDXMenu(path.join(process.cwd(), `content/${contentPath}`))
}
