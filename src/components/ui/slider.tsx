"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

type SliderRootProps = SliderPrimitive.Root.Props<number | readonly number[]>

function Slider({
  className,
  ...props
}: SliderRootProps) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Control
        data-slot="slider-control"
        className="relative flex h-5 w-full grow items-center"
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-input"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-indicator"
            className="absolute h-full bg-primary"
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          className={cn(
            "block size-4 rounded-full border-2 border-primary bg-background shadow ring-offset-background transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
