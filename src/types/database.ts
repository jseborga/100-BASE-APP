export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      bim_elementos: {
        Row: {
          id: string
          importacion_id: string
          revit_id: string | null
          revit_categoria_id: string | null
          familia: string | null
          tipo: string | null
          parametros: Json | null
          partida_id: string | null
          metrado_calculado: number | null
          estado: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          importacion_id: string
          revit_id?: string | null
          revit_categoria_id?: string | null
          familia?: string | null
          tipo?: string | null
          parametros?: Json | null
          partida_id?: string | null
          metrado_calculado?: number | null
          estado?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          importacion_id?: string
          revit_id?: string | null
          revit_categoria_id?: string | null
          familia?: string | null
          tipo?: string | null
          parametros?: Json | null
          partida_id?: string | null
          metrado_calculado?: number | null
          estado?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bim_elementos_importacion_id_fkey"
            columns: ["importacion_id"]
            isOneToOne: false
            referencedRelation: "bim_importaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bim_elementos_revit_categoria_id_fkey"
            columns: ["revit_categoria_id"]
            isOneToOne: false
            referencedRelation: "revit_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bim_elementos_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          }
        ]
      }
      bim_importaciones: {
        Row: {
          id: string
          proyecto_id: string
          archivo_nombre: string | null
          total_elementos: number | null
          elementos_mapeados: number | null
          estado: string | null
          metadata: Json | null
          importado_por: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          proyecto_id: string
          archivo_nombre?: string | null
          total_elementos?: number | null
          elementos_mapeados?: number | null
          estado?: string | null
          metadata?: Json | null
          importado_por?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          proyecto_id?: string
          archivo_nombre?: string | null
          total_elementos?: number | null
          elementos_mapeados?: number | null
          estado?: string | null
          metadata?: Json | null
          importado_por?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bim_importaciones_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          }
        ]
      }
      divisiones: {
        Row: {
          id: string
          estandar_id: string
          codigo: string
          nombre: string
          orden: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          estandar_id: string
          codigo: string
          nombre: string
          orden?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          estandar_id?: string
          codigo?: string
          nombre?: string
          orden?: number | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "divisiones_estandar_id_fkey"
            columns: ["estandar_id"]
            isOneToOne: false
            referencedRelation: "estandares"
            referencedColumns: ["id"]
          }
        ]
      }
      estandares: {
        Row: {
          id: string
          pais_id: string
          codigo: string
          nombre: string
          descripcion: string | null
          version: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          pais_id: string
          codigo: string
          nombre: string
          descripcion?: string | null
          version?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          pais_id?: string
          codigo?: string
          nombre?: string
          descripcion?: string | null
          version?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estandares_pais_id_fkey"
            columns: ["pais_id"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["id"]
          }
        ]
      }
      paises: {
        Row: {
          id: string
          codigo: string
          nombre: string
          moneda: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          codigo: string
          nombre: string
          moneda?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          codigo?: string
          nombre?: string
          moneda?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      partida_localizaciones: {
        Row: {
          id: string
          partida_id: string
          estandar_id: string
          codigo_local: string
          referencia_norma: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          partida_id: string
          estandar_id: string
          codigo_local: string
          referencia_norma?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          partida_id?: string
          estandar_id?: string
          codigo_local?: string
          referencia_norma?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partida_localizaciones_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partida_localizaciones_estandar_id_fkey"
            columns: ["estandar_id"]
            isOneToOne: false
            referencedRelation: "estandares"
            referencedColumns: ["id"]
          }
        ]
      }
      partida_sugerencias: {
        Row: {
          id: string
          nombre_sugerido: string
          unidad_sugerida: string | null
          descripcion: string | null
          origen: string | null
          contexto: Json | null
          estado: string | null
          partida_creada_id: string | null
          sugerido_por: string | null
          revisado_por: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          nombre_sugerido: string
          unidad_sugerida?: string | null
          descripcion?: string | null
          origen?: string | null
          contexto?: Json | null
          estado?: string | null
          partida_creada_id?: string | null
          sugerido_por?: string | null
          revisado_por?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          nombre_sugerido?: string
          unidad_sugerida?: string | null
          descripcion?: string | null
          origen?: string | null
          contexto?: Json | null
          estado?: string | null
          partida_creada_id?: string | null
          sugerido_por?: string | null
          revisado_por?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partida_sugerencias_partida_creada_id_fkey"
            columns: ["partida_creada_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          }
        ]
      }
      partida_tags: {
        Row: {
          id: string
          partida_id: string
          tag_id: string
          peso: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          partida_id: string
          tag_id: string
          peso?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          partida_id?: string
          tag_id?: string
          peso?: number | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partida_tags_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partida_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          }
        ]
      }
      partidas: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          unidad: string
          tipo: string | null
          capitulo: string | null
          es_compuesta: boolean | null
          partida_padre_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          unidad: string
          tipo?: string | null
          capitulo?: string | null
          es_compuesta?: boolean | null
          partida_padre_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          unidad?: string
          tipo?: string | null
          capitulo?: string | null
          es_compuesta?: boolean | null
          partida_padre_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partidas_partida_padre_id_fkey"
            columns: ["partida_padre_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          }
        ]
      }
      proyecto_miembros: {
        Row: {
          id: string
          proyecto_id: string
          usuario_id: string
          rol: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          proyecto_id: string
          usuario_id: string
          rol?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          proyecto_id?: string
          usuario_id?: string
          rol?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_miembros_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          }
        ]
      }
      proyecto_partidas: {
        Row: {
          id: string
          proyecto_id: string
          partida_id: string
          cantidad: number | null
          metrado_manual: number | null
          metrado_bim: number | null
          metrado_final: number | null
          notas: string | null
          orden: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          proyecto_id: string
          partida_id: string
          cantidad?: number | null
          metrado_manual?: number | null
          metrado_bim?: number | null
          metrado_final?: number | null
          notas?: string | null
          orden?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          proyecto_id?: string
          partida_id?: string
          cantidad?: number | null
          metrado_manual?: number | null
          metrado_bim?: number | null
          metrado_final?: number | null
          notas?: string | null
          orden?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_partidas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_partidas_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          }
        ]
      }
      proyectos: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          pais_id: string
          tipologia: string | null
          ubicacion: string | null
          estado: string | null
          propietario_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          pais_id: string
          tipologia?: string | null
          ubicacion?: string | null
          estado?: string | null
          propietario_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          pais_id?: string
          tipologia?: string | null
          ubicacion?: string | null
          estado?: string | null
          propietario_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_pais_id_fkey"
            columns: ["pais_id"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["id"]
          }
        ]
      }
      revit_categorias: {
        Row: {
          id: string
          nombre: string
          nombre_es: string | null
          parametros_clave: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          nombre: string
          nombre_es?: string | null
          parametros_clave?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          nombre_es?: string | null
          parametros_clave?: Json | null
          created_at?: string | null
        }
        Relationships: []
      }
      revit_mapeos: {
        Row: {
          id: string
          revit_categoria_id: string
          partida_id: string
          formula: string
          parametro_principal: string | null
          descripcion: string | null
          prioridad: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          revit_categoria_id: string
          partida_id: string
          formula: string
          parametro_principal?: string | null
          descripcion?: string | null
          prioridad?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          revit_categoria_id?: string
          partida_id?: string
          formula?: string
          parametro_principal?: string | null
          descripcion?: string | null
          prioridad?: number | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revit_mapeos_revit_categoria_id_fkey"
            columns: ["revit_categoria_id"]
            isOneToOne: false
            referencedRelation: "revit_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revit_mapeos_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          }
        ]
      }
      tags: {
        Row: {
          id: string
          dimension: string
          valor: string
          descripcion: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          dimension: string
          valor: string
          descripcion?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          dimension?: string
          valor?: string
          descripcion?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
