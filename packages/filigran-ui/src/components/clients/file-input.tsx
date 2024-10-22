'use client'
import {useState} from 'react'
import {fixedForwardRef} from '../../lib/utils'
import {Button} from '../servers'

interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  texts?: Partial<InputText>
  allowedTypes: string
  handleFileChange: (file: FileList | null) => void
}

interface InputText {
  selectFile: string
  noFile: string
}

const defaultTexts: InputText = {
  selectFile: 'Select a file',
  noFile: 'No file selected',
}

function GenericFileInput(
  {texts, allowedTypes, className, handleFileChange, ...props}: FileInputProps,
  ref?: any
) {
  const [fileSelected, setFileSelected] = useState<File | null>(null)
  const textForComp: InputText = {...defaultTexts, ...texts}
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const hasExtension = e.dataTransfer.files[0].name.includes('.')

    if (
      !allowedTypes?.includes(e.dataTransfer.files[0].type) ||
      !hasExtension
    ) {
      return
    }

    setFileSelected(e.dataTransfer.files[0])
    handleFileChange(e.dataTransfer.files)
  }

  const fileClicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileSelected(e.target?.files?.[0] ?? null)
    handleFileChange(e.target.files)
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}>
      <input
        accept={allowedTypes}
        type={'file'}
        className="hidden"
        onChange={fileClicked}
        ref={ref}
        {...props}
      />
      <Button
        type="button"
        onClick={() => ref.current && ref.current.click()}>
        <>{textForComp?.selectFile}</>
      </Button>{' '}
      {fileSelected?.name ?? textForComp.noFile}
    </div>
  )
}

const FileInput = fixedForwardRef(GenericFileInput)
export {FileInput}
