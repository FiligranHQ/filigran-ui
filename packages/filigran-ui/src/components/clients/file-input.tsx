'use client'
import {AddNotesIcon, ReadMoreIcon, TaskIcon} from 'filigran-icon'
import {useState} from 'react'
import {cn, fixedForwardRef} from '../../lib/utils'

const FileStatusDisplay = ({
  icon: Icon,
  text,
}: {
  icon: React.ElementType
  text: string
}) => (
  <div className="flex flex-col items-center justify-center pointer-events-none text-gray-700 dark:text-gray-300">
    <Icon className="h-10 w-10" />
    <p className="mt-s text-sm flex items-center justify-center text-center">
      {text}
    </p>
  </div>
)

interface FileInputProps {
  texts?: Partial<InputText>
  className?: string | undefined
  handleFileChange: (file) => void
}

interface InputText {
  dragActive?: string
  dragUnactive?: string
  fileOk?: string | null
}

const defaultTexts: InputText = {
  dragActive: 'Drop the file here',
  dragUnactive: 'Select a file',
  fileOk: 'Choosen file',
}

function GenericFileInput(
  {texts, className, handleFileChange, ...props}: FileInputProps,
  ref?: any
) {
  const [isDragActive, setIsDragActive] = useState<boolean>(false)
  const [isFileSelected, setIsFileSelected] = useState<boolean>(false)

  const textForComp: InputText = {...defaultTexts, ...texts}

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragActive(true)
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }

  const handleDragLeave = () => setIsDragActive(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragActive(false)
    setIsFileSelected(true)
    handleFileChange(e.dataTransfer.files)
  }

  const fileClicked = (e) => {
    setIsFileSelected(true)
    handleFileChange(e.target.files)
  }

  const renderIcon = () => {
    if (isFileSelected) {
      return TaskIcon
    }
    return isDragActive ? ReadMoreIcon : AddNotesIcon
  }

  const renderText = () => {
    if (isFileSelected) {
      return textForComp.fileOk
    }
    return isDragActive ? textForComp.dragActive : textForComp.dragUnactive
  }

  return (
    <div
      className={cn(
        'relative h-48 w-48 border-2 border-dashed rounded-lg flex items-center justify-center',
        className ?? '',
        isDragActive
          ? 'border-blue bg-blue-100 dark:bg-darkblue-800'
          : 'border-gray-400 bg-gray-100 dark:bg-darkblue-900'
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}>
      <input
        type={'file'}
        className="opacity-0 absolute inset-0 z-10 w-full h-full cursor-pointer"
        onChange={fileClicked}
        ref={ref}
        {...props}
      />
      <FileStatusDisplay
        icon={renderIcon()}
        text={renderText()}
      />
    </div>
  )
}

const FileInput = fixedForwardRef(GenericFileInput)
export {FileInput}
