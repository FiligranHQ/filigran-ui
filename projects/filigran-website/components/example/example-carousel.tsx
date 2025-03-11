'use client'

import * as React from 'react'

import Image from 'next/image'
import {Carousel, CarouselItem} from 'filigran-ui/clients'

export function ExampleCarousel() {
  return (
    <>
      <Carousel>
        {[
          `/francesco-ungaro.jpg`,
          '/the-chaffins.jpg',
          '/nathan-gordon.jpg',
        ].map((img) => {
          return (
            <CarouselItem
              key={img}
              className="h-[500px]">
              <Image
                src={`${process.env.BASE_PATH ?? ''}${img}`}
                fill={true}
                alt={img}
              />
            </CarouselItem>
          )
        })}
      </Carousel>
      <Carousel
        opts={{
          align: 'start',
        }}
        orientation="vertical"
        className="h-[500px] w-full">
        {[
          '/francesco-ungaro.jpg',
          '/the-chaffins.jpg',
          '/nathan-gordon.jpg',
        ].map((img) => {
          return (
            <CarouselItem key={img}>
              <Image
                src={img}
                fill={true}
                alt={img}
              />
            </CarouselItem>
          )
        })}
      </Carousel>
    </>
  )
}
