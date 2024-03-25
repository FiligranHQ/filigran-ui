'use client'

import {LiveProvider, LiveEditor, LiveError, LivePreview} from 'react-live'
import {FunctionComponent} from 'react'
import {tw} from 'twind'
import {Button} from 'filigran-ui/servers'

interface ReactLiveDisplayProps {
  scope?: any
  codeExample: string
  noInline?: boolean
}
const ReactLiveDisplay: FunctionComponent<ReactLiveDisplayProps> = ({
  scope,
  codeExample,
  noInline,
}) => {
  const customComponent = {Button}
  return (
    <div className="py-4">
      <LiveProvider
        code={codeExample}
        scope={{...scope, ...customComponent, tw}}
        noInline={noInline}>
        <div className="p-4">
          <LiveEditor className="font-mono" />
          <div className="mt-4 bg-gray-100 p-4 ">
            <LivePreview />
          </div>
        </div>
        <LiveError className="mt-2 bg-red-100 text-red-800" />
      </LiveProvider>
    </div>
  )
}

export default ReactLiveDisplay
