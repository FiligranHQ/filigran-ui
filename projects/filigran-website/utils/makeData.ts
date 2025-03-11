import {faker} from '@faker-js/faker'

export type Person = {
  id: string
  firstName: string
  lastName: string
  age: number
  visits: number
  progress: number
  description: string
  status: 'relationship' | 'complicated' | 'single'
  subRows?: Person[]
}

export interface Report {
  id: string
  name: string
  type: string
  author: string
  creator: string
  date: Date
  status: 'in progress' | 'not started' | 'done'
}

const range = (len: number) => {
  const arr: number[] = []
  for (let i = 0; i < len; i++) {
    arr.push(i)
  }
  return arr
}

const newReport = (): Report => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  type: faker.helpers.shuffle<Report['type']>([
    'Incident',
    'Report',
    'Vulnerability',
  ])[0]!,
  author: faker.person.fullName(),
  creator: faker.person.firstName(),
  date: faker.date.anytime(),
  description: faker.lorem.sentence(),
  status: faker.helpers.shuffle<Report['status']>([
    'in progress',
    'not started',
    'done',
  ])[0]!,
})

const newPerson = (): Person => {
  return {
    id: faker.string.uuid(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    age: faker.number.int(40),
    visits: faker.number.int(1000),
    progress: faker.number.int(100),
    description: faker.lorem.sentence(),
    status: faker.helpers.shuffle<Person['status']>([
      'relationship',
      'complicated',
      'single',
    ])[0]!,
  }
}

export function makeData(nbItems: number, type = 'person') {
  const makeDataLevel = (): (Person | Report)[] => {
    return range(nbItems).map((d): Report | Person => {
      return type === 'person' ? newPerson() : newReport()
    })
  }

  return makeDataLevel()
}
