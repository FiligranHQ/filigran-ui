import {
  Sandpack,
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  SandpackTests,
} from '@codesandbox/sandpack-react'
import {nightOwl} from '@codesandbox/sandpack-themes'
import {FunctionComponent} from 'react'
import {
  defaultApp,
  defaultUtils,
  indexCode,
  testsCode,
} from '@/components/code-playground/constants/sandpack'
interface CodePlaygroundProps {
  files?: {[key: string]: string}
}

export const CodePlaygroundTest: FunctionComponent<CodePlaygroundProps> = ({
  files,
}) => {
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
      theme={nightOwl}
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
      <SandpackLayout>
        <SandpackCodeEditor
          showLineNumbers
          showInlineErrors
          showTabs
        />
        <SandpackPreview />
        <SandpackTests />
      </SandpackLayout>
    </SandpackProvider>
  )
}
