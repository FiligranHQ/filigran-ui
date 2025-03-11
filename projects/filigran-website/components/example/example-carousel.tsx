'use client'

import * as React from 'react'

import Image from 'next/image'
import {Carousel, CarouselItem, Dialog, DialogContent} from 'filigran-ui/clients'
import {AspectRatio} from 'filigran-ui/servers'
import {useState} from 'react'

export function ExampleCarousel() {
  const basePath = process.env.NODE_ENV === 'development' ? '' : '/filigran-ui';
  const [open, setOpen] = useState<boolean>(false)
  return (
    <>
      <h2>With lightbox</h2>
      <Carousel>
        {[
          `/francesco-ungaro.jpg`,
          '/the-chaffins.jpg',
          '/nathan-gordon.jpg',
        ].map((img) => {
          return (
            <CarouselItem
              key={img}
              className="cursor-pointer"
              onClick={() => setOpen(true)}>
              <AspectRatio ratio={16 / 9}>
              <Image
                fill
                objectFit="cover"
                src={`${basePath}${img}`}
                alt={img}
              />
              </AspectRatio>
            </CarouselItem>
          )
        })}
      </Carousel>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent  className="max-h-[calc(100dvh)] h-screen w-screen max-w-[calc(100dvw)] ">
          <Carousel>
            {[
              `/francesco-ungaro.jpg`,
              '/the-chaffins.jpg',
              '/nathan-gordon.jpg',
            ].map((img) => {
              return (
                <CarouselItem
                  className="h-full w-full relative"
                  key={img}>
                    <Image
                      fill
                      objectFit="contain"
                      src={`${basePath}${img}`}
                      alt={img}
                    />

                </CarouselItem>
              )
            })}
          </Carousel>
        </DialogContent>
      </Dialog>
      <h2>Without lightbox</h2>
      <Carousel>
        {[
          `/francesco-ungaro.jpg`,
          '/the-chaffins.jpg',
          '/nathan-gordon.jpg',
        ].map((img, index) => {
          return (
            <CarouselItem
              key={img}>
              <AspectRatio ratio={16 / 9}>
                <Image
                  fill
                  objectFit="cover"
                  src={`${basePath}${img}`}
                  alt={img}
                />
              </AspectRatio>
            </CarouselItem>
          )
        })}
      </Carousel>
      <Carousel
        opts={{
          align: 'start',
        }}
        orientation="vertical"
        className=" h-[500px] w-full">
        {[
          '/francesco-ungaro.jpg',
          '/the-chaffins.jpg',
          '/nathan-gordon.jpg',
        ].map((img) => {
          return (
            <CarouselItem key={img}>
              <Image
                src={`${basePath}${img}`}
                fill
                objectFit="contain"
                objectPosition="center"
                alt={img}
              />
            </CarouselItem>
          )
        })}
      </Carousel>
    </>
  )
}
