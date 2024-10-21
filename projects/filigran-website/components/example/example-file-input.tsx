'use client'
import React, {useRef, useState} from 'react'
import {FileInput} from 'filigran-ui/clients'
const ExampleFileInput = () => {
  const fileInputRef = useRef(null)

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      console.log('Fichier sélectionné :', files[0])
    }
  }

  return (
    <div className="my-8">
      <FileInput
        allowedTypes={
          'image/*,application/pdf,video/*,application/msword,application/zip,application/json'
        }
        handleFileChange={handleFileChange}
        ref={fileInputRef}
        texts={{
          selectFile: 'Select a fileX',
        }}
      />
    </div>
  )
}

export default ExampleFileInput
