'use client'

import * as React from 'react'

import {Combobox} from 'filigran-ui/clients'
import {Button} from 'filigran-ui'

export function ExampleCombobox() {
  const [selectedValue, setSelectedValue] = React.useState('acef')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    console.log('Selected value:', selectedValue)
  }

  const setInputValue = (value: string) => {
    console.log('input value: ', value)
  }
  return (
    <form onSubmit={handleSubmit}>
      <Combobox
        dataTab={[
          {value: 'abcd', label: 'Abcd'},
          {
            value: 'acde',
            label: 'Acde',
          },
          {value: 'acef', label: 'Acef'},
        ]}
        order={'Choose'}
        placeholder={'Choose a value'}
        emptyCommand={'Not found'}
        onValueChange={(value) => setSelectedValue(value)}
        onInputChange={(value) => setInputValue(value)}
        value={selectedValue}
      />
      <Button
        className={'ml-2'}
        variant={'default'}
        type="submit">
        Submit
      </Button>
    </form>
  )
}
