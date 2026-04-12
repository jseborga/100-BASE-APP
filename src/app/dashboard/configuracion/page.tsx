'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

export default function ConfiguracionPage() {
  const [formData, setFormData] = useState({
    empresa: '',
    pais: '',
    normativa: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Saving settings:', formData)
  }

  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">
          Personaliza tus preferencias y configuración de la plataforma
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Perfil */}
        <Card>
          <CardHeader>
            <CardTitle>Información de la Empresa</CardTitle>
            <CardDescription>
              Datos básicos de tu organización
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="empresa">Nombre de la empresa</Label>
                <Input
                  id="empresa"
                  name="empresa"
                  placeholder="Ej: SSA Ingeniería"
                  value={formData.empresa}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pais">País</Label>
                <Input
                  id="pais"
                  name="pais"
                  placeholder="Ej: Bolivia"
                  value={formData.pais}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="normativa">Normativa por defecto</Label>
                <Input
                  id="normativa"
                  name="normativa"
                  placeholder="Ej: NB (Normas Bolivianas)"
                  value={formData.normativa}
                  onChange={handleChange}
                />
              </div>

              <Button type="submit">Guardar cambios</Button>
            </form>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle>Integraciones</CardTitle>
            <CardDescription>
              Configura tus conexiones externas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-md bg-muted text-sm text-muted-foreground">
              <p className="font-semibold mb-2">Próximamente:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Integración con Revit Add-in</li>
                <li>Conexión con Odoo</li>
                <li>Exportación a S10</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Datos */}
        <Card>
          <CardHeader>
            <CardTitle>Datos y privacidad</CardTitle>
            <CardDescription>
              Gestiona tu información personal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full">
              Descargar mis datos
            </Button>
            <Button variant="destructive" className="w-full">
              Eliminar cuenta
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
