import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  SandpackTests,
} from '@codesandbox/sandpack-react'
import {atomDark} from '@codesandbox/sandpack-themes'
import {FunctionComponent} from 'react'

interface CodePlaygroundProps {
  test?: boolean
  files?: {[key: string]: string}
}

export const CodePlayground: FunctionComponent<CodePlaygroundProps> = ({
  test = false,
  files,
}) => {
  return (
    <SandpackProvider
      template="react"
      theme={atomDark}
      files={files}>
      <SandpackLayout>
        <SandpackCodeEditor />
        <SandpackPreview />
        {test && <SandpackTests />}
      </SandpackLayout>
    </SandpackProvider>
  )
}
