'use client'
import * as React from 'react'
import ColorBox from '@/components/colorBox'
import {useState} from 'react'
import {Button} from 'filigran-ui'
import {HomeIcon} from 'lucide-react'

export function Colors() {
  const grayPalette = [
    {
      colorName: 'gray',
      colorValue: 'cacbce',
      colorBackground: 'bg-gray',
      primary: true,
    },
    {
      colorName: '50',
      colorValue: 'f4f4f6',
      colorBackground: 'bg-gray-50',
      primary: false,
    },
    {
      colorName: '100',
      colorValue: 'f2f2f3',
      colorBackground: 'bg-gray-100',
      primary: false,
    },
    {
      colorName: '150',
      colorValue: 'e4e5e7',
      colorBackground: 'bg-gray-150',
      primary: false,
    },
    {
      colorName: '200',
      colorValue: 'cacbce',
      colorBackground: 'bg-gray-200',
      primary: true,
    },
    {
      colorName: '300',
      colorValue: 'afb0b6',
      colorBackground: 'bg-gray-300',
      primary: false,
    },
    {
      colorName: '400',
      colorValue: '95969d',
      colorBackground: 'bg-gray-400',
      primary: false,
    },
    {
      colorName: '500',
      colorValue: '7a7c85',
      colorBackground: 'bg-gray-500',
      primary: false,
    },
    {
      colorName: '600',
      colorValue: '62636a',
      colorBackground: 'bg-gray-600',
      primary: false,
    },
    {
      colorName: '700',
      colorValue: '494a50',
      colorBackground: 'bg-gray-700',
      primary: false,
    },
    {
      colorName: '800',
      colorValue: '313235',
      colorBackground: 'bg-gray-800',
      primary: false,
    },
    {
      colorName: '900',
      colorValue: '18191b',
      colorBackground: 'bg-gray-900',
      primary: false,
    },
    {
      colorName: '1000',
      colorValue: '00020c',
      colorBackground: 'bg-gray-1000',
      primary: false,
    },
  ]
  const darkbluePalette = [
    {
      colorName: 'darkblue',
      colorValue: '0015a8',
      colorBackground: 'bg-darkblue',
      primary: true,
    },
    {
      colorName: '100',
      colorValue: 'dbe0ff',
      colorBackground: 'bg-darkblue-100',
      primary: false,
    },
    {
      colorName: '200',
      colorValue: 'a8b3ff',
      colorBackground: 'bg-darkblue-200',
      primary: false,
    },
    {
      colorName: '300',
      colorValue: '7586ff',
      colorBackground: 'bg-darkblue-300',
      primary: false,
    },
    {
      colorName: '400',
      colorValue: '425aff',
      colorBackground: 'bg-darkblue-400',
      primary: false,
    },
    {
      colorName: '500',
      colorValue: '0f2dff',
      colorBackground: 'bg-darkblue-500',
      primary: false,
    },
    {
      colorName: '600',
      colorValue: '001bdb',
      colorBackground: 'bg-darkblue-600',
      primary: false,
    },
    {
      colorName: '700',
      colorValue: '0015a8',
      colorBackground: 'bg-darkblue-700',
      primary: true,
    },
    {
      colorName: '800',
      colorValue: '000f75',
      colorBackground: 'bg-darkblue-800',
      primary: false,
    },
    {
      colorName: '900',
      colorValue: '000842',
      colorBackground: 'bg-darkblue-900',
      primary: false,
    },
  ]
  const bluePalette = [
    {
      colorName: 'blue',
      colorValue: '0099cc',
      colorBackground: 'bg-blue',
      primary: true,
    },
    {
      colorName: '100',
      colorValue: 'ccf2ff',
      colorBackground: 'bg-blue-100',
      primary: false,
    },
    {
      colorName: '200',
      colorValue: 'b3ecff',
      colorBackground: 'bg-blue-200',
      primary: false,
    },
    {
      colorName: '300',
      colorValue: '80d7ff',
      colorBackground: 'bg-blue-300',
      primary: false,
    },
    {
      colorName: '400',
      colorValue: '4cccff',
      colorBackground: 'bg-blue-400',
      primary: false,
    },
    {
      colorName: '500',
      colorValue: '0099cc',
      colorBackground: 'bg-blue-500',
      primary: true,
    },
    {
      colorName: '600',
      colorValue: '007399',
      colorBackground: 'bg-blue-600',
      primary: false,
    },
    {
      colorName: '700',
      colorValue: '006080',
      colorBackground: 'bg-blue-700',
      primary: false,
    },
    {
      colorName: '800',
      colorValue: '004d66',
      colorBackground: 'bg-blue-800',
      primary: false,
    },
    {
      colorName: '900',
      colorValue: '003242',
      colorBackground: 'bg-blue-900',
      primary: false,
    },
  ]
  const turquoisePalette = [
    {
      colorName: 'turquoise',
      colorValue: '00f0bc',
      colorBackground: 'bg-turquoise',
      primary: true,
    },
    {
      colorName: '100',
      colorValue: 'bdffed',
      colorBackground: 'bg-turquoise-100',
      primary: false,
    },
    {
      colorName: '200',
      colorValue: '80ffdd',
      colorBackground: 'bg-turquoise-200',
      primary: false,
    },
    {
      colorName: '300',
      colorValue: '52ffd1',
      colorBackground: 'bg-turquoise-300',
      primary: false,
    },
    {
      colorName: '400',
      colorValue: '1fffc3',
      colorBackground: 'bg-turquoise-400',
      primary: false,
    },
    {
      colorName: '500',
      colorValue: '00f0bc',
      colorBackground: 'bg-turquoise-500',
      primary: true,
    },
    {
      colorName: '600',
      colorValue: '00bd94',
      colorBackground: 'bg-turquoise-600',
      primary: false,
    },
    {
      colorName: '700',
      colorValue: '009474',
      colorBackground: 'bg-turquoise-700',
      primary: false,
    },
    {
      colorName: '800',
      colorValue: '005744',
      colorBackground: 'bg-turquoise-800',
      primary: false,
    },
    {
      colorName: '900',
      colorValue: '00241c',
      colorBackground: 'bg-turquoise-900',
      primary: false,
    },
  ]
  const greenPalette = [
    {
      colorName: 'green',
      colorValue: '20cb28',
      colorBackground: 'bg-green',
      primary: true,
    },
    {
      colorName: '100',
      colorValue: 'c8f9ca',
      colorBackground: 'bg-green-100',
      primary: false,
    },
    {
      colorName: '200',
      colorValue: '91f396',
      colorBackground: 'bg-green-200',
      primary: false,
    },
    {
      colorName: '300',
      colorValue: '72e978',
      colorBackground: 'bg-green-300',
      primary: false,
    },
    {
      colorName: '400',
      colorValue: '41e149',
      colorBackground: 'bg-green-400',
      primary: false,
    },
    {
      colorName: '500',
      colorValue: '20cb28',
      colorBackground: 'bg-green-500',
      primary: true,
    },
    {
      colorName: '600',
      colorValue: '17ab1f',
      colorBackground: 'bg-green-600',
      primary: false,
    },
    {
      colorName: '700',
      colorValue: '117916',
      colorBackground: 'bg-green-700',
      primary: false,
    },
    {
      colorName: '800',
      colorValue: '094e0b',
      colorBackground: 'bg-green-800',
      primary: false,
    },
    {
      colorName: '900',
      colorValue: '083a0a',
      colorBackground: 'bg-green-900',
      primary: false,
    },
  ]
  const redPalette = [
    {
      colorName: 'red',
      colorValue: 'b8180a',
      colorBackground: 'bg-red',
      primary: true,
    },
    {
      colorName: '100',
      colorValue: 'fbcbc5',
      colorBackground: 'bg-red-100',
      primary: false,
    },
    {
      colorName: '200',
      colorValue: 'f8958c',
      colorBackground: 'bg-red-200',
      primary: false,
    },
    {
      colorName: '300',
      colorValue: 'f57266',
      colorBackground: 'bg-red-300',
      primary: false,
    },
    {
      colorName: '400',
      colorValue: 'f14337',
      colorBackground: 'bg-red-400',
      primary: false,
    },
    {
      colorName: '500',
      colorValue: 'e51e10',
      colorBackground: 'bg-red-500',
      primary: true,
    },
    {
      colorName: '600',
      colorValue: 'b8180a',
      colorBackground: 'bg-red-600',
      primary: false,
    },
    {
      colorName: '700',
      colorValue: '881106',
      colorBackground: 'bg-red-700',
      primary: false,
    },
    {
      colorName: '800',
      colorValue: '570a05',
      colorBackground: 'bg-red-800',
      primary: false,
    },
    {
      colorName: '900',
      colorValue: '3b0602',
      colorBackground: 'bg-red-900',
      primary: false,
    },
  ]
  const orangePalette = [
    {
      colorName: 'orange',
      colorValue: 'e6700f',
      colorBackground: 'bg-orange',
      primary: true,
    },
    {
      colorName: '100',
      colorValue: 'fbddc1',
      colorBackground: 'bg-orange-100',
      primary: false,
    },
    {
      colorName: '200',
      colorValue: 'f8c08c',
      colorBackground: 'bg-orange-200',
      primary: false,
    },
    {
      colorName: '300',
      colorValue: 'f5ab66',
      colorBackground: 'bg-orange-300',
      primary: false,
    },
    {
      colorName: '400',
      colorValue: 'f2933a',
      colorBackground: 'bg-orange-400',
      primary: false,
    },
    {
      colorName: '500',
      colorValue: 'e6700f',
      colorBackground: 'bg-orange-500',
      primary: true,
    },
    {
      colorName: '600',
      colorValue: 'b8550a',
      colorBackground: 'bg-orange-600',
      primary: false,
    },
    {
      colorName: '700',
      colorValue: '884106',
      colorBackground: 'bg-orange-700',
      primary: false,
    },
    {
      colorName: '800',
      colorValue: '572a05',
      colorBackground: 'bg-orange-800',
      primary: false,
    },
    {
      colorName: '900',
      colorValue: '3b1b02',
      colorBackground: 'bg-orange-900',
      primary: false,
    },
  ]
  const yellowPalette = [
    {
      colorName: 'yellow',
      colorValue: 'f2be3a',
      colorBackground: 'bg-yellow',
      primary: true,
    },
    {
      colorName: '100',
      colorValue: 'fbecc5',
      colorBackground: 'bg-yellow-100',
      primary: false,
    },
    {
      colorName: '200',
      colorValue: 'f8d98c',
      colorBackground: 'bg-yellow-200',
      primary: false,
    },
    {
      colorName: '300',
      colorValue: 'f6ce6a',
      colorBackground: 'bg-yellow-300',
      primary: false,
    },
    {
      colorName: '400',
      colorValue: 'f2be3a',
      colorBackground: 'bg-yellow-400',
      primary: true,
    },
    {
      colorName: '500',
      colorValue: 'eaa510',
      colorBackground: 'bg-yellow-500',
      primary: false,
    },
    {
      colorName: '600',
      colorValue: 'b8870a',
      colorBackground: 'bg-yellow-600',
      primary: false,
    },
    {
      colorName: '700',
      colorValue: '886606',
      colorBackground: 'bg-yellow-700',
      primary: false,
    },
    {
      colorName: '800',
      colorValue: '573e05',
      colorBackground: 'bg-yellow-800',
      primary: false,
    },
    {
      colorName: '900',
      colorValue: '3a2903',
      colorBackground: 'bg-yellow-900',
      primary: false,
    },
  ]

  const [selectedColor1, setSelectedColor1] = useState<{
    colorValue: string | null
    colorBackground: string | null
  } | null>({colorBackground: 'bg-gray-50', colorValue: '009474'})
  const [selectedColor2, setSelectedColor2] = useState<{
    colorValue: string | null
    colorBackground: string | null
  } | null>({colorBackground: 'bg-gray-1000', colorValue: '00020c'})
  const [contrastRatio, setContrastRatio] = useState<number>(18.85)

  const hexToRgb = (hex: string) => {
    let bigint = parseInt(hex, 16)
    let r = (bigint >> 16) & 255
    let g = (bigint >> 8) & 255
    let b = bigint & 255
    return [r, g, b]
  }

  const calculateLuminance = ([r, g, b]: number[]) => {
    const [rs, gs, bs] = [r, g, b].map((value) => {
      const v = value / 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  const calculateContrastRatio = (color1: string, color2: string) => {
    const lum1 = calculateLuminance(hexToRgb(selectedColor1?.colorValue ?? ''))
    const lum2 = calculateLuminance(hexToRgb(color2))
    const brightest = Math.max(lum1, lum2)
    const darkest = Math.min(lum1, lum2)
    return (brightest + 0.05) / (darkest + 0.05)
  }

  const handleClick = (color: {
    colorBackground: string
    colorValue: string
  }) => {
    if (!selectedColor1?.colorBackground) {
      setSelectedColor1(color)
    } else {
      setSelectedColor2(color)
      const ratio = calculateContrastRatio(
        selectedColor1.colorValue ?? '',
        color.colorValue ?? ''
      )
      setContrastRatio(ratio)
    }
  }

  const cleanColor = () => {
    setSelectedColor1({colorBackground: null, colorValue: null})
    setSelectedColor2({colorBackground: null, colorValue: null})
  }

  const renderColorBox = (color: {
    colorBackground: string
    colorValue: string
  }) => (
    <div className="flex flex-row items-center">
      <div
        className={`mr-xs h-10 w-10 rounded border border-black ${color?.colorBackground || 'bg-gray'}`}
      />
      <div className="flex flex-col justify-center">
        <span className="font-semibold">
          {color?.colorBackground || 'No Color Selected'}
        </span>
        <span className="text-sm text-gray-500">
          #{color?.colorValue || 'N/A'}
        </span>
      </div>
    </div>
  )

  const renderRatio = (ratio: number) => (
    <div>
      {contrastRatio >= ratio ? (
        <p className="text-green">GOOD</p>
      ) : (
        <p className="text-red">POOR</p>
      )}
    </div>
  )

  return (
    <>
      <h1>Colors</h1>

      <h2>Gray palette</h2>
      <div className="flex gap-s">
        {grayPalette.map((color) => {
          return (
            <ColorBox
              key={color.colorName}
              selectedColor={(color) => handleClick(color)}
              colorName={color.colorName}
              colorValue={color.colorValue}
              colorBackground={color.colorBackground}
              primary={color.primary}
            />
          )
        })}
      </div>

      <h2>Palettes</h2>
      <div className="flex flex-row">
        <div>
          <div className="flex gap-s">
            {darkbluePalette.map((color) => {
              return (
                <ColorBox
                  key={color.colorName}
                  selectedColor={(color) => handleClick(color)}
                  colorName={color.colorName}
                  colorValue={color.colorValue}
                  colorBackground={color.colorBackground}
                  primary={color.primary}
                />
              )
            })}
          </div>

          <div className="flex gap-s">
            {bluePalette.map((color) => {
              return (
                <ColorBox
                  key={color.colorName}
                  selectedColor={(color) => handleClick(color)}
                  colorName={color.colorName}
                  colorValue={color.colorValue}
                  colorBackground={color.colorBackground}
                  primary={color.primary}
                />
              )
            })}
          </div>

          <div className="flex gap-s">
            {turquoisePalette.map((color) => {
              return (
                <ColorBox
                  key={color.colorName}
                  selectedColor={(color) => handleClick(color)}
                  colorName={color.colorName}
                  colorValue={color.colorValue}
                  colorBackground={color.colorBackground}
                  primary={color.primary}
                />
              )
            })}
          </div>

          <div className="flex gap-s">
            {greenPalette.map((color) => {
              return (
                <ColorBox
                  key={color.colorName}
                  selectedColor={(color) => handleClick(color)}
                  colorName={color.colorName}
                  colorValue={color.colorValue}
                  colorBackground={color.colorBackground}
                  primary={color.primary}
                />
              )
            })}
          </div>

          <div className="flex gap-s">
            {redPalette.map((color) => {
              return (
                <ColorBox
                  key={color.colorName}
                  selectedColor={(color) => handleClick(color)}
                  colorName={color.colorName}
                  colorValue={color.colorValue}
                  colorBackground={color.colorBackground}
                  primary={color.primary}
                />
              )
            })}
          </div>

          <div className="flex gap-s">
            {orangePalette.map((color) => {
              return (
                <ColorBox
                  key={color.colorName}
                  selectedColor={(color) => handleClick(color)}
                  colorName={color.colorName}
                  colorValue={color.colorValue}
                  colorBackground={color.colorBackground}
                  primary={color.primary}
                />
              )
            })}
          </div>

          <div className="flex gap-s">
            {yellowPalette.map((color) => {
              return (
                <ColorBox
                  key={color.colorName}
                  selectedColor={(color) => handleClick(color)}
                  colorName={color.colorName}
                  colorValue={color.colorValue}
                  colorBackground={color.colorBackground}
                  primary={color.primary}
                />
              )
            })}
          </div>

          <h2>Some gradients</h2>
          <div className="mb-10 flex gap-xl">
            <div className="h-20 w-60 rounded bg-gradient-to-r from-darkblue-900 to-darkblue-600"></div>
            <div className="h-20 w-60 rounded bg-gradient-to-r from-darkblue to-turquoise"></div>
          </div>
          <div className="mb-20 flex gap-xl">
            <div className="h-20 w-60 rounded bg-gradient-to-r from-darkblue-900 via-darkblue-600 to-turquoise"></div>
            <div className="h-20 w-60 rounded bg-gradient-to-r from-blue to-turquoise-300"></div>
          </div>
        </div>

        <div className="ml-xl flex flex-col gap-m">
          <div className="flex flex-row items-center gap-m">
            <div>
              <Button
                className=""
                onClick={() => cleanColor()}>
                Clean
              </Button>
            </div>
            <div>
              {renderColorBox({
                colorBackground: selectedColor1?.colorBackground ?? '',
                colorValue: selectedColor1?.colorValue ?? '',
              })}
            </div>
            <div>
              {renderColorBox({
                colorBackground: selectedColor2?.colorBackground ?? '',
                colorValue: selectedColor2?.colorValue ?? '',
              })}
            </div>
          </div>

          {selectedColor1?.colorValue &&
            selectedColor2?.colorValue &&
            contrastRatio && (
              <div className="ml-0 flex flex-col">
                <div
                  className={`flex w-80 flex-col rounded border p-xl ${selectedColor1?.colorBackground}`}
                  style={{color: '#' + selectedColor2?.colorValue}}>
                  <div>Example text</div>
                  <div className="text-lg">Example text</div>
                  <div>
                    <HomeIcon />
                  </div>
                </div>

                <div className="p-m font-bold">
                  Contrast Ratio: {contrastRatio.toFixed(2)}
                  <ul>
                    <li className="flex items-center gap-2">
                      <div className="underline">Small Text </div>
                      <span className="font-semibold">AA (min. 4.5) :</span>
                      {renderRatio(4.5)}
                      <span className="font-semibold">AAA (min. 7) :</span>
                      {renderRatio(7)}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="underline">Large Text </span>
                      <span className="font-semibold">AA (min. 3) :</span>
                      {renderRatio(3)}
                      <span className="font-semibold">AAA (min. 4.5) :</span>
                      {renderRatio(4.5)}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="underline">UI Comp </span>
                      <span className="font-semibold">AA (min. 3) :</span>
                      {renderRatio(3)}
                      <span className="font-semibold">AAA (min. 4.5) :</span>
                      {renderRatio(4.5)}
                    </li>
                  </ul>
                </div>
                <div></div>
              </div>
            )}
        </div>
      </div>
    </>
  )
}
