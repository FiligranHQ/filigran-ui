'use client'
import * as FiligranIcon from 'filigran-icon'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  useToast,
} from 'filigran-ui'
import {ArrowPreviousIcon} from 'filigran-icon'

export const DisplayAllIcons = () => {
  const {toast} = useToast()

  const allIcons = Object.keys(FiligranIcon).filter((key) => key !== 'default')
  const getIcon = (icon: string) => {
    // @ts-ignore
    const Icon = FiligranIcon[icon]
    return <Icon className="h-16 w-16" />
  }
  const onClickCopy = (icon: string, fullImport: boolean = false) => {
    const stringValueToCopy = fullImport
      ? `import { ${icon} } from 'filigran-icon'`
      : icon
    navigator.clipboard.writeText(stringValueToCopy)
    toast({
      title: 'Copied !',
      description: 'Value copied to clipboard',
    })
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,_100px)] gap-4">
      {allIcons.map((icon) => (
        <AlertDialog key={icon}>
          <AlertDialogTrigger asChild>
            {
              <div
                className="flex flex-col items-center hover:cursor-pointer"
                key={icon}>
                <div>{getIcon(icon)}</div>
                <label className="text-xs">{icon}</label>
              </div>
            }
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Icon : {icon}</AlertDialogTitle>
              <div className="mx-auto flex w-1/2 items-center justify-center rounded bg-gray-150 p-xxl">
                {getIcon(icon)}
              </div>
            </AlertDialogHeader>
            <div>
              <div className="flex flex-row items-center align-middle">
                <div className="rounded bg-gray-1000 p-s text-gray-50">{`import { ${icon} } from "filigran-icon"`}</div>{' '}
                <Button
                  variant={'ghost'}
                  aria-label={'Copy value to clipboard'}
                  onClick={() => onClickCopy(icon, true)}>
                  Copy
                </Button>
              </div>
              <div className="flex flex-row items-center align-middle">
                <div className="rounded bg-gray-1000 p-s text-gray-50">
                  {icon}
                </div>{' '}
                <Button
                  variant={'ghost'}
                  aria-label={'Copy value to clipboard'}
                  onClick={() => onClickCopy(icon)}>
                  Copy
                </Button>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogAction>{'Close'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ))}
    </div>
  )
}
