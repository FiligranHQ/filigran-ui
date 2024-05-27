import {MDXRemote} from 'next-mdx-remote/rsc'
import React from 'react'
import remarkGfm from 'remark-gfm'
import ReactLiveDisplay from '@/components/react-live/ReactLiveDisplay'
import rehypeSlug from 'rehype-slug'
import rehypeToc from '@jsdevtools/rehype-toc'
import {customizeTOCUtil} from '@/utils/customizeTOC.util' // https://unifiedjs.com/explore/package/remark-toc/
import * as FiligranUIComponent from 'filigran-ui'
import * as FiligranIcon from 'filigran-icon'
import * as LucidIcon from 'lucide-react'
import {DisplayAllIcons} from '@/components/display-all-icons'
import {ExampleTable} from '@/components/example-table'
import {ExampleDataTable} from '@/components/example-data-table'
import {ExampleMultiSelect} from '@/components/example-multi-select'

const options = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug, [rehypeToc, {customizeTOC: customizeTOCUtil}]],
  },
}

const components = {
  ...LucidIcon,
  ...FiligranUIComponent,
  ...FiligranIcon,
  ReactLiveDisplay: ReactLiveDisplay,
  DisplayAllIcons: DisplayAllIcons,
  ExampleTable: ExampleTable,
  ExampleDataTable: ExampleDataTable,
  ExampleMultiSelect: ExampleMultiSelect,
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
