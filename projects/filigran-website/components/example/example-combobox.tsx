'use client'

import * as React from 'react'

import {Combobox, ComboboxItem} from 'filigran-ui/clients'
import {Button} from 'filigran-ui'
import ReactLiveDisplay from '@/components/react-live/ReactLiveDisplay'

interface ComboboxInterfaceTest {
  id: number,
  testValue: string,
  testLabel: string
}
export function ExampleCombobox() {
  const [selectedValue, setSelectedValue] = React.useState<{id: number, value: string, label: string} | undefined>(undefined)


  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    console.log('Selected value:', selectedValue)
  }

  const setInputValue = (value: string) => {
    console.log('input value: ', value)
  }


  const [selectedValue2, setSelectedValue2] = React.useState<ComboboxInterfaceTest | undefined>(undefined)

  const setInputValue2 = (value: string) => {
    console.log('input value: ', value)
  }

  const handleSubmit2 = (event: React.FormEvent) => {
    event.preventDefault()
    console.log('Selected value:', selectedValue2)
  }

  return (
    <>
      <h1>Combobox Example</h1>
      <form onSubmit={handleSubmit}>
        <Combobox
          className="w-[200px]"
          dataTab={
            [
              {id: 1, value: 'abcd', label: 'Abcd'},
              {
                id: 2,
                value: 'acde',
                label: 'Acde',
              },
              {id: 3, value: 'acef', label: 'Acef'},
            ]
          }
          order={'Choose a value'}
          placeholder={'Choose a value'}
          emptyCommand={'Not found'}
          onValueChange={(value) => setSelectedValue(value)}
          onInputChange={(value) => setInputValue(value)}
          value={selectedValue}
        />
        <Button
          className={'ml-2'}
          type="submit">
          Submit
        </Button>
      </form>

      <form onSubmit={handleSubmit2} className="pt-s">
        <Combobox
          className="w-[200px]"
          dataTab={
            [
              {id: 1, testLabel: 'abcd', testValue: 'Abcd'},
              {
                id: 2,
                testValue: 'acde',
                testLabel: 'Acde',
              },
              {id: 3, testValue: 'acef', testLabel: 'Acef'},
            ]
          }
          order={'Choose a value'}
          placeholder={'Choose a value'}
          emptyCommand={'Not found'}
          onValueChange={(value) => setSelectedValue2(value)}
          onInputChange={(value) => setInputValue2(value)}
          value={selectedValue2}
          keyValue={'testValue'}
          keyLabel={'testLabel'}
        />
        <Button
          className={'ml-2'}
          type="submit">
          Submit
        </Button>
      </form>


    </>
  )
}
