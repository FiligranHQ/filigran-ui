'use client'
import ReactLiveDisplay from '@/components/react-live/ReactLiveDisplay'
import {FiligranLoader} from '@filigran/icon'

export function ExampleLoader() {
  return (
    <>
      {' '}
      <h1>Loader example </h1>
      <FiligranLoader className="mx-auto h-[150px] w-[150px]" />
      <h2>How to use this loader </h2>
      <p className="italic">Import from @filigran/ui : </p>
      <span>{'import { FiligranLoader } from "@filigran/ui"'}</span>
      <ReactLiveDisplay
        codeExample={`<FiligranLoader className="h-[150px] w-[150px]" />`}
      />
      <p>Just like this !</p>
    </>
  )
}
