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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
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
      ArticleRequirementSetting: {
        Row: {
          id: string
          machineId: string | null
          organizationId: string
          required: boolean
          updatedAt: string
        }
        Insert: {
          id: string
          machineId?: string | null
          organizationId: string
          required: boolean
          updatedAt: string
        }
        Update: {
          id?: string
          machineId?: string | null
          organizationId?: string
          required?: boolean
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ArticleRequirementSetting_machineId_fkey"
            columns: ["machineId"]
            isOneToOne: false
            referencedRelation: "Machine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ArticleRequirementSetting_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      AttendanceEvent: {
        Row: {
          activityType: Database["public"]["Enums"]["ActivityType"]
          clockInAt: string
          clockOutAt: string | null
          createdAt: string
          createdBy: string
          id: string
          machineId: string
          organizationId: string
          personnelId: string
          shiftId: string | null
          source: Database["public"]["Enums"]["AttendanceSource"]
        }
        Insert: {
          activityType?: Database["public"]["Enums"]["ActivityType"]
          clockInAt: string
          clockOutAt?: string | null
          createdAt?: string
          createdBy: string
          id: string
          machineId: string
          organizationId: string
          personnelId: string
          shiftId?: string | null
          source: Database["public"]["Enums"]["AttendanceSource"]
        }
        Update: {
          activityType?: Database["public"]["Enums"]["ActivityType"]
          clockInAt?: string
          clockOutAt?: string | null
          createdAt?: string
          createdBy?: string
          id?: string
          machineId?: string
          organizationId?: string
          personnelId?: string
          shiftId?: string | null
          source?: Database["public"]["Enums"]["AttendanceSource"]
        }
        Relationships: [
          {
            foreignKeyName: "AttendanceEvent_machineId_fkey"
            columns: ["machineId"]
            isOneToOne: false
            referencedRelation: "Machine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AttendanceEvent_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AttendanceEvent_personnelId_fkey"
            columns: ["personnelId"]
            isOneToOne: false
            referencedRelation: "Personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AttendanceEvent_shiftId_fkey"
            columns: ["shiftId"]
            isOneToOne: false
            referencedRelation: "Shift"
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
      consulting_leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
          source: string
          status: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          source?: string
          status?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      Escalation: {
        Row: {
          acknowledgedAt: string | null
          acknowledgedBy: string | null
          assignedTo: string | null
          autoEscalatedAt: string | null
          dueDate: string | null
          id: string
          impact: Database["public"]["Enums"]["EscalationImpact"]
          machineId: string
          note: string | null
          organizationId: string
          pillar: Database["public"]["Enums"]["QdipPillar"]
          resolutionNote: string | null
          resolvedAt: string | null
          resolvedBy: string | null
          status: Database["public"]["Enums"]["EscalationStatus"]
          tier: Database["public"]["Enums"]["EscalationTier"]
          triggeredAt: string
          triggeredBy: string
        }
        Insert: {
          acknowledgedAt?: string | null
          acknowledgedBy?: string | null
          assignedTo?: string | null
          autoEscalatedAt?: string | null
          dueDate?: string | null
          id: string
          impact?: Database["public"]["Enums"]["EscalationImpact"]
          machineId: string
          note?: string | null
          organizationId: string
          pillar: Database["public"]["Enums"]["QdipPillar"]
          resolutionNote?: string | null
          resolvedAt?: string | null
          resolvedBy?: string | null
          status?: Database["public"]["Enums"]["EscalationStatus"]
          tier: Database["public"]["Enums"]["EscalationTier"]
          triggeredAt?: string
          triggeredBy: string
        }
        Update: {
          acknowledgedAt?: string | null
          acknowledgedBy?: string | null
          assignedTo?: string | null
          autoEscalatedAt?: string | null
          dueDate?: string | null
          id?: string
          impact?: Database["public"]["Enums"]["EscalationImpact"]
          machineId?: string
          note?: string | null
          organizationId?: string
          pillar?: Database["public"]["Enums"]["QdipPillar"]
          resolutionNote?: string | null
          resolvedAt?: string | null
          resolvedBy?: string | null
          status?: Database["public"]["Enums"]["EscalationStatus"]
          tier?: Database["public"]["Enums"]["EscalationTier"]
          triggeredAt?: string
          triggeredBy?: string
        }
        Relationships: [
          {
            foreignKeyName: "Escalation_machineId_fkey"
            columns: ["machineId"]
            isOneToOne: false
            referencedRelation: "Machine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Escalation_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      Invitation: {
        Row: {
          acceptedAt: string | null
          createdAt: string
          email: string
          expiresAt: string
          id: string
          invitedBy: string
          organizationId: string
          revokedAt: string | null
          role: Database["public"]["Enums"]["Role"]
          token: string
        }
        Insert: {
          acceptedAt?: string | null
          createdAt?: string
          email: string
          expiresAt: string
          id: string
          invitedBy: string
          organizationId: string
          revokedAt?: string | null
          role: Database["public"]["Enums"]["Role"]
          token: string
        }
        Update: {
          acceptedAt?: string | null
          createdAt?: string
          email?: string
          expiresAt?: string
          id?: string
          invitedBy?: string
          organizationId?: string
          revokedAt?: string | null
          role?: Database["public"]["Enums"]["Role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "Invitation_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      LossEntry: {
        Row: {
          category: Database["public"]["Enums"]["LossEntryCategory"]
          createdAt: string
          description: string | null
          durationMin: number
          id: string
          trackingLogId: string
        }
        Insert: {
          category: Database["public"]["Enums"]["LossEntryCategory"]
          createdAt?: string
          description?: string | null
          durationMin: number
          id: string
          trackingLogId: string
        }
        Update: {
          category?: Database["public"]["Enums"]["LossEntryCategory"]
          createdAt?: string
          description?: string | null
          durationMin?: number
          id?: string
          trackingLogId?: string
        }
        Relationships: [
          {
            foreignKeyName: "LossEntry_trackingLogId_fkey"
            columns: ["trackingLogId"]
            isOneToOne: false
            referencedRelation: "TrackingLog"
            referencedColumns: ["id"]
          },
        ]
      }
      Machine: {
        Row: {
          archivedAt: string | null
          id: string
          identifier: string
          mqttTopic: string | null
          name: string
          opcuaNodeId: string | null
          organizationId: string
          status: Database["public"]["Enums"]["MachineStatus"]
          type: Database["public"]["Enums"]["MachineType"]
        }
        Insert: {
          archivedAt?: string | null
          id: string
          identifier: string
          mqttTopic?: string | null
          name: string
          opcuaNodeId?: string | null
          organizationId: string
          status?: Database["public"]["Enums"]["MachineStatus"]
          type: Database["public"]["Enums"]["MachineType"]
        }
        Update: {
          archivedAt?: string | null
          id?: string
          identifier?: string
          mqttTopic?: string | null
          name?: string
          opcuaNodeId?: string | null
          organizationId?: string
          status?: Database["public"]["Enums"]["MachineStatus"]
          type?: Database["public"]["Enums"]["MachineType"]
        }
        Relationships: [
          {
            foreignKeyName: "Machine_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      MachineStatusLog: {
        Row: {
          category: Database["public"]["Enums"]["LossCategory"] | null
          durationMin: number | null
          endedAt: string | null
          id: string
          lossType: Database["public"]["Enums"]["LossType"] | null
          machineId: string
          reason: string | null
          startedAt: string
          status: Database["public"]["Enums"]["MachineStatus"]
        }
        Insert: {
          category?: Database["public"]["Enums"]["LossCategory"] | null
          durationMin?: number | null
          endedAt?: string | null
          id: string
          lossType?: Database["public"]["Enums"]["LossType"] | null
          machineId: string
          reason?: string | null
          startedAt?: string
          status: Database["public"]["Enums"]["MachineStatus"]
        }
        Update: {
          category?: Database["public"]["Enums"]["LossCategory"] | null
          durationMin?: number | null
          endedAt?: string | null
          id?: string
          lossType?: Database["public"]["Enums"]["LossType"] | null
          machineId?: string
          reason?: string | null
          startedAt?: string
          status?: Database["public"]["Enums"]["MachineStatus"]
        }
        Relationships: [
          {
            foreignKeyName: "MachineStatusLog_machineId_fkey"
            columns: ["machineId"]
            isOneToOne: false
            referencedRelation: "Machine"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_entitlements: {
        Row: {
          granted_at: string | null
          id: string
          organization_id: string
          product: Database["public"]["Enums"]["AppProduct"]
          requested_at: string
          status: Database["public"]["Enums"]["EntitlementStatus"]
          tier: Database["public"]["Enums"]["Tier"]
        }
        Insert: {
          granted_at?: string | null
          id?: string
          organization_id: string
          product: Database["public"]["Enums"]["AppProduct"]
          requested_at?: string
          status?: Database["public"]["Enums"]["EntitlementStatus"]
          tier?: Database["public"]["Enums"]["Tier"]
        }
        Update: {
          granted_at?: string | null
          id?: string
          organization_id?: string
          product?: Database["public"]["Enums"]["AppProduct"]
          requested_at?: string
          status?: Database["public"]["Enums"]["EntitlementStatus"]
          tier?: Database["public"]["Enums"]["Tier"]
        }
        Relationships: [
          {
            foreignKeyName: "organization_entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          organization_id: string
          revoked_at: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          organization_id: string
          revoked_at?: string | null
          role: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          revoked_at?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      Personnel: {
        Row: {
          costCategory: Database["public"]["Enums"]["PersonnelCostCat"]
          employeeNumber: string | null
          hourlyRate: number
          id: string
          name: string
          organizationId: string
          pinHash: string | null
          rfidTag: string | null
        }
        Insert: {
          costCategory: Database["public"]["Enums"]["PersonnelCostCat"]
          employeeNumber?: string | null
          hourlyRate: number
          id: string
          name: string
          organizationId: string
          pinHash?: string | null
          rfidTag?: string | null
        }
        Update: {
          costCategory?: Database["public"]["Enums"]["PersonnelCostCat"]
          employeeNumber?: string | null
          hourlyRate?: number
          id?: string
          name?: string
          organizationId?: string
          pinHash?: string | null
          rfidTag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Personnel_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      PillarThreshold: {
        Row: {
          id: string
          machineId: string | null
          organizationId: string
          pillar: Database["public"]["Enums"]["QdipPillar"]
          thresholdGood: number
          thresholdWarning: number
          updatedAt: string
        }
        Insert: {
          id: string
          machineId?: string | null
          organizationId: string
          pillar: Database["public"]["Enums"]["QdipPillar"]
          thresholdGood: number
          thresholdWarning: number
          updatedAt: string
        }
        Update: {
          id?: string
          machineId?: string | null
          organizationId?: string
          pillar?: Database["public"]["Enums"]["QdipPillar"]
          thresholdGood?: number
          thresholdWarning?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "PillarThreshold_machineId_fkey"
            columns: ["machineId"]
            isOneToOne: false
            referencedRelation: "Machine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PillarThreshold_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          changeover_time: number
          classification: string | null
          color: string
          created_at: string
          cycle_time: number
          has_heijunka: boolean
          height: number
          id: string
          is_pacemaker: boolean
          kaizen_note: string | null
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
          has_heijunka?: boolean
          height?: number
          id?: string
          is_pacemaker?: boolean
          kaizen_note?: string | null
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
          has_heijunka?: boolean
          height?: number
          id?: string
          is_pacemaker?: boolean
          kaizen_note?: string | null
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
      Product: {
        Row: {
          createdAt: string
          description: string | null
          id: string
          name: string
          organizationId: string
          productId: string
        }
        Insert: {
          createdAt?: string
          description?: string | null
          id: string
          name: string
          organizationId: string
          productId: string
        }
        Update: {
          createdAt?: string
          description?: string | null
          id?: string
          name?: string
          organizationId?: string
          productId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Product_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          currency: string
          customer_name: string
          description: string | null
          erp_label: string
          id: string
          name: string
          organization_id: string
          piece_value: number | null
          pitch_minutes: number | null
          product_name: string | null
          supplier_name: string
          updated_at: string
        }
        Insert: {
          annual_throughput?: number | null
          available_minutes_per_day?: number
          company?: string | null
          created_at?: string
          currency?: string
          customer_name?: string
          description?: string | null
          erp_label?: string
          id?: string
          name: string
          organization_id: string
          piece_value?: number | null
          pitch_minutes?: number | null
          product_name?: string | null
          supplier_name?: string
          updated_at?: string
        }
        Update: {
          annual_throughput?: number | null
          available_minutes_per_day?: number
          company?: string | null
          created_at?: string
          currency?: string
          customer_name?: string
          description?: string | null
          erp_label?: string
          id?: string
          name?: string
          organization_id?: string
          piece_value?: number | null
          pitch_minutes?: number | null
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
      QualityHourlyEntry: {
        Row: {
          badParts: number
          createdAt: string
          createdBy: string
          date: string
          goodParts: number
          hour: number
          id: string
          lossCategory: Database["public"]["Enums"]["LossCategory"] | null
          machineId: string
          notes: string | null
          organizationId: string
          productId: string | null
          standardTimeId: string | null
          updatedAt: string
        }
        Insert: {
          badParts?: number
          createdAt?: string
          createdBy: string
          date: string
          goodParts?: number
          hour: number
          id: string
          lossCategory?: Database["public"]["Enums"]["LossCategory"] | null
          machineId: string
          notes?: string | null
          organizationId: string
          productId?: string | null
          standardTimeId?: string | null
          updatedAt: string
        }
        Update: {
          badParts?: number
          createdAt?: string
          createdBy?: string
          date?: string
          goodParts?: number
          hour?: number
          id?: string
          lossCategory?: Database["public"]["Enums"]["LossCategory"] | null
          machineId?: string
          notes?: string | null
          organizationId?: string
          productId?: string | null
          standardTimeId?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "QualityHourlyEntry_machineId_fkey"
            columns: ["machineId"]
            isOneToOne: false
            referencedRelation: "Machine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "QualityHourlyEntry_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "QualityHourlyEntry_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "Product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "QualityHourlyEntry_standardTimeId_fkey"
            columns: ["standardTimeId"]
            isOneToOne: false
            referencedRelation: "StandardTime"
            referencedColumns: ["id"]
          },
        ]
      }
      Queue: {
        Row: {
          completedAt: string | null
          createdAt: string
          deadline: string | null
          description: string | null
          id: string
          machineId: string
          orderNumber: string
          organizationId: string
          plannedHours: number
          priority: number
          startedAt: string | null
          status: Database["public"]["Enums"]["QueueStatus"]
        }
        Insert: {
          completedAt?: string | null
          createdAt?: string
          deadline?: string | null
          description?: string | null
          id: string
          machineId: string
          orderNumber: string
          organizationId: string
          plannedHours: number
          priority?: number
          startedAt?: string | null
          status?: Database["public"]["Enums"]["QueueStatus"]
        }
        Update: {
          completedAt?: string | null
          createdAt?: string
          deadline?: string | null
          description?: string | null
          id?: string
          machineId?: string
          orderNumber?: string
          organizationId?: string
          plannedHours?: number
          priority?: number
          startedAt?: string | null
          status?: Database["public"]["Enums"]["QueueStatus"]
        }
        Relationships: [
          {
            foreignKeyName: "Queue_machineId_fkey"
            columns: ["machineId"]
            isOneToOne: false
            referencedRelation: "Machine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Queue_organizationId_fkey"
            columns: ["organizationId"]
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
          parent_scenario_id: string | null
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
          parent_scenario_id?: string | null
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
          parent_scenario_id?: string | null
          payback_months?: number | null
          project_id?: string
          risk_level?: string | null
          type?: string | null
          wip_reduction_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_parent_scenario_id_fkey"
            columns: ["parent_scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      Shift: {
        Row: {
          date: string
          endTime: string
          id: string
          name: string
          organizationId: string
          startTime: string
        }
        Insert: {
          date: string
          endTime: string
          id: string
          name: string
          organizationId: string
          startTime: string
        }
        Update: {
          date?: string
          endTime?: string
          id?: string
          name?: string
          organizationId?: string
          startTime?: string
        }
        Relationships: [
          {
            foreignKeyName: "Shift_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ShiftAssignment: {
        Row: {
          actualCost: number | null
          hoursActual: number | null
          hoursPlanned: number
          id: string
          personnelId: string
          plannedCost: number | null
          shiftId: string
        }
        Insert: {
          actualCost?: number | null
          hoursActual?: number | null
          hoursPlanned: number
          id: string
          personnelId: string
          plannedCost?: number | null
          shiftId: string
        }
        Update: {
          actualCost?: number | null
          hoursActual?: number | null
          hoursPlanned?: number
          id?: string
          personnelId?: string
          plannedCost?: number | null
          shiftId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ShiftAssignment_personnelId_fkey"
            columns: ["personnelId"]
            isOneToOne: false
            referencedRelation: "Personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ShiftAssignment_shiftId_fkey"
            columns: ["shiftId"]
            isOneToOne: false
            referencedRelation: "Shift"
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
      StandardTime: {
        Row: {
          createdAt: string
          createdBy: string
          dtMinutes: number
          id: string
          machineId: string
          organizationId: string
          productId: string
          targetAvailability: number | null
          targetKE: number | null
          targetMDR: number | null
          targetPerformance: number | null
          targetQuality: number | null
          utMinutes: number
          validFrom: string
          validTo: string | null
        }
        Insert: {
          createdAt?: string
          createdBy: string
          dtMinutes: number
          id: string
          machineId: string
          organizationId: string
          productId: string
          targetAvailability?: number | null
          targetKE?: number | null
          targetMDR?: number | null
          targetPerformance?: number | null
          targetQuality?: number | null
          utMinutes: number
          validFrom?: string
          validTo?: string | null
        }
        Update: {
          createdAt?: string
          createdBy?: string
          dtMinutes?: number
          id?: string
          machineId?: string
          organizationId?: string
          productId?: string
          targetAvailability?: number | null
          targetKE?: number | null
          targetMDR?: number | null
          targetPerformance?: number | null
          targetQuality?: number | null
          utMinutes?: number
          validFrom?: string
          validTo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "StandardTime_machineId_fkey"
            columns: ["machineId"]
            isOneToOne: false
            referencedRelation: "Machine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "StandardTime_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "StandardTime_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "Product"
            referencedColumns: ["id"]
          },
        ]
      }
      TrackingLog: {
        Row: {
          actualOutput: number
          availability: number | null
          badParts: number
          blockedTimeMin: number | null
          createdAt: string
          createdBy: string
          date: string
          dlp: number | null
          dtMin: number | null
          dvcExternMin: number | null
          goodOTMin: number | null
          goodParts: number
          id: string
          ke: number | null
          lossCategory: Database["public"]["Enums"]["LossCategory"] | null
          machineId: string | null
          mdr: number | null
          nonQualityMin: number | null
          notes: string | null
          npvHours: number
          npvSupportMin: number | null
          oee: number | null
          operatorCount: number | null
          organizationId: string
          performance: number | null
          planAchievement: number | null
          plannedOutput: number
          productId: string | null
          pvHours: number
          quality: number | null
          runningTimeMin: number | null
          scheduledProdTimeMin: number | null
          shiftId: string | null
          standardTimeId: string | null
          starvedTimeMin: number | null
          totalOTMin: number | null
          uncertaintiesMin: number | null
          unplannedDownMin: number | null
          upTimeMin: number | null
          utMin: number | null
        }
        Insert: {
          actualOutput: number
          availability?: number | null
          badParts?: number
          blockedTimeMin?: number | null
          createdAt?: string
          createdBy: string
          date: string
          dlp?: number | null
          dtMin?: number | null
          dvcExternMin?: number | null
          goodOTMin?: number | null
          goodParts?: number
          id: string
          ke?: number | null
          lossCategory?: Database["public"]["Enums"]["LossCategory"] | null
          machineId?: string | null
          mdr?: number | null
          nonQualityMin?: number | null
          notes?: string | null
          npvHours: number
          npvSupportMin?: number | null
          oee?: number | null
          operatorCount?: number | null
          organizationId: string
          performance?: number | null
          planAchievement?: number | null
          plannedOutput: number
          productId?: string | null
          pvHours: number
          quality?: number | null
          runningTimeMin?: number | null
          scheduledProdTimeMin?: number | null
          shiftId?: string | null
          standardTimeId?: string | null
          starvedTimeMin?: number | null
          totalOTMin?: number | null
          uncertaintiesMin?: number | null
          unplannedDownMin?: number | null
          upTimeMin?: number | null
          utMin?: number | null
        }
        Update: {
          actualOutput?: number
          availability?: number | null
          badParts?: number
          blockedTimeMin?: number | null
          createdAt?: string
          createdBy?: string
          date?: string
          dlp?: number | null
          dtMin?: number | null
          dvcExternMin?: number | null
          goodOTMin?: number | null
          goodParts?: number
          id?: string
          ke?: number | null
          lossCategory?: Database["public"]["Enums"]["LossCategory"] | null
          machineId?: string | null
          mdr?: number | null
          nonQualityMin?: number | null
          notes?: string | null
          npvHours?: number
          npvSupportMin?: number | null
          oee?: number | null
          operatorCount?: number | null
          organizationId?: string
          performance?: number | null
          planAchievement?: number | null
          plannedOutput?: number
          productId?: string | null
          pvHours?: number
          quality?: number | null
          runningTimeMin?: number | null
          scheduledProdTimeMin?: number | null
          shiftId?: string | null
          standardTimeId?: string | null
          starvedTimeMin?: number | null
          totalOTMin?: number | null
          uncertaintiesMin?: number | null
          unplannedDownMin?: number | null
          upTimeMin?: number | null
          utMin?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "TrackingLog_machineId_fkey"
            columns: ["machineId"]
            isOneToOne: false
            referencedRelation: "Machine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TrackingLog_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TrackingLog_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "Product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TrackingLog_shiftId_fkey"
            columns: ["shiftId"]
            isOneToOne: false
            referencedRelation: "Shift"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TrackingLog_standardTimeId_fkey"
            columns: ["standardTimeId"]
            isOneToOne: false
            referencedRelation: "StandardTime"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          createdAt: string
          email: string
          id: string
          name: string
          organizationId: string
          role: Database["public"]["Enums"]["Role"]
          supabaseUserId: string
        }
        Insert: {
          createdAt?: string
          email: string
          id: string
          name: string
          organizationId: string
          role?: Database["public"]["Enums"]["Role"]
          supabaseUserId: string
        }
        Update: {
          createdAt?: string
          email?: string
          id?: string
          name?: string
          organizationId?: string
          role?: Database["public"]["Enums"]["Role"]
          supabaseUserId?: string
        }
        Relationships: [
          {
            foreignKeyName: "User_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vsm_lead_events: {
        Row: {
          actor_user_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          lead_id: string
          payload: Json | null
        }
        Insert: {
          actor_user_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          lead_id: string
          payload?: Json | null
        }
        Update: {
          actor_user_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "vsm_lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vsm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      vsm_leads: {
        Row: {
          company: string | null
          consent_at: string | null
          consent_text: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          job_title: string | null
          landing_path: string | null
          last_activity_at: string
          locale: string | null
          message: string | null
          organization_id: string | null
          owner_user_id: string | null
          phone: string | null
          referrer: string | null
          source: string
          stage: string
          updated_at: string
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          company?: string | null
          consent_at?: string | null
          consent_text?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          landing_path?: string | null
          last_activity_at?: string
          locale?: string | null
          message?: string | null
          organization_id?: string | null
          owner_user_id?: string | null
          phone?: string | null
          referrer?: string | null
          source?: string
          stage?: string
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          company?: string | null
          consent_at?: string | null
          consent_text?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          landing_path?: string | null
          last_activity_at?: string
          locale?: string | null
          message?: string | null
          organization_id?: string | null
          owner_user_id?: string | null
          phone?: string | null
          referrer?: string | null
          source?: string
          stage?: string
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vsm_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vsm_staff: {
        Row: {
          created_at: string
          note: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          note?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          note?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      has_org_role: {
        Args: { min_role?: string; org_id: string }
        Returns: boolean
      }
      is_vsm_admin: { Args: never; Returns: boolean }
      is_vsm_staff: { Args: never; Returns: boolean }
      project_org_id: { Args: { p_project_id: string }; Returns: string }
    }
    Enums: {
      ActivityType: "PV" | "NPV"
      AppProduct: "VSM_BUILDER" | "MES"
      AttendanceSource: "PIN" | "RFID" | "BADGE" | "APP" | "MANUAL" | "API"
      EntitlementStatus: "REQUESTED" | "ACTIVE" | "REVOKED"
      EscalationImpact: "MINOR" | "MAJOR" | "CRITICAL"
      EscalationStatus: "OPEN" | "ACKNOWLEDGED" | "RESOLVED"
      EscalationTier: "LINIE" | "WERK"
      LossCategory:
        | "MACHINE"
        | "MATERIAL"
        | "PERSONNEL"
        | "QUALITY"
        | "CHANGEOVER"
        | "PLANNED"
        | "OTHER"
      LossEntryCategory:
        | "AVAILABILITY"
        | "PERFORMANCE"
        | "QUALITY"
        | "OPERATOR_ACTIVITY"
        | "DVC_EXTERN"
        | "NON_QUALITY"
        | "UNCERTAINTIES"
        | "NPV_SUPPORT"
      LossType:
        | "AVAILABILITY_BREAKDOWN"
        | "SETUP_ADJUSTMENT"
        | "MINOR_STOP"
        | "REDUCED_SPEED"
        | "DEFECT"
        | "STARTUP_LOSS"
      MachineStatus: "RUNNING" | "SLOW" | "STOPPED" | "MAINTENANCE" | "UNKNOWN"
      MachineType: "AUTOMATED" | "MANUAL" | "SEMI_AUTO" | "WAREHOUSE"
      PersonnelCostCat:
        | "DIRECT_VALUE_COST"
        | "INDIRECT_VALUE_COST"
        | "MINIMUM_BASE_COST"
      QdipPillar: "SAFETY" | "QUALITY" | "DELIVERY" | "EFFICIENCY" | "COST"
      QueueStatus: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "CANCELLED"
      Role: "ADMIN" | "TEAM_LEADER" | "VIEWER"
      Tier: "FREE" | "BETA" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      ActivityType: ["PV", "NPV"],
      AppProduct: ["VSM_BUILDER", "MES"],
      AttendanceSource: ["PIN", "RFID", "BADGE", "APP", "MANUAL", "API"],
      EntitlementStatus: ["REQUESTED", "ACTIVE", "REVOKED"],
      EscalationImpact: ["MINOR", "MAJOR", "CRITICAL"],
      EscalationStatus: ["OPEN", "ACKNOWLEDGED", "RESOLVED"],
      EscalationTier: ["LINIE", "WERK"],
      LossCategory: [
        "MACHINE",
        "MATERIAL",
        "PERSONNEL",
        "QUALITY",
        "CHANGEOVER",
        "PLANNED",
        "OTHER",
      ],
      LossEntryCategory: [
        "AVAILABILITY",
        "PERFORMANCE",
        "QUALITY",
        "OPERATOR_ACTIVITY",
        "DVC_EXTERN",
        "NON_QUALITY",
        "UNCERTAINTIES",
        "NPV_SUPPORT",
      ],
      LossType: [
        "AVAILABILITY_BREAKDOWN",
        "SETUP_ADJUSTMENT",
        "MINOR_STOP",
        "REDUCED_SPEED",
        "DEFECT",
        "STARTUP_LOSS",
      ],
      MachineStatus: ["RUNNING", "SLOW", "STOPPED", "MAINTENANCE", "UNKNOWN"],
      MachineType: ["AUTOMATED", "MANUAL", "SEMI_AUTO", "WAREHOUSE"],
      PersonnelCostCat: [
        "DIRECT_VALUE_COST",
        "INDIRECT_VALUE_COST",
        "MINIMUM_BASE_COST",
      ],
      QdipPillar: ["SAFETY", "QUALITY", "DELIVERY", "EFFICIENCY", "COST"],
      QueueStatus: ["PENDING", "IN_PROGRESS", "DONE", "BLOCKED", "CANCELLED"],
      Role: ["ADMIN", "TEAM_LEADER", "VIEWER"],
      Tier: ["FREE", "BETA", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
    },
  },
} as const
