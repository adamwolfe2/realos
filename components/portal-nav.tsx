'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { UserButton, useClerk } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { portalConfig } from '@/lib/portal-config'
import { NotificationBell } from '@/components/notification-bell'
import {
  LayoutDashboard,
  MessageSquare,
  CreditCard,
  LogOut,
  Settings,
  ShoppingCart,
  FileText,
  FileCheck,
  RefreshCw,
  Store,
  BarChart3,
  Truck,
  Package,
  Users,
  ShoppingBag,
  MoreHorizontal,
  X,
} from 'lucide-react'

interface NotificationCounts {
  unreadMessages: number
}

type PortalLink = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  badge: keyof NotificationCounts | null
  mobileOnly?: boolean
  desktopOnly?: boolean
}

const portalLinks: PortalLink[] = [
  { href: '/client-portal/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
  { href: '/client-portal/orders', label: 'Orders', icon: ShoppingCart, badge: null },
  { href: '/client-portal/invoices', label: 'Invoices', icon: FileText, badge: null, desktopOnly: true },
  { href: '/client-portal/quotes', label: 'Quotes', icon: FileCheck, badge: null, desktopOnly: true },
  { href: '/client-portal/standing-orders', label: 'Standing Orders', icon: RefreshCw, badge: null, desktopOnly: true },
  { href: '/client-portal/catalog', label: 'Catalog', icon: Store, badge: null },
  { href: '/client-portal/saved-carts', label: 'Saved Carts', icon: ShoppingBag, badge: null, desktopOnly: true },
  { href: '/client-portal/fulfillment', label: 'Fulfillment', icon: Truck, badge: null, desktopOnly: true },
  { href: '/client-portal/inventory', label: 'Inventory', icon: Package, badge: null, desktopOnly: true },
  { href: '/client-portal/analytics', label: 'Analytics', icon: BarChart3, badge: null, desktopOnly: true },
  { href: '/client-portal/referrals', label: 'Referrals', icon: Users, badge: null, desktopOnly: true },
  { href: '/client-portal/messages', label: 'Messages', icon: MessageSquare, badge: 'unreadMessages' },
  { href: '/client-portal/payments', label: 'Payments', icon: CreditCard, badge: null },
  { href: '/client-portal/settings', label: 'Settings', icon: Settings, badge: null },
]

// Mobile bottom tab: only core items (5 max for thumb-friendly layout) + "More" for desktop-only
const mobileLinks = portalLinks.filter((l) => !l.desktopOnly)
const desktopOnlyLinks = portalLinks.filter((l) => l.desktopOnly)

function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 flex items-center justify-center">
      {count > 9 && (
        <span className="text-[8px] font-bold text-white leading-none">{count > 99 ? '99' : count}</span>
      )}
    </span>
  )
}

export function PortalNav() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const [counts, setCounts] = useState<NotificationCounts>({ unreadMessages: 0 })
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    async function fetchCounts() {
      try {
        const res = await fetch('/api/client/notifications/count')
        if (res.ok) {
          const data = await res.json()
          setCounts({ unreadMessages: data.unreadCount ?? 0 })
        }
      } catch {
        // Ignore errors — badges just won't show
      }
    }
    fetchCounts()
  }, [])

  const handleLogout = () => {
    signOut({ redirectUrl: '/' })
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r border-shell bg-cream z-40">
        {/* Wordmark */}
        <div className="flex items-center h-16 px-5 border-b border-shell">
          <Link href="/" className="flex flex-col min-w-0">
            <span className="font-serif font-bold text-lg sm:text-xl text-ink tracking-tight leading-tight">{portalConfig.brandName}</span>
            <span className="font-serif italic text-sm text-sand leading-tight">Portal</span>
          </Link>
        </div>

        {/* Nav links */}
        <nav aria-label="Portal navigation" className="flex-1 flex flex-col py-5 px-3 gap-0.5">
          {portalLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/client-portal/dashboard' && pathname?.startsWith(link.href))
            const badgeCount = link.badge ? counts[link.badge] : 0
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-ink text-cream'
                    : 'text-ink/60 hover:bg-ink/[0.08] hover:text-ink'
                )}
              >
                <span className="relative shrink-0">
                  <link.icon className="h-4 w-4" />
                  <NotificationBadge count={badgeCount} />
                </span>
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-shell px-3 py-4 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <UserButton afterSignOutUrl="/" />
            <span className="text-xs text-ink/50 truncate">Account</span>
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-ink/60 hover:text-ink hover:bg-ink/[0.08] transition-colors" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-50 border-b border-shell bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80 lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex flex-col min-w-0">
            <span className="font-serif font-bold text-sm sm:text-base text-ink leading-tight">{portalConfig.brandName}</span>
            <span className="font-serif italic text-[10px] text-sand leading-tight">Portal</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button variant="ghost" size="sm" className="text-ink/60 hover:text-ink hover:bg-ink/[0.08] transition-colors min-h-[44px] min-w-[44px]" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign Out</span>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>

        {/* Mobile bottom tab bar — core items + More */}
        <div className="flex border-t border-shell">
          {mobileLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/client-portal/dashboard' && pathname?.startsWith(link.href))
            const badgeCount = link.badge ? counts[link.badge] : 0
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-3 py-2.5 text-[10px] font-medium flex-1 min-h-[44px] justify-center transition-colors',
                  isActive
                    ? 'text-ink border-b-2 border-ink bg-sand/10'
                    : 'text-ink/50 hover:text-ink hover:bg-ink/[0.08]'
                )}
              >
                <span className="relative">
                  <link.icon className="h-4 w-4" />
                  <NotificationBadge count={badgeCount} />
                </span>
                <span className="leading-none truncate max-w-[56px]">{link.label}</span>
              </Link>
            )
          })}
          {desktopOnlyLinks.length > 0 && (
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={cn(
                'relative flex flex-col items-center gap-1 px-3 py-2.5 text-[10px] font-medium flex-1 min-h-[44px] justify-center transition-colors',
                moreOpen
                  ? 'text-ink border-b-2 border-ink bg-sand/10'
                  : 'text-ink/50 hover:text-ink hover:bg-ink/[0.08]'
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="leading-none">More</span>
            </button>
          )}
        </div>

        {/* More menu overlay */}
        {moreOpen && (
          <div className="absolute left-0 right-0 top-full bg-cream border-b border-shell shadow-lg z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-shell">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink/50">More Pages</span>
              <button onClick={() => setMoreOpen(false)} aria-label="Close menu" className="text-ink/50 hover:text-ink p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-px bg-shell">
              {desktopOnlyLinks.map((link) => {
                const isActive = pathname === link.href || pathname?.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3.5 text-sm font-medium bg-cream transition-colors min-h-[48px]',
                      isActive
                        ? 'text-ink bg-sand/10'
                        : 'text-ink/60 hover:bg-ink/[0.05] hover:text-ink'
                    )}
                  >
                    <link.icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </header>
    </>
  )
}

export function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <PortalNav />
      <main id="main-content" className="lg:pl-64">
        <div className="mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 max-w-7xl animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}
