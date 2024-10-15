import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackProvider,
  SandpackTests,
} from '@codesandbox/sandpack-react'
import {
  defaultUtils,
  sandPackTheme,
} from '@/components/code-playground/constants/sandpack'
import {FunctionComponent} from 'react'
import {testsFizzByzzCode} from '@/components/code-playground/constants/fizzbuzz'

interface PlaygroundTestProps {
  files?: {[key: string]: string}
}

export const PlaygroundTest: FunctionComponent<PlaygroundTestProps> = ({
  files,
}) => {
  return (
    <SandpackProvider
      template="react-ts"
      theme={sandPackTheme}
      files={{
        '/utils.ts': {
          code: defaultUtils,
        },
        '/app.test.ts': {
          active: true,
          code: testsFizzByzzCode,
        },
        ...files,
      }}>
      <SandpackLayout className="!mx-s !block !rounded">
        <SandpackCodeEditor
          showLineNumbers
          showInlineErrors
          showTabs
        />
        <SandpackTests />
      </SandpackLayout>
    </SandpackProvider>
  )
}
