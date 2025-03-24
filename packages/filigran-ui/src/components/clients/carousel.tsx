'use client'

import {type EmblaCarouselType} from 'embla-carousel'
import useEmblaCarousel, {type UseEmblaCarouselType} from 'embla-carousel-react'
import {KeyboardArrowLeftIcon, KeyboardArrowRightIcon} from 'filigran-icon'
import * as React from 'react'
import {
  type ComponentProps,
  createContext,
  forwardRef,
  type FunctionComponent,
  type HTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import {cn} from '../../lib/utils'
import {Button} from '../servers'

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: 'horizontal' | 'vertical'
  setApi?: (api: CarouselApi) => void
  scrollButton?: 'visible' | 'hover' | 'none'
  dotButton?: 'visible' | 'hover' | 'none'
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: ReturnType<typeof useEmblaCarousel>[1]
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
} & CarouselProps

type UseDotButtonProps = {
  selectedIndex: number
  scrollSnaps: number[]
  onDotButtonClick: (index: number) => void
}

const CarouselContext = createContext<CarouselContextProps | null>(null)

function useCarousel() {
  const context = useContext(CarouselContext)

  if (!context) {
    throw new Error('useCarousel must be used within a <Carousel />')
  }

  return context
}

const Carousel = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & CarouselProps
>(
  (
    {
      orientation = 'horizontal',
      opts,
      setApi,
      plugins,
      className,
      scrollButton = 'visible',
      dotButton = 'visible',
      children,
      ...props
    },
    ref
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        loop: true,
        ...opts,
        axis: orientation === 'horizontal' ? 'x' : 'y',
      },
      plugins
    )
    const [canScrollPrev, setCanScrollPrev] = useState(false)
    const [canScrollNext, setCanScrollNext] = useState(false)

    const onSelect = useCallback((api: CarouselApi) => {
      if (!api) {
        return
      }

      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
    }, [])

    const scrollPrev = useCallback(() => {
      api?.scrollPrev()
    }, [api])

    const scrollNext = useCallback(() => {
      api?.scrollNext()
    }, [api])

    const {selectedIndex, scrollSnaps, onDotButtonClick} = useDotButton(api)

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          scrollPrev()
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          scrollNext()
        }
      },
      [scrollPrev, scrollNext]
    )

    useEffect(() => {
      if (!api || !setApi) {
        return
      }

      setApi(api)
    }, [api, setApi])

    useEffect(() => {
      if (!api) {
        return
      }

      onSelect(api)
      api.on('reInit', onSelect)
      api.on('select', onSelect)

      return () => {
        api?.off('select', onSelect)
      }
    }, [api, onSelect])

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation:
            orientation || (opts?.axis === 'y' ? 'vertical' : 'horizontal'),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}>
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn('relative group', className)}
          role="region"
          aria-roledescription="carousel"
          {...props}>
          <CarouselContent>{children}</CarouselContent>
          {orientation === 'horizontal' ? (
            <>
              {scrollButton !== 'none' && (
                <>
                  <CarouselPrevious
                    className={
                      'opacity-0 group-hover:opacity-100 transition-opacity'
                    }
                  />
                  <CarouselNext
                    className={
                      'opacity-0 group-hover:opacity-100 transition-opacity'
                    }
                  />
                </>
              )}
              {dotButton !== 'none' && (
                <div className="absolute bottom-l left-1/2 -translate-x-1/2 flex justify-center overflow-hidden  w-full gap-s opacity-0 group-hover:opacity-100 transition-opacity">
                  <div
                    className="flex gap-s transition-transform duration-300 ease-in-out"
                    style={{
                      transform: `translateX(calc(50% - ${selectedIndex * 20}px))`,
                    }}>
                    {scrollSnaps.map((_, index) => (
                      <CarouselDotButton
                        key={index}
                        onClick={() => onDotButtonClick(index)}
                        className={cn(
                          index === selectedIndex && 'bg-primary',
                          dotButton === 'hover' &&
                            'opacity-0 group-hover:opacity-100 transition-opacity '
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="top-1/2 -translate-y-1/2 flex flex-col items-center right-l absolute gap-l">
              {scrollButton !== 'none' && (
                <CarouselPrevious
                  className={cn(
                    scrollButton === 'hover' &&
                      'opacity-0 group-hover:opacity-100 transition-opacity '
                  )}
                />
              )}
              {dotButton !== 'none' && (
                <div className="flex flex-col gap-xs">
                  {scrollSnaps.map((_, index) => (
                    <CarouselDotButton
                      key={index}
                      onClick={() => onDotButtonClick(index)}
                      className={cn(
                        index === selectedIndex && 'bg-primary',
                        dotButton === 'hover' &&
                          'opacity-0 group-hover:opacity-100 transition-opacity '
                      )}
                    />
                  ))}
                </div>
              )}
              {scrollButton !== 'none' && (
                <CarouselNext
                  className={cn(
                    scrollButton === 'hover' &&
                      'opacity-0 group-hover:opacity-100 transition-opacity '
                  )}
                />
              )}
            </div>
          )}
        </div>
      </CarouselContext.Provider>
    )
  }
)
Carousel.displayName = 'Carousel'

const CarouselContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({className, ...props}, ref) => {
  const {carouselRef, orientation} = useCarousel()

  return (
    <div
      ref={carouselRef}
      className={cn('overflow-hidden', 'h-full')}>
      <div
        ref={ref}
        className={cn(
          'flex',
          orientation === 'horizontal' ? ' h-full' : '-mt-4 flex-col h-full',
          className
        )}
        {...props}
      />
    </div>
  )
})
CarouselContent.displayName = 'CarouselContent'

const CarouselItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({className, ...props}, ref) => {
    const {orientation} = useCarousel()

    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        className={cn(
          'min-w-0 shrink-0 grow-0 basis-full relative',
          orientation === 'horizontal' ? 'px-s' : 'py-s',
          className
        )}
        {...props}
      />
    )
  }
)
CarouselItem.displayName = 'CarouselItem'

const CarouselPrevious = forwardRef<
  HTMLButtonElement,
  ComponentProps<typeof Button>
>(({className, variant = 'outline', size = 'icon', ...props}, ref) => {
  const {orientation, scrollPrev, canScrollPrev} = useCarousel()

  return (
    <Button
      ref={ref}
      size="icon"
      variant="outline"
      className={cn(
        ' h-8 w-8 rounded-full border-gray-100',
        orientation === 'horizontal'
          ? 'absolute top-1/2 -translate-y-1/2 left-l'
          : 'rotate-90',
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}>
      <KeyboardArrowLeftIcon className="size-3 text-gray-100" />
      <span className="sr-only">Previous slide</span>
    </Button>
  )
})

CarouselPrevious.displayName = 'CarouselPrevious'

const CarouselNext = forwardRef<
  HTMLButtonElement,
  ComponentProps<typeof Button>
>(({className, variant = 'outline', size = 'icon', ...props}, ref) => {
  const {orientation, scrollNext, canScrollNext} = useCarousel()

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        'h-8 w-8 rounded-full border-gray-100',
        orientation === 'horizontal'
          ? 'absolute top-1/2 -translate-y-1/2 right-l'
          : 'rotate-90',
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}>
      <KeyboardArrowRightIcon className="size-3 text-gray-100" />
      <span className="sr-only">Next slide</span>
    </Button>
  )
})

const useDotButton = (
  emblaApi: EmblaCarouselType | undefined
): UseDotButtonProps => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([])

  const onDotButtonClick = useCallback(
    (index: number) => {
      if (!emblaApi) return
      emblaApi.scrollTo(index)
    },
    [emblaApi]
  )

  const onInit = useCallback((emblaApi: EmblaCarouselType) => {
    setScrollSnaps(emblaApi.scrollSnapList())
  }, [])

  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [])

  useEffect(() => {
    if (!emblaApi) return

    onInit(emblaApi)
    onSelect(emblaApi)
    emblaApi.on('reInit', onInit).on('reInit', onSelect).on('select', onSelect)
  }, [emblaApi, onInit, onSelect])

  return {
    selectedIndex,
    scrollSnaps,
    onDotButtonClick,
  }
}

const CarouselDotButton: FunctionComponent<ComponentProps<typeof Button>> = (
  props
) => {
  const {children, className, ...restProps} = props

  return (
    <button
      type="button"
      {...restProps}
      className={cn(
        'bg-transparent touch-manipulation text-decoration-none cursor-pointer p-0 m-0 size-l flex items-center justify-center rounded-full border-primary border',
        className
      )}>
      {children}
    </button>
  )
}

CarouselDotButton.displayName = 'CarouselDotButton'

CarouselNext.displayName = 'CarouselNext'

export {Carousel, CarouselItem, type CarouselApi}
