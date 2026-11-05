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
  public: {
    Tables: {
      ai_provider_secrets: {
        Row: {
          api_key: string | null
          ciphertext: string | null
          enabled: boolean
          id: string
          iv: string | null
          key_hint: string | null
          label: string | null
          last_status: string | null
          last_tested_at: string | null
          model: string | null
          priority: number
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          ciphertext?: string | null
          enabled?: boolean
          id?: string
          iv?: string | null
          key_hint?: string | null
          label?: string | null
          last_status?: string | null
          last_tested_at?: string | null
          model?: string | null
          priority?: number
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          ciphertext?: string | null
          enabled?: boolean
          id?: string
          iv?: string | null
          key_hint?: string | null
          label?: string | null
          last_status?: string | null
          last_tested_at?: string | null
          model?: string | null
          priority?: number
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cloudy_ai_rate_limits: {
        Row: {
          daily_count: number
          daily_key: string
          minute_count: number
          minute_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_count?: number
          daily_key?: string
          minute_count?: number
          minute_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_count?: number
          daily_key?: string
          minute_count?: number
          minute_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cloudy_ai_request_leases: {
        Row: {
          expires_at: string
          request_id: string
          user_id: string
        }
        Insert: {
          expires_at: string
          request_id: string
          user_id: string
        }
        Update: {
          expires_at?: string
          request_id?: string
          user_id?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string
          created_at: string
          display_name: string
          english_level: string | null
          id: string
          is_public: boolean
          placement_test_completed: boolean
        }
        Insert: {
          bio?: string
          created_at?: string
          display_name?: string
          english_level?: string | null
          id: string
          is_public?: boolean
          placement_test_completed?: boolean
        }
        Update: {
          bio?: string
          created_at?: string
          display_name?: string
          english_level?: string | null
          id?: string
          is_public?: boolean
          placement_test_completed?: boolean
        }
        Relationships: []
      }
      user_learning_profiles: {
        Row: {
          profile: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          profile?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          profile?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          state: Json
          total_xp: number
          updated_at: string
          user_id: string
          week_key: string
          week_xp: number
        }
        Insert: {
          state?: Json
          total_xp?: number
          updated_at?: string
          user_id: string
          week_key?: string
          week_xp?: number
        }
        Update: {
          state?: Json
          total_xp?: number
          updated_at?: string
          user_id?: string
          week_key?: string
          week_xp?: number
        }
        Relationships: []
      }
      user_progress_awards: {
        Row: {
          award_day: string
          created_at: string
          id: number
          lesson_index: number
          level: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          award_day?: string
          created_at?: string
          id?: never
          lesson_index: number
          level: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          award_day?: string
          created_at?: string
          id?: never
          lesson_index?: number
          level?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      user_progress_xp: {
        Row: {
          daily_key: string
          daily_lessons: number
          total_xp: number
          user_id: string
          week_key: string
          week_xp: number
        }
        Insert: {
          daily_key?: string
          daily_lessons?: number
          total_xp?: number
          user_id: string
          week_key?: string
          week_xp?: number
        }
        Update: {
          daily_key?: string
          daily_lessons?: number
          total_xp?: number
          user_id?: string
          week_key?: string
          week_xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      community_public_profiles: {
        Row: {
          bio: string
          created_at: string
          display_name: string
          id: string
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_cloudy_ai_request: {
        Args: { _request_id: string; _user_id: string }
        Returns: Json
      }
      award_cloudy_lesson_xp: {
        Args: { _lesson_index: number; _level: string; _user_id: string }
        Returns: Json
      }
      get_weekly_league: {
        Args: { _week: string }
        Returns: {
          display_name: string
          is_me: boolean
          week_xp: number
        }[]
      }
      release_cloudy_ai_request: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      save_cloudy_progress:
        | { Args: { _state: Json; _user_id: string }; Returns: Json }
        | {
            Args: {
              _expected_updated_at?: string
              _state: Json
              _user_id: string
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
    Enums: {},
  },
} as const
