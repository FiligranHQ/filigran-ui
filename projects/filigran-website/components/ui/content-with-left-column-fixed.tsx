import {FunctionComponent, ReactNode} from 'react'

interface ContentWithLeftColumnFixedProps {
  children: ReactNode
  left: ReactNode
}
export const ContentWithLeftColumnFixed: FunctionComponent<
  ContentWithLeftColumnFixedProps
> = ({children, left}) => {
  return (
    <section className="flex gap-xl">
      <div className="flex-1">{children}</div>
      <div className="flex-shrink-0">
        <aside className="z-1 sticky top-[5rem] min-w-[400px] max-w-[600px]">
          {left}
        </aside>
      </div>
    </section>
  )
}
