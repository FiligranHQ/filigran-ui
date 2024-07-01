import {type ClassValue, clsx} from 'clsx'
import {twMerge} from 'tailwind-merge'
import type {ReactElement, ReactNode, Ref, RefAttributes} from 'react'
import {Children, forwardRef, isValidElement} from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getValidChildren(children: ReactNode) {
  return Children.toArray(children).filter((child) =>
    isValidElement(child)
  ) as ReactElement[]
}

export function fixedForwardRef<T, P = {}>(
  render: (props: P, ref: Ref<T>) => ReactNode
): (props: P & RefAttributes<T>) => ReactNode {
  return forwardRef(render) as any
}
