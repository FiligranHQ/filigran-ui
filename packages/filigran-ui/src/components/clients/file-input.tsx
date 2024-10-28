'use client'
import {ReadMoreIcon} from 'filigran-icon'
import {
  createContext,
  useContext,
  useRef,
  useState,
  type FunctionComponent,
  type ReactNode,
} from 'react'
import {useFormContext} from 'react-hook-form'
import {cn, fixedForwardRef} from '../../lib/utils'
import {Button} from '../servers'

interface FileInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  texts?: Partial<InputText>
  allowedTypes?: string
  value?: unknown
  name: string
}

interface InputText {
  selectFile: string
  noFile: string
  dropFiles: string
}

const defaultTexts: InputText = {
  selectFile: 'Select a file',
  noFile: 'No file selected',
  dropFiles: 'Drop files here',
}

interface FileInputContextProps {
  isDragActive: boolean
  setIsDragActive: React.Dispatch<React.SetStateAction<boolean>>
}
const FileInputContext = createContext<FileInputContextProps>({
  isDragActive: false,
  setIsDragActive: () => {},
})

const FileInputDropZone: FunctionComponent<{
  children: ReactNode
  className?: string
}> = ({children, className}) => {
  const [isDragActive, setIsDragActive] = useState<boolean>(false)
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragActive(true)
    e.preventDefault()
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragActive(true)
    e.preventDefault()
  }

  return (
    <FileInputContext.Provider value={{isDragActive, setIsDragActive}}>
      <div
        className={cn('relative', className)}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}>
        {children}
      </div>
    </FileInputContext.Provider>
  )
}

function GenericFileInput(
  {texts, allowedTypes, className, ...props}: FileInputProps,
  ref?: any
) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const {isDragActive, setIsDragActive} = useContext(FileInputContext)
  const t: InputText = {...defaultTexts, ...texts}
  const form = useFormContext()
  const filesSelected = form.getValues(props.name) as FileList

  const setValueFileInput = (files: FileList) => {
    if (props.name) {
      form.setValue(props.name, files)
    }
    form.clearErrors(props.name)
  }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragActive(false)
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragActive(false)
    const files = e.dataTransfer.files
    const extension = e.dataTransfer.files[0].name.split('.')[1]

    if (allowedTypes && !allowedTypes.includes(extension)) {
      form.setError(props.name, {
        message: 'Format not accepted',
      })
      return
    }
    if (!props.multiple && files.length > 1) {
      form.setError(props.name, {
        message: 'You can only select one file',
      })
      return
    }
    setValueFileInput(files)
  }

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setValueFileInput(files)
    }
  }

  // Need to get error input but the value on fileInput is only taking string;
  const {value, ...propsWithoutValue} = props
  const arraySelectedFile: File[] | null = filesSelected
    ? Array.from(filesSelected)
    : null
  return (
    <div ref={ref}>
      <input
        type={'file'}
        className="hidden"
        accept={allowedTypes}
        ref={inputRef}
        {...propsWithoutValue}
        onChange={handleOnChange}
      />
      <Button
        type="button"
        onClick={() => inputRef.current && inputRef.current.click()}>
        {t.selectFile}
      </Button>
      <span className="p-s">
        {arraySelectedFile
          ? arraySelectedFile.map((file: File) => file.name).join(', ')
          : t.noFile}
      </span>
      <div
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'z-0 absolute inset-0 bg-primary/30 text-primary-foreground flex gap-s flex-col items-center justify-center',
          isDragActive ? 'flex' : 'hidden'
        )}>
        <ReadMoreIcon className="w-10 h-10" />
        {t.dropFiles}
      </div>
    </div>
  )
}

const FileInput = fixedForwardRef(GenericFileInput)
export {FileInput, FileInputDropZone}
