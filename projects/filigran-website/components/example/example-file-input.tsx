'use client'
import React, {useRef, useState} from 'react'
import {FileInput} from 'filigran-ui/clients'
const ExampleFileInput = () => {
  const fileInputRef = useRef(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      console.log('Fichier sélectionné :', files[0])
      setFileName(files[0].name)
    }
  }

  return (
    <div className="my-8">
      <FileInput
        handleFileChange={handleFileChange}
        ref={fileInputRef}
        texts={{
          dragUnactive: 'Select a fileX',
          fileOk: fileName ?? '',
        }}
      />
    </div>
  )
}

export default ExampleFileInput
