import {MDXRemote} from 'next-mdx-remote/rsc'
import React from 'react'
import remarkGfm from 'remark-gfm'
import ReactLiveDisplay from '@/components/react-live/ReactLiveDisplay'
import rehypeSlug from 'rehype-slug'
import * as FiligranUIComponent from '@filigran/ui'
import * as FiligranIcon from '@filigran/icon'
import * as LucidIcon from 'lucide-react'
import {DisplayAllIcons} from '@/components/display-all-icons'
import {ExampleDataTable} from '@/components/example/example-data-table'
import {ExampleMultiSelect} from '@/components/example/example-multi-select'
import {ExampleCombobox} from '@/components/example/example-combobox'
import {ExampleToast} from '@/components/example/example-toast'
import {ExampleSheet} from '@/components/example/example-sheet'
import {ExampleTagInput} from '@/components/example/example-tag-input'
import {Colors} from '@/components/example/color'
import {
  Quizz,
  QuizzExplanation,
  QuizzQuestionChoice,
} from '@/components/ui/quizz'
import {ExampleLoader} from '@/components/example/example-loader'
import { AutoFormTest } from './autoform/autoform-test';
import {CodePlayground} from '@/components/code-playground/code-playground'
import {CodePlaygroundTest} from '@/components/code-playground/code-playground-test'
import {PlaygroundTest} from '@/components/code-playground/playground-test'
import {ContentWithLeftColumnFixed} from '@/components/ui/content-with-left-column-fixed'
import ExampleFileInput from '@/components/example/example-file-input'
import {ExampleCarousel} from '@/components/example/example-carousel'

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
  AutoFormTest: AutoFormTest,
  CodePlayground: CodePlayground,
  CodePlaygroundTest: CodePlaygroundTest,
  PlaygroundTest: PlaygroundTest,
  ContentWithLeftColumnFixed: ContentWithLeftColumnFixed,
  ReactLiveDisplay: ReactLiveDisplay,
  DisplayAllIcons: DisplayAllIcons,
  ExampleDataTable: ExampleDataTable,
  ExampleMultiSelect: ExampleMultiSelect,
  ExampleCombobox: ExampleCombobox,
  ExampleCarousel: ExampleCarousel,
  ExampleToast: ExampleToast,
  ExampleSheet: ExampleSheet,
  ExampleFileInput: ExampleFileInput,
  ExampleTagInput: ExampleTagInput,
  ExampleLoader: ExampleLoader,
  Colors: Colors,
  Quizz: Quizz,
  QuizzQuestionChoice: QuizzQuestionChoice,
  QuizzExplanation: QuizzExplanation,
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
