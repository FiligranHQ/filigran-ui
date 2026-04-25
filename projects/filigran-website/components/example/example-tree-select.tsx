'use client'
import {useState} from 'react'
import {TreeSelect} from '@filigran/ui/clients'
import type {TreeSelectOption} from '@filigran/ui/clients'

const treeOptions: TreeSelectOption[] = [
  {
    id: 'frontend',
    text: 'Frontend',
    children: [
      {id: 'react', text: 'React'},
      {id: 'vue', text: 'Vue.js'},
      {id: 'angular', text: 'Angular'},
      {id: 'svelte', text: 'Svelte'},
    ],
  },
  {
    id: 'backend',
    text: 'Backend',
    children: [
      {id: 'node', text: 'Node.js'},
      {id: 'python', text: 'Python'},
      {id: 'go', text: 'Go'},
      {id: 'rust', text: 'Rust'},
    ],
  },
  {
    id: 'database',
    text: 'Database',
    children: [
      {id: 'postgres', text: 'PostgreSQL'},
      {id: 'mysql', text: 'MySQL'},
      {id: 'mongo', text: 'MongoDB'},
    ],
  },
  {
    id: 'devops',
    text: 'DevOps',
  },
]

export function ExampleTreeSelect() {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([])

  return (
    <div className="w-1/2 space-y-4">
      <TreeSelect
        options={treeOptions}
        selectedGroupIds={selectedGroupIds}
        selectedChildIds={selectedChildIds}
        onSelectionChange={(groupIds, childIds) => {
          setSelectedGroupIds(groupIds)
          setSelectedChildIds(childIds)
        }}
        placeholder="Select technologies..."
        searchPlaceholder="Search technologies..."
      />
      <div className="text-sm text-muted-foreground">
        <p>Groups: {selectedGroupIds.join(', ') || 'none'}</p>
        <p>Children: {selectedChildIds.join(', ') || 'none'}</p>
      </div>
    </div>
  )
}
