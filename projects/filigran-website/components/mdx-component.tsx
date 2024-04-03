import {MDXRemote} from 'next-mdx-remote/rsc'
import React from 'react'
import remarkGfm from 'remark-gfm'
import ReactLiveDisplay from '@/components/react-live/ReactLiveDisplay'
import rehypeSlug from 'rehype-slug'
import rehypeToc from '@jsdevtools/rehype-toc'
import {customizeTOCUtil} from '@/utils/customizeTOC.util' // https://unifiedjs.com/explore/package/remark-toc/
import * as FiligranUIComponent from 'filigran-ui'

const options = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug, [rehypeToc, {customizeTOC: customizeTOCUtil}]],
  },
}

const components = {
  ...FiligranUIComponent,
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
