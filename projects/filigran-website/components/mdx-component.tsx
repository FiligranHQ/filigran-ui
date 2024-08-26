import {MDXRemote} from 'next-mdx-remote/rsc'
import React from 'react'
import remarkGfm from 'remark-gfm'
import ReactLiveDisplay from '@/components/react-live/ReactLiveDisplay'
import rehypeSlug from 'rehype-slug'
import * as FiligranUIComponent from 'filigran-ui'
import * as FiligranIcon from 'filigran-icon'
import * as LucidIcon from 'lucide-react'
import {DisplayAllIcons} from '@/components/display-all-icons'
import {ExampleDataTable} from '@/components/example/example-data-table'
import {ExampleMultiSelect} from '@/components/example/example-multi-select'
import {ExampleCombobox} from '@/components/example/example-combobox'
import {ExampleToast} from '@/components/example/example-toast'
import {ExampleSheet} from '@/components/example/example-sheet'

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
  ExampleDataTable: ExampleDataTable,
  ExampleMultiSelect: ExampleMultiSelect,
  ExampleCombobox: ExampleCombobox,
  ExampleToast: ExampleToast,
  ExampleSheet: ExampleSheet,
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
