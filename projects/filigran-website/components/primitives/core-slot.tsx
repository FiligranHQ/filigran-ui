import { Children, cloneElement, forwardRef, isValidElement } from 'react'
import type { HTMLAttributes, ReactElement, ReactNode } from 'react'

import {composeRefs} from './use-compose-refs'

interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode
}

interface SlotCloneProps {
  children: ReactNode
}

/*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
/*                       SLOTTABLE                            */
/*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

interface SlottableProps {
  children: ReactNode
}

const Slottable = ({children}: SlottableProps) => {
  return <>{children}</>
}

type AnyProps = Record<string, any>

function isSlottable(child: ReactNode): child is ReactElement<SlottableProps> {
  return isValidElement(child) && child.type === Slottable
}

//
/*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
/*                         SLOT                               */
/*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

const Slot = forwardRef<HTMLElement, SlotProps>((props, forwardedRef) => {
  const {children, ...slotProps} = props
  const childrenArray = Children.toArray(children)
  const slottable = childrenArray.find(isSlottable)

  if (slottable) {
    // the new element to render is the one passed as a child of `Slottable`
    const newElement = slottable.props.children as ReactElement<SlottableProps>

    const newChildren = childrenArray.map((child) => {
      if (child === slottable) {
        // because the new element will be the one rendered, we are only interested
        // in grabbing its children (`newElement.props.children`)
        if (Children.count(newElement) > 1) {
          return Children.only(null)
        }
        return isValidElement(newElement) ? newElement.props.children : null
      }
      return child
    })

    return (
      <SlotClone
        {...slotProps}
        ref={forwardedRef}>
        {isValidElement(newElement)
          ? cloneElement(newElement, undefined, newChildren)
          : null}
      </SlotClone>
    )
  }

  return (
    <SlotClone
      {...slotProps}
      ref={forwardedRef}>
      {children}
    </SlotClone>
  )
})

Slot.displayName = 'Slot'

/*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
/*                       SLOT CLONE                           */
/*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

const SlotClone = forwardRef<any, SlotCloneProps>(
  (props, forwardedRef) => {
    const {children, ...slotProps} = props

    if (isValidElement<ReactElement>(children)) {
      return cloneElement<AnyProps>(children, {
        ...mergeProps(slotProps, children.props),
        ref: forwardedRef
          ? composeRefs(forwardedRef, (children as any).ref)
          : (children as any).ref,
      })
    }

    return Children.count(children) > 1 ? Children.only(null) : null
  }
)

SlotClone.displayName = 'SlotClone'

//
//
/*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
/*                      MERGE PROPS                           */
/*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

function mergeProps(slotProps: AnyProps, childProps: AnyProps) {
  // all child props should override
  const overrideProps = {...childProps}

  for (const propName in childProps) {
    const slotPropValue = slotProps[propName]
    const childPropValue = childProps[propName]

    const isHandler = /^on[A-Z]/.test(propName)
    if (isHandler) {
      // if the handler exists on both, we compose them
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args: unknown[]) => {
          childPropValue(...args)
          slotPropValue(...args)
        }
      }
      // but if it exists only on the slot, we use only this one
      else if (slotPropValue) {
        overrideProps[propName] = slotPropValue
      }
    }
    // if it's `style`, we merge them
    else if (propName === 'style') {
      overrideProps[propName] = {...slotPropValue, ...childPropValue}
    } else if (propName === 'className') {
      overrideProps[propName] = [slotPropValue, childPropValue]
        .filter(Boolean)
        .join(' ')
    }
  }

  return {...slotProps, ...overrideProps}
}

const Root = Slot

export {Slot, Slottable, Root}
export type {SlotProps}
