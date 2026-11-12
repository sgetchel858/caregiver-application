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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          avatar_color: string
          created_at: string
          first_name: string
          id: string
          initials: string
          last_name: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          first_name: string
          id?: string
          initials: string
          last_name: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          first_name?: string
          id?: string
          initials?: string
          last_name?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          escort_member_id: string | null
          family_id: string
          family_member_id: string
          health_visit_id: string | null
          id: string
          kind: string
          note: string | null
          place: string | null
          place_phone: string | null
          starts_at: string | null
          starts_on: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          escort_member_id?: string | null
          family_id: string
          family_member_id: string
          health_visit_id?: string | null
          id?: string
          kind: string
          note?: string | null
          place?: string | null
          place_phone?: string | null
          starts_at?: string | null
          starts_on: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          escort_member_id?: string | null
          family_id?: string
          family_member_id?: string
          health_visit_id?: string | null
          id?: string
          kind?: string
          note?: string | null
          place?: string | null
          place_phone?: string | null
          starts_at?: string | null
          starts_on?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_escort_member_id_family_id_fkey"
            columns: ["escort_member_id", "family_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "appointments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_family_member_id_family_id_fkey"
            columns: ["family_member_id", "family_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      care_circles: {
        Row: {
          about_member_id: string
          notify_member_id: string
        }
        Insert: {
          about_member_id: string
          notify_member_id: string
        }
        Update: {
          about_member_id?: string
          notify_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_circles_about_member_id_fkey"
            columns: ["about_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_circles_notify_member_id_fkey"
            columns: ["notify_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      family_access: {
        Row: {
          app_user_id: string
          family_id: string
          role: string
        }
        Insert: {
          app_user_id: string
          family_id: string
          role: string
        }
        Update: {
          app_user_id?: string
          family_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_access_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_access_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          app_user_id: string | null
          avatar_color: string
          birth_year: number | null
          family_id: string
          first_name: string
          health_member_id: string | null
          id: string
          initials: string
          last_name: string
          relation: string
          sort_order: number
          user_is: string
        }
        Insert: {
          app_user_id?: string | null
          avatar_color?: string
          birth_year?: number | null
          family_id: string
          first_name: string
          health_member_id?: string | null
          id?: string
          initials: string
          last_name?: string
          relation: string
          sort_order?: number
          user_is: string
        }
        Update: {
          app_user_id?: string | null
          avatar_color?: string
          birth_year?: number | null
          family_id?: string
          first_name?: string
          health_member_id?: string | null
          id?: string
          initials?: string
          last_name?: string
          relation?: string
          sort_order?: number
          user_is?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_updates: {
        Row: {
          about_member_id: string
          created_at: string
          family_id: string
          from_user_id: string
          id: string
          ref_id: string
          ref_kind: string
          summary: string
          to_member_ids: string[]
        }
        Insert: {
          about_member_id: string
          created_at?: string
          family_id: string
          from_user_id?: string
          id?: string
          ref_id: string
          ref_kind: string
          summary: string
          to_member_ids: string[]
        }
        Update: {
          about_member_id?: string
          created_at?: string
          family_id?: string
          from_user_id?: string
          id?: string
          ref_id?: string
          ref_kind?: string
          summary?: string
          to_member_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "family_updates_about_member_id_family_id_fkey"
            columns: ["about_member_id", "family_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "family_updates_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_updates_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_drafts: {
        Row: {
          about_id: string | null
          about_kind: string | null
          body: string | null
          channel: string
          created_at: string
          created_by: string
          draft_key: string
          family_member_id: string
          id: string
          sent_message_id: string | null
          to_clinician_id: string
          to_name: string
          to_role: string
          updated_at: string
        }
        Insert: {
          about_id?: string | null
          about_kind?: string | null
          body?: string | null
          channel?: string
          created_at?: string
          created_by?: string
          draft_key: string
          family_member_id: string
          id?: string
          sent_message_id?: string | null
          to_clinician_id: string
          to_name: string
          to_role: string
          updated_at?: string
        }
        Update: {
          about_id?: string | null
          about_kind?: string | null
          body?: string | null
          channel?: string
          created_at?: string
          created_by?: string
          draft_key?: string
          family_member_id?: string
          id?: string
          sent_message_id?: string | null
          to_clinician_id?: string
          to_name?: string
          to_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_drafts_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_sheets: {
        Row: {
          family_member_id: string
          id: string
          pins: Json
          saved_at: string
          saved_by: string
          sheet: Json | null
          visit_id: string
        }
        Insert: {
          family_member_id: string
          id?: string
          pins?: Json
          saved_at?: string
          saved_by?: string
          sheet?: Json | null
          visit_id: string
        }
        Update: {
          family_member_id?: string
          id?: string
          pins?: Json
          saved_at?: string
          saved_by?: string
          sheet?: Json | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_sheets_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_sheets_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      question_lists: {
        Row: {
          family_member_id: string
          items: Json
          updated_at: string
          visit_id: string
        }
        Insert: {
          family_member_id: string
          items?: Json
          updated_at?: string
          visit_id: string
        }
        Update: {
          family_member_id?: string
          items?: Json
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_lists_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      to_book_items: {
        Row: {
          booked_appointment_id: string | null
          created_at: string
          due_by: string
          family_id: string
          family_member_id: string
          id: string
          title: string
        }
        Insert: {
          booked_appointment_id?: string | null
          created_at?: string
          due_by: string
          family_id: string
          family_member_id: string
          id?: string
          title: string
        }
        Update: {
          booked_appointment_id?: string | null
          created_at?: string
          due_by?: string
          family_id?: string
          family_member_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "to_book_items_booked_appointment_id_fkey"
            columns: ["booked_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "to_book_items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "to_book_items_family_member_id_family_id_fkey"
            columns: ["family_member_id", "family_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      user_settings: {
        Row: {
          app_user_id: string
          large_text: boolean
          share_updates_by_default: boolean
        }
        Insert: {
          app_user_id?: string
          large_text?: boolean
          share_updates_by_default?: boolean
        }
        Update: {
          app_user_id?: string
          large_text?: boolean
          share_updates_by_default?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_demo_family: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
