import {clx} from '@/utils/clx/clx-merge'
import {STYLES} from '@/components/ui/_shared'

export const Flex = clx.div(STYLES.FLEX_CENTER, 'w-full')
export const Flex2 = clx.div(STYLES.FLEX_CENTER, 'gap-2')
export const Flex4 = clx.div(STYLES.FLEX_CENTER, 'gap-4')
export const FlexBetween = clx.div(STYLES.FLEX_BETWEEN, 'w-full')
export const FullCenter = clx.div(STYLES.FLEX_CENTER_JUSTIFIED)
export const FlexWrap = clx.div(STYLES.FLEX_WRAP, 'gap-2')
export const FlexCol = clx.div(STYLES.FLEX_COL)
export const Column = clx.div(STYLES.FLEX_COL, 'items-center')

export const Grid2 = clx.div(STYLES.GRID_START, 'gap-4 lg:grid-cols-2')
export const Grid3 = clx.div(
  STYLES.GRID_START,
  'gap-6 sm:grid-cols-2 lg:grid-cols-3'
)
export const Grid4 = clx.div(STYLES.GRID_START, 'gap-4 grid-cols-4')
export const Grid6 = clx.div(STYLES.GRID_START, 'gap-4 grid-cols-6')

export const RelativeDiv = clx.div('relative')
export const AbsoluteDiv = clx.div('absolute')
