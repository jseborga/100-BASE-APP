import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const proyectoSchema = z.object({
  nombre: z.string().min(1, 'El nombre del proyecto es obligatorio'),
  descripcion: z.string().optional(),
  pais_id: z.string().uuid('País inválido'),
  estandar_id: z.string().uuid('Estándar inválido'),
})

export type ProyectoInput = z.infer<typeof proyectoSchema>

export const bimImportSchema = z.object({
  proyecto_id: z.string().uuid('ID de proyecto inválido'),
  elementos: z.array(z.object({
    categoria_revit: z.string(),
    familia: z.string(),
    tipo: z.string(),
    area: z.number().optional(),
    volumen: z.number().optional(),
    longitud: z.number().optional(),
    cantidad: z.number().optional(),
    parametros: z.record(z.string(), z.any()).optional(),
  })),
})

export type BimImportInput = z.infer<typeof bimImportSchema>

export const partidaSugerenciaSchema = z.object({
  proyecto_id: z.string().uuid(),
  nombre: z.string(),
  descripcion: z.string().optional(),
  unidad: z.string(),
  tipo_proyecto: z.string().optional(),
  fase: z.string().optional(),
})

export type PartidaSugerenciaInput = z.infer<typeof partidaSugerenciaSchema>
