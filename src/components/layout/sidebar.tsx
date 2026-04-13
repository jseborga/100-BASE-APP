'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Book,
  Bot,
  GitBranch,
  Home,
  LogOut,
  Settings,
  Folder,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onLogout?: () => void
}

export function Sidebar({ collapsed, onToggle, onLogout }: SidebarProps) {
  const pathname = usePathname()

  const links = [
    { href: '/dashboard', label: 'Panel', icon: Home },
    { href: '/dashboard/proyectos', label: 'Proyectos', icon: Folder },
    { href: '/dashboard/catalogo', label: 'Catalogo', icon: Book },
    { href: '/dashboard/mapeos', label: 'Mapeos BIM', icon: GitBranch },
    { href: '/dashboard/agentes', label: 'Agentes IA', icon: Bot },
    { href: '/dashboard/configuracion', label: 'Configuracion', icon: Settings },
  ]

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'border-r border-border bg-card flex flex-col transition-all duration-200',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo/Brand */}
        <div className={cn('border-b border-border flex items-center', collapsed ? 'p-3 justify-center' : 'p-6')}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggle} className="p-1 rounded-md hover:bg-muted transition-colors">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">ConstructionOS</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-primary" />
                <span className="text-lg font-bold">ConstructionOS</span>
              </div>
              <button onClick={onToggle} className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground">
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn('flex-1 overflow-y-auto space-y-1', collapsed ? 'p-2' : 'p-4 space-y-2')}>
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))

            if (collapsed) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>
                    <Link href={href}>
                      <Button
                        variant={isActive ? 'default' : 'ghost'}
                        size="icon"
                        className={cn(
                          'w-full h-10',
                          isActive && 'bg-primary text-primary-foreground'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              )
            }

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

        {/* Bottom: expand button (collapsed) or logout */}
        <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-4')}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full h-10 text-muted-foreground"
                  onClick={onToggle}
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menu</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={onLogout}
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesion
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
