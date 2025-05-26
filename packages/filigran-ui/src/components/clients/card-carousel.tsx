'use client'

import * as React from 'react'
import { cn } from '../../lib/utils'
import { Carousel, CarouselItem } from './carousel'

interface CardCarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Array of content items to display in the carousel
   */
  items: React.ReactNode[]
  /**
   * Optional custom class for the card container
   */
  cardClassName?: string
  /**
   * Controls when scroll buttons are visible: 'visible' (always), 'hover', or 'none'
   * @default 'visible'
   */
  scrollButton?: 'visible' | 'hover' | 'none'
  /**
   * Controls when dot navigation buttons are visible: 'visible' (always), 'hover', or 'none'
   * @default 'visible'
   */
  dotButton?: 'visible' | 'hover' | 'none'
  /**
   * Maximum number of dot indicators to display
   * @default 6
   */
  displayDots?: number
  /**
   * Carousel options passed to the underlying Carousel component
   */
  carouselOpts?: Parameters<typeof Carousel>[0]['opts']
}

/**
 * CardCarousel component
 * 
 * A component that combines a card with a carousel to display multiple content items
 * with navigation controls.
 * 
 * @example
 * ```tsx
 * <CardCarousel
 *   items={[
 *     <div key="1">Slide 1 content</div>,
 *     <div key="2">Slide 2 content</div>,
 *     <div key="3">Slide 3 content</div>,
 *   ]}
 *   scrollButton="hover"
 *   dotButton="visible"
 * />
 * ```
 */
export function CardCarousel({
  items,
  className,
  cardClassName,
  scrollButton = 'visible',
  dotButton = 'visible',
  displayDots = 6,
  carouselOpts,
  ...props
}: CardCarouselProps) {
  return (
    <div 
      className={cn(
        'overflow-hidden rounded-lg border border-border shadow-sm',
        cardClassName
      )}
    >
      <Carousel
        className={cn('w-full', className)}
        scrollButton={scrollButton}
        dotButton={dotButton}
        displayDots={displayDots}
        opts={carouselOpts}
        {...props}
      >
        {items.map((item, index) => (
          <CarouselItem key={index}>
            {item}
          </CarouselItem>
        ))}
      </Carousel>
    </div>
  )
}
