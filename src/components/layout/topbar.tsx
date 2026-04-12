'use client'

import { User, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TopbarProps {
  userEmail?: string
  onLogout?: () => void
}

export function Topbar({ userEmail, onLogout }: TopbarProps) {
  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-semibold"></h1>
        <div className="flex items-center gap-4">
          {userEmail && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted">
              <User className="w-4 h-4" />
              <span className="text-sm text-muted-foreground">{userEmail}</span>
            </div>
          )}
          {onLogout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
