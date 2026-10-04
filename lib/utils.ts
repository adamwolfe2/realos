import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Register the @theme micro type scale (globals.css) as font-size classes so
// twMerge does not mistake text-2xs/label/caption/body-sm for text colors and
// drop them when merged next to a color utility.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ['2xs', 'label', 'caption', 'body-sm'] },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
