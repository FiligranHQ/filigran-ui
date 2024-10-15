import {Eraser, SquareArrowOutUpRight} from 'lucide-react'
import {
  UnstyledOpenInCodeSandboxButton,
  useSandpack,
} from '@codesandbox/sandpack-react'

export const TitleBar = ({title = 'Code Playground'}) => {
  const {sandpack} = useSandpack()
  const {resetAllFiles} = sandpack
  return (
    <div className="mb-0 flex items-center justify-between bg-zinc-700 px-3 py-2 sm:rounded-t-lg">
      <span className="text-sm font-bold text-white">{title}</span>
      <span className="align-center flex">
        <button
          className=""
          onClick={() => resetAllFiles()}>
          <Eraser className="mr-4 h-5 w-5 text-zinc-300" />
        </button>
        <UnstyledOpenInCodeSandboxButton className="relative -top-[1px]">
          <SquareArrowOutUpRight className="h-5 w-5 text-zinc-300" />
        </UnstyledOpenInCodeSandboxButton>
      </span>
    </div>
  )
}
