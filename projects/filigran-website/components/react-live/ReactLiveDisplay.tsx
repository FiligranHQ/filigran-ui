'use client'

import {LiveProvider, LiveEditor, LiveError, LivePreview} from 'react-live'
import {FunctionComponent} from 'react'
import {tw} from 'twind'
import * as FiligranUIComponent from '@filigran/ui'
import * as FiligranIcon from '@filigran/icon'

interface ReactLiveDisplayProps {
  scope?: any
  codeExample: string
  noInline?: boolean
  displayError?: boolean
}
const ReactLiveDisplay: FunctionComponent<ReactLiveDisplayProps> = ({
  scope,
  codeExample,
  noInline,
  displayError = true,
}) => {
  const customIcon = {...FiligranIcon}
  // @ts-ignore
  delete customIcon['default']
  const customComponent = {...FiligranUIComponent, ...customIcon}
  return (
    <div className="py-4">
      <LiveProvider
        code={codeExample}
        scope={{...scope, ...customComponent, tw}}
        noInline={noInline}>
        <div className="p-4">
          <LiveEditor className="font-mono" />
          <div className="mt-4 bg-background p-4">
            <LivePreview />
          </div>
        </div>
        {displayError && <LiveError className="mt-2 bg-red-100 text-red-800" />}
      </LiveProvider>
    </div>
  )
}

export default ReactLiveDisplay
