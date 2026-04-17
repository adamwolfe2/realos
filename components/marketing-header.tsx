'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const NAV_LINKS = [
  { label: 'Catalog',    href: '/catalog'     },
  { label: 'Provenance', href: '/provenance'  },
  { label: 'Guide',      href: '/guide'       },
  { label: 'About',      href: '/about'       },
  { label: 'Drops',      href: '/drops'       },
  { label: 'Journal',    href: '/journal'     },
  { label: 'Social',     href: '/social'      },
  { label: 'Wholesale',  href: '/partner' },
  { label: 'Press',      href: '/press'       },
]

export function MarketingHeader() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  function isActive(href: string) {
    if (href.startsWith('/#')) return false
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-md border-b border-shell">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-16 gap-4">

        {/* Logo */}
        <div className="flex-1 flex justify-start">
          <Link href="/" className="shrink-0">
            <Image
              src="/wholesail-logo.svg"
              alt="Wholesail"
              width={110}
              height={84}
              className="h-8 sm:h-9 w-auto"
            />
          </Link>
        </div>

        {/* Center nav — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-medium text-ink/60 shrink-0">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'hover:text-ink transition-colors whitespace-nowrap',
                isActive(href) && 'text-ink font-semibold'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right CTAs */}
        <div className="flex-1 flex justify-end items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex text-sm">
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-ink text-cream hover:bg-ink/80 text-sm font-medium"
          >
            <Link href="/partner">Order Now</Link>
          </Button>

          {/* Mobile hamburger — only visible below md */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="md:hidden flex items-center justify-center w-9 h-9 text-ink"
                aria-label="Open navigation menu"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>

            <SheetContent side="right" className="w-72 p-0 bg-cream" aria-describedby={undefined}>
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              {/* Sheet header */}
              <div className="flex items-center h-16 px-5 border-b border-shell">
                <span className="text-xs-sm font-semibold text-ink">Menu</span>
              </div>

              {/* Mobile nav links */}
              <nav className="flex flex-col px-3 py-3">
                {NAV_LINKS.map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center min-h-[48px] px-3 text-sm font-medium border-b border-shell transition-colors',
                      isActive(href)
                        ? 'text-ink font-semibold'
                        : 'text-ink/60 hover:text-ink'
                    )}
                  >
                    {label}
                  </Link>
                ))}
              </nav>

              {/* Sheet CTAs */}
              <div className="px-5 py-4 flex flex-col gap-2 border-t border-shell">
                <Link
                  href="/sign-in"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center min-h-[48px] text-sm font-medium text-ink/70 border border-shell hover:text-ink hover:border-ink transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/partner"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center min-h-[48px] text-sm font-medium bg-ink text-cream hover:bg-ink/80 transition-colors"
                >
                  Order Now
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>

      </div>
    </header>
  )
}
