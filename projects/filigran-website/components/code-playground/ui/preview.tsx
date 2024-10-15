import {
  SandpackConsole,
  SandpackPreview,
  SandpackTests,
} from '@codesandbox/sandpack-react'
import {cn} from '@/utils/utils'
import {FunctionComponent} from 'react'
import {CodePlaygroundMode} from '@/components/code-playground/code-playground-test'

interface PreviewProps {
  mode: CodePlaygroundMode
}
export const Preview: FunctionComponent<PreviewProps> = ({mode}) => {
  return (
    <>
      <div className="rounded-b-lg bg-zinc-900 p-4">
        <div
          className={cn(
            mode === 'result' ? 'block' : 'hidden',
            'h-full overflow-hidden rounded bg-white p-1'
          )}>
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
          />
        </div>

        <div
          className={cn(
            mode === 'console' ? 'block' : 'hidden',
            'h-full min-h-[160px] overflow-hidden rounded'
          )}>
          <SandpackConsole
            className="h-full"
            standalone
            resetOnPreviewRestart
            showHeader={false}
          />
        </div>
        <div
          className={cn(
            mode === 'tests' ? 'block' : 'hidden',
            'h-full min-h-[160px] overflow-hidden rounded'
          )}>
          <SandpackTests className="h-full" />
        </div>
      </div>
    </>
  )
}
