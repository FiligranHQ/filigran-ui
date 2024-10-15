'use client'
import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackProvider,
} from '@codesandbox/sandpack-react'
import {FunctionComponent, useState} from 'react'
import {
  defaultApp,
  defaultUtils,
  indexCode,
  sandPackTheme,
  testsCode,
} from '@/components/code-playground/constants/sandpack'
import {TitleBar} from '@/components/code-playground/ui/title-bar'
import {Actions} from '@/components/code-playground/ui/actions'
import {Preview} from '@/components/code-playground/ui/preview'
interface CodePlaygroundProps {
  files?: {[key: string]: string}
}

export type CodePlaygroundMode = 'result' | 'tests' | 'console'
export const CodePlaygroundTest: FunctionComponent<CodePlaygroundProps> = ({
  files,
}) => {
  const [mode, setMode] = useState<CodePlaygroundMode>('result')

  const previewProps = {
    mode,
    setMode,
  }
  return (
    <SandpackProvider
      template="react-ts"
      customSetup={{
        dependencies: {
          'filigran-ui': 'latest',
          'filigran-icon': 'latest',
          'lucide-react': '0.399.0',
          zod: 'latest',
          '@testing-library/react': 'latest',
          '@testing-library/dom': 'latest',
        },
        devDependencies: {
          '@types/react-dom': 'latest',
          '@types/mocha': 'latest',
        },
      }}
      options={{
        externalResources: [
          'https://cdn.tailwindcss.com',
          'https://fonts.googleapis.com/css2?family=Geologica:wght@100..900&display=swap',
          'https://fonts.googleapis.com/css2?family=Geologica:wght@100..900&family=IBM+Plex+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet',
        ],
      }}
      theme={sandPackTheme}
      files={{
        '/App.tsx': {
          code: defaultApp,
        },
        '/utils.ts': {
          code: defaultUtils,
        },
        '/index.tsx': {
          code: indexCode,
          hidden: true,
        },
        '/app.test.tsx': {
          active: true,
          code: testsCode,
        },
        ...files,
      }}>
      <SandpackLayout className="!mx-s !block !rounded">
        <TitleBar />
        <div className="flex flex-col lg:flex-row">
          <SandpackCodeEditor
            className="flex-1"
            showLineNumbers
            showInlineErrors
            showTabs
          />
          <div className="flex flex-1 flex-col">
            <Actions {...previewProps} />
            <Preview {...previewProps} />
          </div>
        </div>
      </SandpackLayout>
    </SandpackProvider>
  )
}
