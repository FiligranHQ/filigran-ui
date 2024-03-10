import {MDXRemote} from 'next-mdx-remote/rsc'
import React from 'react'
import remarkGfm from 'remark-gfm'
import {Button} from '@/components/ui/button'
import ReactLiveDisplay from '@/components/react-live/ReactLiveDisplay'
import rehypeSlug from 'rehype-slug'
import rehypeToc from '@jsdevtools/rehype-toc'
import {customizeTOCUtil} from '@/utils/customizeTOC.util' // https://unifiedjs.com/explore/package/remark-toc/

const options = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug, [rehypeToc, {customizeTOC: customizeTOCUtil}]],
  },
}
const components = {
  Button: Button,
  ReactLiveDisplay: ReactLiveDisplay,
}

export async function CustomMDX(props: any) {
  return (
    <MDXRemote
      {...props}
      components={{...components, ...(props.components || {})}}
      options={options}
    />
  )
}
