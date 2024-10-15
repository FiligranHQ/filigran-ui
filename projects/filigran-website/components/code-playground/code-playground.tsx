import {Sandpack} from '@codesandbox/sandpack-react'
import {FunctionComponent} from 'react'
import {
  defaultApp,
  indexCode,
  sandPackTheme,
} from '@/components/code-playground/constants/sandpack'
interface CodePlaygroundProps {
  files?: {[key: string]: string}
}

export const CodePlayground: FunctionComponent<CodePlaygroundProps> = ({
  files,
}) => {
  return (
    <Sandpack
      template="react-ts"
      customSetup={{
        dependencies: {
          'filigran-ui': 'latest',
          'filigran-icon': 'latest',
          'lucide-react': '0.399.0',
          zod: 'latest',
        },
      }}
      options={{
        showLineNumbers: true,
        showInlineErrors: true,
        resizablePanels: true,
        showTabs: true,
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
        '/index.tsx': {
          code: indexCode,
          hidden: true,
        },
        ...files,
      }}
    />
  )
}
