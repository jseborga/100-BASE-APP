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
  tipologia: z.string().optional(),
  ubicacion: z.string().optional(),
})

export type ProyectoInput = z.infer<typeof proyectoSchema>

export const bimImportSchema = z.object({
  proyecto_id: z.string().uuid('ID de proyecto inválido'),
  elementos: z.array(z.object({
    revit_id: z.string().optional(),
    revit_categoria: z.string().optional(),
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
  nombre_sugerido: z.string().min(1, 'El nombre es obligatorio'),
  unidad_sugerida: z.string().optional(),
  descripcion: z.string().optional(),
  origen: z.enum(['ia', 'usuario', 'bim']).optional(),
  contexto: z.record(z.string(), z.any()).optional(),
})

export type PartidaSugerenciaInput = z.infer<typeof partidaSugerenciaSchema>

// --- Agent schemas ---

export const agenteContextoSchema = z.object({
  pais: z.string().min(1, 'País es obligatorio'),
  pais_codigo: z.string().min(2).max(3),
  tipologia: z.string().optional(),
  proyecto_nombre: z.string().optional(),
  proyecto_id: z.string().uuid().optional(),
  normativa: z.string().optional(),
})

export const agenteMensajeSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

export const agenteRequestSchema = z.object({
  mensaje: z.string().min(1, 'El mensaje no puede estar vacío'),
  contexto: agenteContextoSchema,
  historial: z.array(agenteMensajeSchema).optional(),
  provider: z.enum(['anthropic', 'openai', 'gemini', 'openrouter']).optional(),
  model: z.string().optional(),
})

export type AgenteRequestInput = z.infer<typeof agenteRequestSchema>
