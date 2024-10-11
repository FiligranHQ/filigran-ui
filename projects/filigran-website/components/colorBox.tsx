'use client'
import * as React from 'react'
import {useToast} from 'filigran-ui'

interface ColorBoxProps {
  colorName: string
  colorValue: string
  colorBackground: string
  primary: boolean
  selectedColor: ({
    colorBackground,
    colorValue,
  }: {
    colorBackground: string
    colorValue: string
  }) => void
}
const ColorBox: React.FunctionComponent<ColorBoxProps> = ({
  colorName,
  colorValue,
  colorBackground,
  primary = false,
  selectedColor,
}) => {
  const {toast} = useToast()
  const onClick = (value: string) => {
    navigator.clipboard.writeText('#' + value)
    toast({
      title: 'Copied !',
      description: 'Value copied to clipboard',
    })
    selectedColor({colorBackground: colorBackground, colorValue: colorValue})
  }
  return (
    <div
      className={`w-20 flex-col hover:cursor-pointer`}
      onClick={() => onClick(colorValue)}>
      <div
        className={`mr-xs h-10 w-10 rounded border-black ${colorBackground || ''} ${primary ? 'border-4' : 'border'} `}
      />
      <div className="font-bold">{colorName}</div>
      <div className="text-xs text-slate-400">#{colorValue}</div>
    </div>
  )
}
export default ColorBox
