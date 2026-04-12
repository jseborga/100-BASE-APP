'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Book,
  Bot,
  Home,
  LogOut,
  Settings,
  Folder,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  onLogout?: () => void
}

export function Sidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname()

  const links = [
    { href: '/dashboard', label: 'Panel', icon: Home },
    { href: '/dashboard/proyectos', label: 'Proyectos', icon: Folder },
    { href: '/dashboard/catalogo', label: 'Catalogo', icon: Book },
    { href: '/dashboard/agentes', label: 'Agentes IA', icon: Bot },
    { href: '/dashboard/configuracion', label: 'Configuracion', icon: Settings },
  ]

  return (
    <aside className="w-64 border-r border-border bg-card">
      <div className="flex flex-col h-full">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold">ConstructionOS</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
            return (
              <Link key={href} href={href}>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-2',
                    isActive && 'bg-primary text-primary-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Button>
              </Link>
            )
          })}
        </nav>

        {/* User & Logout */}
        <div className="border-t border-border p-4 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesion
          </Button>
        </div>
      </div>
    </aside>
  )
}
