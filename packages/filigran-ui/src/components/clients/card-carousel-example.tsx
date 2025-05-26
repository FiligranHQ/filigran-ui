'use client'

import * as React from 'react'
import { CardCarousel } from './card-carousel'

/**
 * Example usage of the CardCarousel component
 * 
 * This component demonstrates how to implement the CardCarousel with:
 * - Multiple content slides with different styling
 * - Custom visibility settings for navigation controls
 * - Fixed height configuration
 * - Documentation of key features and usage patterns
 */
export function CardCarouselExample() {
  // Example content items for the carousel
  const cardItems = [
    <div key="1" className="flex flex-col items-center justify-center p-6 h-full">
      <h3 className="text-xl font-semibold mb-2">Card 1</h3>
      <p className="text-center text-gray-600">This is the first card in the carousel.</p>
    </div>,
    <div key="2" className="flex flex-col items-center justify-center p-6 h-full bg-gray-50">
      <h3 className="text-xl font-semibold mb-2">Card 2</h3>
      <p className="text-center text-gray-600">This is the second card in the carousel.</p>
    </div>,
    <div key="3" className="flex flex-col items-center justify-center p-6 h-full">
      <h3 className="text-xl font-semibold mb-2">Card 3</h3>
      <p className="text-center text-gray-600">This is the third card in the carousel.</p>
    </div>,
    <div key="4" className="flex flex-col items-center justify-center p-6 h-full bg-gray-50">
      <h3 className="text-xl font-semibold mb-2">Card 4</h3>
      <p className="text-center text-gray-600">This is the fourth card in the carousel.</p>
    </div>,
  ]

  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Card Carousel Example</h2>

      <CardCarousel
        items={cardItems}
        className="h-64" // Set a fixed height for the carousel
        scrollButton="hover" // Show scroll buttons only on hover
        dotButton="visible" // Always show dot navigation
      />

      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-2">Usage Notes</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Scroll buttons appear on hover</li>
          <li>Dot navigation is always visible</li>
          <li>Card content can be any React node</li>
          <li>Supports keyboard navigation with arrow keys</li>
        </ul>
      </div>
    </div>
  )
}
