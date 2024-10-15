'use client'
import {FunctionComponent, useEffect, useState} from 'react'
import {
  RefreshIcon,
  useSandpack,
  useSandpackNavigation,
} from '@codesandbox/sandpack-react'
import {cn} from '@/utils/utils'
import {RefreshCw} from 'lucide-react'
import {CodePlaygroundMode} from '@/components/code-playground/code-playground-test'

interface ConsoleProps {
  mode: CodePlaygroundMode
  setMode: (mode: CodePlaygroundMode) => void
}

export const Actions: FunctionComponent<ConsoleProps> = ({mode, setMode}) => {
  const [reloading, setReloading] = useState(false)
  const {sandpack, listen} = useSandpack()
  const {refresh} = useSandpackNavigation()
  const activeClass = 'border-b border-amber-500'
  useEffect(() => {
    // listens for any message dispatched between sandpack and the bundler
    const stopListening = listen((msg) => {
      // @ts-ignore
      if (msg?.status === 'idle') {
        setReloading(false)
      }
    })

    return () => {
      // unsubscribe
      stopListening()
    }
  }, [listen])
  return (
    <div className="flex items-center justify-between border border-zinc-700 bg-zinc-900 px-3">
      <div className="space-x-l">
        <button
          className={cn('py-m', mode === 'result' ? activeClass : null)}
          onClick={() => setMode('result')}>
          Preview
        </button>
        <button
          className={cn('py-m', mode === 'tests' ? activeClass : null)}
          onClick={() => setMode('tests')}>
          Tests
        </button>
        <button
          className={cn('py-m', mode === 'console' ? activeClass : null)}
          onClick={() => setMode('console')}>
          Console
        </button>
      </div>
      <div>
        <button
          onClick={() => {
            setReloading(true)
            refresh()
          }}
          disabled={sandpack?.status === 'idle'}>
          <RefreshCw
            className={cn(
              'h-5 w-5 text-zinc-400',
              reloading && 'animate-spin',
              sandpack?.status === 'idle' && 'text-zinc-600'
            )}
          />
        </button>
      </div>
    </div>
  )
}
