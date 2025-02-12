'use client'
import React, { type ReactNode, useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { type EmblaCarouselType } from 'embla-carousel'
import { Button } from '../servers';
import { KeyboardArrowLeftIcon, KeyboardArrowRightIcon } from 'filigran-icon';
import { Dialog } from '@radix-ui/react-dialog';
import { DialogContent, DialogTitle } from './dialog';

export function Carousel({ placeholder, slides = [] }: { placeholder: ReactNode, slides?: string[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel();

  const [prevBtnDisabled, setPrevBtnDisabled] = useState(false);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(false);
  const [selected, setSelected] = useState<string | undefined>();

  const onPrevButtonClick = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollPrev();
  }, [emblaApi]);
  const onNextButtonClick = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    setPrevBtnDisabled(!emblaApi.canScrollPrev());
    setNextBtnDisabled(!emblaApi.canScrollNext());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    onSelect(emblaApi);
    emblaApi.on('reInit', onSelect).on('select', onSelect);
  }, [emblaApi, onSelect]);

  return (
    <>
      <div className="overflow-hidden relative" ref={emblaRef}>
        <div className="flex">
          {placeholder && (
            <div className="flex-0 flex-shrink-0 basis-[100%]">
              {placeholder}
            </div>
          )}
          {slides.map((base64, index) => (
            <div className="flex-0 flex-shrink-0 basis-[100%]" key={index} onClick={() => setSelected(base64)}>
              <img className="h-[15rem] my-0 mx-auto" src={base64} />
            </div>
          ))}
        </div>
        <div className="absolute top-[50%] w-full" style={{ transform: 'translate(0,-1.125rem)'}}>
          <div className="flex flex-1 justify-between">
            <Button
              onClick={onPrevButtonClick}
              disabled={prevBtnDisabled}
              size="icon"
              variant="outline"
              className="rounded-[100%] bg-background"
              type="button"
            >
              <KeyboardArrowLeftIcon className="size-3" />
            </Button>
            <Button
              onClick={onNextButtonClick}
              disabled={nextBtnDisabled}
              size="icon"
              variant="outline"
              className="rounded-[100%] bg-background"
              type="button"
            >
              <KeyboardArrowRightIcon className="size-3" />
            </Button>
          </div>
        </div>
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={() => setSelected(undefined)}
      >
        <DialogContent className="h-2/3 max-w-[80rem] w-[80rem]">
          <DialogTitle />
          <img src={selected} />
        </DialogContent>
      </Dialog>
    </>
  )
}