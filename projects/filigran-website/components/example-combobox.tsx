'use client'

import * as React from 'react'

import {Combobox} from 'filigran-ui/clients'

export function ExampleCombobox() {
  return (
    <Combobox
      dataTab={[
        {value: 'essai2', label: 'Essai2'},
        {
          value: 'eqsai1',
          label: 'Eqsai1',
        },
        {value: 'eqai1', label: 'Eqai1'},
      ]}
      order={'essai1'}
      placeholder={'placeholder'}
      emptyCommand={'ya pas'}
    />
  )
}
