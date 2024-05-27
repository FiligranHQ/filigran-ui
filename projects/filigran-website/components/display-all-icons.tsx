import * as FiligranIcon from 'filigran-icon'
import {Fragment} from 'react'

export const DisplayAllIcons = () => {
  const allIcons = Object.keys(FiligranIcon).filter((key) => key !== 'default')
  const getIcon = (icon: string) => {
    // @ts-ignore
    const Icon = FiligranIcon[icon]
    return <Icon className="h-16 w-16" />
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,_100px)] gap-4">
      {allIcons.map((icon) => (
        <div
          className="flex flex-col items-center"
          key={icon}>
          <div>{getIcon(icon)}</div>
          <label className="text-xs">{icon}</label>
        </div>
      ))}
    </div>
  )
}
