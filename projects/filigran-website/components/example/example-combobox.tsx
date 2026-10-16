'use client'

import * as React from 'react'

import {Combobox} from '@filigran/ui/clients'
import {Button} from '@filigran/ui'

interface ComboboxInterfaceTest {
  id: number
  testValue: string
  testLabel: string
}

interface ComboboxUser {
  userId: string
  displayName: string
  email: string
}

// Simulates a server-side search endpoint: it also matches on `email`, which is
// never rendered as a label, so results could not come from client-side filtering
const allUsers: ComboboxUser[] = [
  {
    userId: 'usr_8f2a91',
    displayName: 'Ada Lovelace',
    email: 'ada@analytical-engine.org',
  },
  {
    userId: 'usr_4c7e02',
    displayName: 'Grace Hopper',
    email: 'grace@cobol.navy',
  },
  {
    userId: 'usr_1b9d33',
    displayName: 'Katherine Johnson',
    email: 'katherine@orbital-mechanics.gov',
  },
  {
    userId: 'usr_6e0a54',
    displayName: 'Margaret Hamilton',
    email: 'margaret@apollo-guidance.gov',
  },
]

const searchUsers = (search: string) => {
  const term = search.toLowerCase()
  return allUsers.filter(
    (user) =>
      user.displayName.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term)
  )
}

export function ExampleCombobox() {
  const [selectedValue, setSelectedValue] = React.useState<
    {id: number; value: string; label: string} | undefined
  >(undefined)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    console.log('Selected value:', selectedValue)
  }

  const setInputValue = (value: string) => {
    console.log('input value: ', value)
  }

  const [selectedValue2, setSelectedValue2] = React.useState<
    ComboboxInterfaceTest | undefined
  >(undefined)

  const setInputValue2 = (value: string) => {
    console.log('input value: ', value)
  }

  const handleSubmit2 = (event: React.FormEvent) => {
    event.preventDefault()
    console.log('Selected value:', selectedValue2)
  }

  const [selectedUser, setSelectedUser] = React.useState<
    ComboboxUser | undefined
  >(undefined)
  const [users, setUsers] = React.useState<ComboboxUser[]>(allUsers)

  const handleUserSearch = (value: string) => {
    setUsers(searchUsers(value))
  }

  const handleSubmit3 = (event: React.FormEvent) => {
    event.preventDefault()
    console.log('Selected user:', selectedUser)
  }

  return (
    <>
      <h1>Combobox Example</h1>
      <form onSubmit={handleSubmit}>
        <Combobox
          className="w-[200px]"
          dataTab={[
            {id: 1, value: 'abcd', label: 'Abcd'},
            {
              id: 2,
              value: 'acde',
              label: 'Acde',
            },
            {id: 3, value: 'acef', label: 'Acef'},
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

      <form
        onSubmit={handleSubmit2}
        className="pt-s">
        <Combobox
          className="w-[200px]"
          dataTab={[
            {id: 1, testValue: 'usr_8f2a91', testLabel: 'Ada Lovelace'},
            {
              id: 2,
              testValue: 'usr_4c7e02',
              testLabel: 'Grace Hopper',
            },
            {id: 3, testValue: 'usr_1b9d33', testLabel: 'Katherine Johnson'},
          ]}
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

      <form
        onSubmit={handleSubmit3}
        className="pt-s">
        <Combobox
          className="w-[200px]"
          dataTab={users}
          order={'Search a user'}
          placeholder={'Name or email (try "cobol")'}
          emptyCommand={'No user found'}
          onValueChange={(value) => setSelectedUser(value)}
          onInputChange={handleUserSearch}
          value={selectedUser}
          keyValue={'userId'}
          keyLabel={'displayName'}
          shouldFilter={false}
        />
        <Button
          className={'ml-2'}
          type="submit">
          Submit
        </Button>
      </form>

      <form className="pt-s">
        <Combobox
          className="w-[200px]"
          dataTab={allUsers}
          order={'Disabled'}
          placeholder={'Search a user'}
          emptyCommand={'No user found'}
          onValueChange={() => {}}
          value={allUsers[0]}
          keyValue={'userId'}
          keyLabel={'displayName'}
          disabled
        />
      </form>
    </>
  )
}
