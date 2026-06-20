export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      centros: {
        Row: {
          codigo: string
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      compradores: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          aduana: string | null
          afe_proyecto: string | null
          assets: string | null
          asunto_correo: string | null
          ata: string | null
          awb: string | null
          bdp_job: string | null
          bl: string | null
          campo: string | null
          carrier: string | null
          categoria: string | null
          categoria_seguimiento: string | null
          centro: string | null
          cliente: string | null
          codigo_sap: string | null
          colector_costo: string | null
          comprador: string | null
          compromiso_proveedor: string | null
          contenedor: string | null
          created_at: string
          created_by: string | null
          criterio_retraso: string | null
          cuenta: string | null
          customer: string | null
          descripcion_incoterms: string | null
          descripcion_material: string | null
          destino: string | null
          detalle_status: string | null
          dias_incumplimiento: number | null
          do_num: string | null
          escalado: boolean | null
          eta: string | null
          eta_campo: string | null
          eta_puerto: string | null
          etd_origen: string | null
          factura: string | null
          fecha_aceptacion: string | null
          fecha_bodega: string | null
          fecha_compromiso: string | null
          fecha_creacion: string | null
          fecha_entrega_contractual: string | null
          fecha_nacionalizacion: string | null
          fecha_notificacion_proveedor: string | null
          nombre_centro: string | null
          estado_entrega: string | null
          estado_adicional: string | null
          rango_inspeccion: string | null
          rango_incumplimiento_informado: string | null
          control_incumplimiento: string | null
          anio: number | null
          mes: number | null
          fecha_orden: string | null
          fecha_puerto: string | null
          fecha_recepcion: string | null
          fecha_seguimiento: string | null
          forwarder: string | null
          gerencia: string | null
          grupo_articulo: string | null
          id: string
          incoterms: string | null
          invoice: string | null
          llave: string | null
          lugar_llegada: string | null
          material: string | null
          modalidad_impo: string | null
          modo: string | null
          moneda: string | null
          moneda_pedido: string | null
          motivo_retraso: string | null
          naviera: string | null
          nombre_grupo_articulo: string | null
          numero: number | null
          observaciones: string | null
          oc: string | null
          origen: string | null
          pais_origen: string | null
          pais_procedencia: string | null
          peso: number | null
          posicion: string | null
          prioridad: string | null
          proveedor: string | null
          qty: number | null
          qty_entregada: number | null
          qty_pendiente: number | null
          responsable: string | null
          sociedad: string | null
          solicitante: string | null
          status: string
          status_general: string | null
          subcategoria: string | null
          teus: number | null
          tipo_compra: string | null
          um: string | null
          updated_at: string
          valor_pendiente_cop: number | null
          valor_pendiente_usd: number | null
          valor_total: number | null
          valor_total_usd: number | null
          valor_unit_usd: number | null
          valor_unitario: number | null
        }
        Insert: {
          aduana?: string | null
          afe_proyecto?: string | null
          assets?: string | null
          asunto_correo?: string | null
          ata?: string | null
          awb?: string | null
          bdp_job?: string | null
          bl?: string | null
          campo?: string | null
          carrier?: string | null
          categoria?: string | null
          categoria_seguimiento?: string | null
          centro?: string | null
          cliente?: string | null
          codigo_sap?: string | null
          colector_costo?: string | null
          comprador?: string | null
          compromiso_proveedor?: string | null
          contenedor?: string | null
          created_at?: string
          created_by?: string | null
          criterio_retraso?: string | null
          cuenta?: string | null
          customer?: string | null
          descripcion_incoterms?: string | null
          descripcion_material?: string | null
          destino?: string | null
          detalle_status?: string | null
          dias_incumplimiento?: number | null
          do_num?: string | null
          escalado?: boolean | null
          eta?: string | null
          eta_campo?: string | null
          eta_puerto?: string | null
          etd_origen?: string | null
          factura?: string | null
          fecha_aceptacion?: string | null
          fecha_bodega?: string | null
          fecha_compromiso?: string | null
          fecha_creacion?: string | null
          fecha_entrega_contractual?: string | null
          fecha_nacionalizacion?: string | null
          fecha_notificacion_proveedor?: string | null
          nombre_centro?: string | null
          estado_entrega?: string | null
          estado_adicional?: string | null
          rango_inspeccion?: string | null
          rango_incumplimiento_informado?: string | null
          control_incumplimiento?: string | null
          anio?: number | null
          mes?: number | null
          fecha_orden?: string | null
          fecha_puerto?: string | null
          fecha_recepcion?: string | null
          fecha_seguimiento?: string | null
          forwarder?: string | null
          gerencia?: string | null
          grupo_articulo?: string | null
          id?: string
          incoterms?: string | null
          invoice?: string | null
          llave?: string | null
          lugar_llegada?: string | null
          material?: string | null
          modalidad_impo?: string | null
          modo?: string | null
          moneda?: string | null
          moneda_pedido?: string | null
          motivo_retraso?: string | null
          naviera?: string | null
          nombre_grupo_articulo?: string | null
          numero?: number | null
          observaciones?: string | null
          oc?: string | null
          origen?: string | null
          pais_origen?: string | null
          pais_procedencia?: string | null
          peso?: number | null
          posicion?: string | null
          prioridad?: string | null
          proveedor?: string | null
          qty?: number | null
          qty_entregada?: number | null
          qty_pendiente?: number | null
          responsable?: string | null
          sociedad?: string | null
          solicitante?: string | null
          status?: string
          status_general?: string | null
          subcategoria?: string | null
          teus?: number | null
          tipo_compra?: string | null
          um?: string | null
          updated_at?: string
          valor_pendiente_cop?: number | null
          valor_pendiente_usd?: number | null
          valor_total?: number | null
          valor_total_usd?: number | null
          valor_unit_usd?: number | null
          valor_unitario?: number | null
        }
        Update: {
          aduana?: string | null
          afe_proyecto?: string | null
          assets?: string | null
          asunto_correo?: string | null
          ata?: string | null
          awb?: string | null
          bdp_job?: string | null
          bl?: string | null
          campo?: string | null
          carrier?: string | null
          categoria?: string | null
          categoria_seguimiento?: string | null
          centro?: string | null
          cliente?: string | null
          codigo_sap?: string | null
          colector_costo?: string | null
          comprador?: string | null
          compromiso_proveedor?: string | null
          contenedor?: string | null
          created_at?: string
          created_by?: string | null
          criterio_retraso?: string | null
          cuenta?: string | null
          customer?: string | null
          descripcion_incoterms?: string | null
          descripcion_material?: string | null
          destino?: string | null
          detalle_status?: string | null
          dias_incumplimiento?: number | null
          do_num?: string | null
          escalado?: boolean | null
          eta?: string | null
          eta_campo?: string | null
          eta_puerto?: string | null
          etd_origen?: string | null
          factura?: string | null
          fecha_aceptacion?: string | null
          fecha_bodega?: string | null
          fecha_compromiso?: string | null
          fecha_creacion?: string | null
          fecha_entrega_contractual?: string | null
          fecha_nacionalizacion?: string | null
          fecha_notificacion_proveedor?: string | null
          fecha_orden?: string | null
          fecha_puerto?: string | null
          fecha_recepcion?: string | null
          fecha_seguimiento?: string | null
          forwarder?: string | null
          gerencia?: string | null
          grupo_articulo?: string | null
          id?: string
          incoterms?: string | null
          invoice?: string | null
          llave?: string | null
          lugar_llegada?: string | null
          material?: string | null
          modalidad_impo?: string | null
          modo?: string | null
          moneda?: string | null
          moneda_pedido?: string | null
          motivo_retraso?: string | null
          naviera?: string | null
          nombre_centro?: string | null
          nombre_grupo_articulo?: string | null
          numero?: number | null
          observaciones?: string | null
          oc?: string | null
          origen?: string | null
          pais_origen?: string | null
          pais_procedencia?: string | null
          peso?: number | null
          posicion?: string | null
          prioridad?: string | null
          proveedor?: string | null
          qty?: number | null
          qty_entregada?: number | null
          qty_pendiente?: number | null
          responsable?: string | null
          sociedad?: string | null
          solicitante?: string | null
          status?: string
          status_general?: string | null
          subcategoria?: string | null
          teus?: number | null
          tipo_compra?: string | null
          um?: string | null
          updated_at?: string
          valor_pendiente_cop?: number | null
          valor_pendiente_usd?: number | null
          valor_total?: number | null
          valor_total_usd?: number | null
          valor_unit_usd?: number | null
          valor_unitario?: number | null
        }
        Relationships: []
      }
      materiales: {
        Row: {
          categoria: string | null
          codigo_sap: string | null
          created_at: string
          descripcion: string
          grupo_articulo: string | null
          id: string
          subcategoria: string | null
          um: string | null
        }
        Insert: {
          categoria?: string | null
          codigo_sap?: string | null
          created_at?: string
          descripcion: string
          grupo_articulo?: string | null
          id?: string
          subcategoria?: string | null
          um?: string | null
        }
        Update: {
          categoria?: string | null
          codigo_sap?: string | null
          created_at?: string
          descripcion?: string
          grupo_articulo?: string | null
          id?: string
          subcategoria?: string | null
          um?: string | null
        }
        Relationships: []
      }
      motivos_retraso: {
        Row: {
          created_at: string
          criterio: string | null
          id: string
          motivo: string
        }
        Insert: {
          created_at?: string
          criterio?: string | null
          id?: string
          motivo: string
        }
        Update: {
          created_at?: string
          criterio?: string | null
          id?: string
          motivo?: string
        }
        Relationships: []
      }
      paises: {
        Row: {
          codigo: string | null
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          acreedor: string | null
          celular: string | null
          contacto: string | null
          created_at: string
          email: string | null
          expeditor: string | null
          id: string
          nit: string | null
          numero: number | null
          razon_social: string
          sociedad: string | null
          updated_at: string
        }
        Insert: {
          acreedor?: string | null
          celular?: string | null
          contacto?: string | null
          created_at?: string
          email?: string | null
          expeditor?: string | null
          id?: string
          nit?: string | null
          numero?: number | null
          razon_social: string
          sociedad?: string | null
          updated_at?: string
        }
        Update: {
          acreedor?: string | null
          celular?: string | null
          contacto?: string | null
          created_at?: string
          email?: string | null
          expeditor?: string | null
          id?: string
          nit?: string | null
          numero?: number | null
          razon_social?: string
          sociedad?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operador" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]
export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never
export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never
export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never
export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never
export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operador", "viewer"],
    },
  },
} as const
