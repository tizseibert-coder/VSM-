// Auto-generated from the vsm-builder-prod Supabase project schema.
// Regenerate via the Supabase MCP `generate_typescript_types` tool after
// any migration instead of hand-editing this file.

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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          organization_id: string | null
          project_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          organization_id?: string | null
          project_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          organization_id?: string | null
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmark_data: {
        Row: {
          company_size: string | null
          created_at: string
          id: string
          industry: string | null
          median: number | null
          metric_name: string
          p25: number | null
          p75: number | null
          percentile: number | null
          project_id: string
          source: string
          your_value: number | null
        }
        Insert: {
          company_size?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          median?: number | null
          metric_name: string
          p25?: number | null
          p75?: number | null
          percentile?: number | null
          project_id: string
          source?: string
          your_value?: number | null
        }
        Update: {
          company_size?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          median?: number | null
          metric_name?: string
          p25?: number | null
          p75?: number | null
          percentile?: number | null
          project_id?: string
          source?: string
          your_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "benchmark_data_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmark_reference: {
        Row: {
          company_size: string
          id: string
          industry: string
          median: number | null
          metric_name: string
          p25: number | null
          p75: number | null
          source: string
          updated_at: string
        }
        Insert: {
          company_size: string
          id?: string
          industry: string
          median?: number | null
          metric_name: string
          p25?: number | null
          p75?: number | null
          source?: string
          updated_at?: string
        }
        Update: {
          company_size?: string
          id?: string
          industry?: string
          median?: number | null
          metric_name?: string
          p25?: number | null
          p75?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      historical_metrics: {
        Row: {
          created_at: string
          ct: number | null
          id: string
          measurement_date: string
          oee: number | null
          plt: number | null
          project_id: string
          wip: number | null
        }
        Insert: {
          created_at?: string
          ct?: number | null
          id?: string
          measurement_date?: string
          oee?: number | null
          plt?: number | null
          project_id: string
          wip?: number | null
        }
        Update: {
          created_at?: string
          ct?: number | null
          id?: string
          measurement_date?: string
          oee?: number | null
          plt?: number | null
          project_id?: string
          wip?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "historical_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_buffers: {
        Row: {
          buffer_type: string | null
          created_at: string
          flow_style: string | null
          from_process_id: string | null
          id: string
          kanban_type: string | null
          project_id: string
          scenario_id: string | null
          to_process_id: string | null
          wip_count: number
          x: number | null
          y: number | null
        }
        Insert: {
          buffer_type?: string | null
          created_at?: string
          flow_style?: string | null
          from_process_id?: string | null
          id?: string
          kanban_type?: string | null
          project_id: string
          scenario_id?: string | null
          to_process_id?: string | null
          wip_count: number
          x?: number | null
          y?: number | null
        }
        Update: {
          buffer_type?: string | null
          created_at?: string
          flow_style?: string | null
          from_process_id?: string | null
          id?: string
          kanban_type?: string | null
          project_id?: string
          scenario_id?: string | null
          to_process_id?: string | null
          wip_count?: number
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_buffers_from_process_id_fkey"
            columns: ["from_process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_buffers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_buffers_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_buffers_to_process_id_fkey"
            columns: ["to_process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      processes: {
        Row: {
          changeover_time: number
          classification: string | null
          color: string
          created_at: string
          cycle_time: number
          height: number
          id: string
          is_pacemaker: boolean
          lane: number
          name: string
          oee: number
          operator_count: number
          origin_process_id: string | null
          project_id: string
          scenario_id: string | null
          updated_at: string
          width: number
          wip: number
          x: number | null
          y: number | null
        }
        Insert: {
          changeover_time?: number
          classification?: string | null
          color?: string
          created_at?: string
          cycle_time: number
          height?: number
          id?: string
          is_pacemaker?: boolean
          lane?: number
          name: string
          oee?: number
          operator_count?: number
          origin_process_id?: string | null
          project_id: string
          scenario_id?: string | null
          updated_at?: string
          width?: number
          wip?: number
          x?: number | null
          y?: number | null
        }
        Update: {
          changeover_time?: number
          classification?: string | null
          color?: string
          created_at?: string
          cycle_time?: number
          height?: number
          id?: string
          is_pacemaker?: boolean
          lane?: number
          name?: string
          oee?: number
          operator_count?: number
          origin_process_id?: string | null
          project_id?: string
          scenario_id?: string | null
          updated_at?: string
          width?: number
          wip?: number
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "processes_origin_process_id_fkey"
            columns: ["origin_process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          annual_throughput: number | null
          available_minutes_per_day: number
          company: string | null
          created_at: string
          customer_name: string
          description: string | null
          erp_label: string
          id: string
          name: string
          organization_id: string
          product_name: string | null
          supplier_name: string
          updated_at: string
        }
        Insert: {
          annual_throughput?: number | null
          available_minutes_per_day?: number
          company?: string | null
          created_at?: string
          customer_name?: string
          description?: string | null
          erp_label?: string
          id?: string
          name: string
          organization_id: string
          product_name?: string | null
          supplier_name?: string
          updated_at?: string
        }
        Update: {
          annual_throughput?: number | null
          available_minutes_per_day?: number
          company?: string | null
          created_at?: string
          customer_name?: string
          description?: string | null
          erp_label?: string
          id?: string
          name?: string
          organization_id?: string
          product_name?: string | null
          supplier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          audience: string | null
          created_at: string
          id: string
          pdf_url: string
          project_id: string
          report_type: string | null
        }
        Insert: {
          audience?: string | null
          created_at?: string
          id?: string
          pdf_url: string
          project_id: string
          report_type?: string | null
        }
        Update: {
          audience?: string | null
          created_at?: string
          id?: string
          pdf_url?: string
          project_id?: string
          report_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          investment_chf: number | null
          name: string | null
          payback_months: number | null
          project_id: string
          risk_level: string | null
          type: string | null
          wip_reduction_percent: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          investment_chf?: number | null
          name?: string | null
          payback_months?: number | null
          project_id: string
          risk_level?: string | null
          type?: string | null
          wip_reduction_percent?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          investment_chf?: number | null
          name?: string | null
          payback_months?: number | null
          project_id?: string
          risk_level?: string | null
          type?: string | null
          wip_reduction_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      spaghetti_layouts: {
        Row: {
          background_image_url: string | null
          created_at: string
          id: string
          paths: Json
          project_id: string
          scale_meters_per_pixel: number
          stations: Json
          total_distance_meters: number | null
          updated_at: string
        }
        Insert: {
          background_image_url?: string | null
          created_at?: string
          id?: string
          paths?: Json
          project_id: string
          scale_meters_per_pixel?: number
          stations?: Json
          total_distance_meters?: number | null
          updated_at?: string
        }
        Update: {
          background_image_url?: string | null
          created_at?: string
          id?: string
          paths?: Json
          project_id?: string
          scale_meters_per_pixel?: number
          stations?: Json
          total_distance_meters?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaghetti_layouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_role: {
        Args: { min_role?: string; org_id: string }
        Returns: boolean
      }
      project_org_id: { Args: { p_project_id: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals["public"]

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
    Enums: {},
  },
} as const
