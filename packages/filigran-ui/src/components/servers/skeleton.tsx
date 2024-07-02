import {cn} from '../../lib/utils'

function Skeleton({className, ...props}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-text-secondary/50', className)}
      {...props}
    />
  )
}

export {Skeleton}
