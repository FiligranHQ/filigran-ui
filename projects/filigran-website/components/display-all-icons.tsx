import * as FiligranIcon from 'filigran-icon'
import {Fragment} from 'react'

export const DisplayAllIcons = () => {
  const allIcons = Object.keys(FiligranIcon).filter((key) => key !== 'default');
    const getIcon = (icon: string) => {
    // @ts-ignore
    const Icon = FiligranIcon[icon];
    return <Icon className="w-16 h-16"/>
  }
  return <div className="grid gap-4 grid-cols-[repeat(auto-fill,_100px)]">
    {allIcons.map((icon) => <div className="flex flex-col items-center" key={icon}>
      <div>{getIcon(icon)}</div>
      <label className="text-xs">{icon}</label>
    </div>)}
  </div>
}
