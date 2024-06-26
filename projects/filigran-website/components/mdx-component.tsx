import {MDXRemote} from 'next-mdx-remote/rsc'
import React from 'react'
import remarkGfm from 'remark-gfm'
import ReactLiveDisplay from '@/components/react-live/ReactLiveDisplay'
import rehypeSlug from 'rehype-slug'
import * as FiligranUIComponent from 'filigran-ui'
import * as FiligranIcon from 'filigran-icon'
import * as LucidIcon from 'lucide-react'
import {DisplayAllIcons} from '@/components/display-all-icons'
import {ExampleTable} from '@/components/example-table'
import {ExampleDataTable} from '@/components/example-data-table'
import {ExampleMultiSelect} from '@/components/example-multi-select'
import {ExampleCombobox} from '@/components/example-combobox'
import {ExampleToast} from '@/components/example-toast'

const options = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug],
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
  ExampleCombobox: ExampleCombobox,
  ExampleToast: ExampleToast,
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
