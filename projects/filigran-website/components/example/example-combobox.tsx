'use client'

import * as React from 'react'

import {Combobox} from 'filigran-ui/clients'
import {Button} from 'filigran-ui'
import ReactLiveDisplay from '@/components/react-live/ReactLiveDisplay'

export function ExampleCombobox() {
  const [selectedValue, setSelectedValue] = React.useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    console.log('Selected value:', selectedValue)
  }

  const setInputValue = (value: string) => {
    console.log('input value: ', value)
  }
  return (
    <>
      <h1>Combobox Example</h1>
      <form onSubmit={handleSubmit}>
        <Combobox
          className="w-[200px]"
          dataTab={[
            {value: 'abcd', label: 'Abcd'},
            {
              value: 'acde',
              label: 'Acde',
            },
            {value: 'acef', label: 'Acef'},
          ]}
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

      <h2>How to use this loader </h2>

      <h3>Props</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>dataTab</strong>
            </td>
            <td>
              <em>Array(label: string, value: string)</em>
            </td>
            <td>[]</td>
            <td>This is the data to display in the combobox.</td>
          </tr>
          <tr>
            <td>
              <strong>order</strong>
            </td>
            <td>
              <em>string</em>
            </td>
            <td>-</td>
            <td>The title when the combobox is closed.</td>
          </tr>
          <tr>
            <td>
              <strong>placeholder</strong>
            </td>
            <td>
              <em>string</em>
            </td>
            <td>-</td>
            <td>The placeholder when the combobox is closed.</td>
          </tr>
          <tr>
            <td>
              <strong>emptyCommand</strong>
            </td>
            <td>
              <em>string</em>
            </td>
            <td>-</td>
            <td>
              The displayed string when the input value does not fit the
              possibilities.{' '}
            </td>
          </tr>
          <tr>
            <td>
              <strong>onValueChange</strong>
            </td>
            <td>
              <em>() => void</em>
            </td>
            <td>-</td>
            <td>
              The triggered function when a value is choosen.
            </td>
          </tr>
          <tr>
              <td>
                  <strong>onInputChange</strong>
              </td>
              <td>
                  <em>() => void</em>
              </td>
              <td>-</td>
              <td>
                  The triggered function when the input changes.
              </td>
          </tr>

          <tr>
              <td>
                  <strong>value</strong>
              </td>
              <td>
                  <em>string</em>
              </td>
              <td>-</td>
              <td>
                  The selectedValue.
              </td>
          </tr>
        </tbody>
      </table>

      <h3>Playground</h3>
      <p className="italic">Import from filigran-ui : </p>
      <span>{'import { Combobox } from "filigran-ui"'}</span>
      <ReactLiveDisplay
        displayError={false}
        codeExample={`<Combobox dataTab={[
            {value: 'abcd', label: 'Abcd'},
            {
              value: 'acde',
              label: 'Acde'
            },
            {value: 'acef', label: 'Acef'}
          ]}
          order={'Choose a value'}
          placeholder={'Choose a value'}
          emptyCommand={'Not found'}
          onValueChange={(value) => setSelectedValue(value)}
          onInputChange={(value) => setInputValue(value)}
          value={selectedValue}/>`}
      />
    </>
  )
}
