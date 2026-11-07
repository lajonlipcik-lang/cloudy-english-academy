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
      cloudy_learning_events: {
        Row: {
          correct_answer: string | null
          created_at: string
          event_id: string
          event_type: string
          exercise_type: string | null
          id: number
          is_correct: boolean | null
          lesson_index: number | null
          level: string | null
          occurred_at: string
          question_index: number | null
          response_seconds: number | null
          retry: boolean
          selected_answer: string | null
          session_id: string | null
          session_type: string | null
          skill_id: string | null
          user_id: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          event_id: string
          event_type: string
          exercise_type?: string | null
          id?: never
          is_correct?: boolean | null
          lesson_index?: number | null
          level?: string | null
          occurred_at: string
          question_index?: number | null
          response_seconds?: number | null
          retry?: boolean
          selected_answer?: string | null
          session_id?: string | null
          session_type?: string | null
          skill_id?: string | null
          user_id: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          event_id?: string
          event_type?: string
          exercise_type?: string | null
          id?: never
          is_correct?: boolean | null
          lesson_index?: number | null
          level?: string | null
          occurred_at?: string
          question_index?: number | null
          response_seconds?: number | null
          retry?: boolean
          selected_answer?: string | null
          session_id?: string | null
          session_type?: string | null
          skill_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      community_comment_rate_limits: {
        Row: {
          comment_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          comment_count?: number
          user_id: string
          window_started_at: string
        }
        Update: {
          comment_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
          status: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_rate_limits: {
        Row: {
          post_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          post_count?: number
          user_id: string
          window_started_at: string
        }
        Update: {
          post_count?: number
          user_id?: string
          window_started_at?: string
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
      community_reactions: {
        Row: {
          created_at: string
          post_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          reaction?: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reports: {
        Row: {
          comment_id: string | null
          created_at: string
          details: string
          id: string
          moderation_note: string
          post_id: string | null
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          details?: string
          id?: string
          moderation_note?: string
          post_id?: string | null
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          details?: string
          id?: string
          moderation_note?: string
          post_id?: string | null
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_moderation_events: {
        Row: {
          action: string
          actor_type: string
          confidence: number | null
          content_id: string | null
          content_type: string
          created_at: string
          id: string
          labels: Json
          model: string
          policy_version: string
          reason: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor_type: string
          confidence?: number | null
          content_id?: string | null
          content_type: string
          created_at?: string
          id?: string
          labels?: Json
          model?: string
          policy_version?: string
          reason?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          confidence?: number | null
          content_id?: string | null
          content_type?: string
          created_at?: string
          id?: string
          labels?: Json
          model?: string
          policy_version?: string
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      content_user_restrictions: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          reason: string
          restriction_type: string
          source: string
          starts_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          reason: string
          restriction_type: string
          source: string
          starts_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          reason?: string
          restriction_type?: string
          source?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: []
      }
      optional_consent_events: {
        Row: {
          action: string
          created_at: string
          document_version: string
          id: string
          purpose: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          document_version: string
          id?: string
          purpose: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          document_version?: string
          id?: string
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      privacy_requests: {
        Row: {
          created_at: string
          details: string
          id: string
          request_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          request_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
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
      shorts_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          moderated_at: string | null
          moderation_labels: Json
          moderation_reason: string
          moderation_status: string
          status: string
          updated_at: string
          video_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderation_labels?: Json
          moderation_reason?: string
          moderation_status?: string
          status?: string
          updated_at?: string
          video_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderation_labels?: Json
          moderation_reason?: string
          moderation_status?: string
          status?: string
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shorts_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "shorts_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      shorts_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      shorts_likes: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shorts_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "shorts_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      shorts_videos: {
        Row: {
          audio_analysis_confidence: number | null
          audio_analysis_decision: string
          audio_analysis_labels: Json
          audio_analysis_model: string
          audio_analysis_reason: string
          audio_analysis_status: string
          audio_analyzed_at: string | null
          audio_chunk_count: number
          author_id: string
          caption: string
          created_at: string
          duration_seconds: number | null
          frame_analysis_confidence: number | null
          frame_analysis_labels: Json
          frame_analysis_model: string
          frame_analysis_reason: string
          frame_analysis_status: string
          frame_analyzed_at: string | null
          frame_count: number
          id: string
          media_type: string
          moderated_at: string | null
          moderation_labels: Json
          moderation_reason: string
          moderation_status: string
          published_at: string | null
          status: string
          storage_path: string | null
          text_content: string
          updated_at: string
        }
        Insert: {
          audio_analysis_confidence?: number | null
          audio_analysis_decision?: string
          audio_analysis_labels?: Json
          audio_analysis_model?: string
          audio_analysis_reason?: string
          audio_analysis_status?: string
          audio_analyzed_at?: string | null
          audio_chunk_count?: number
          author_id: string
          caption?: string
          created_at?: string
          duration_seconds?: number | null
          frame_analysis_confidence?: number | null
          frame_analysis_labels?: Json
          frame_analysis_model?: string
          frame_analysis_reason?: string
          frame_analysis_status?: string
          frame_analyzed_at?: string | null
          frame_count?: number
          id?: string
          media_type?: string
          moderated_at?: string | null
          moderation_labels?: Json
          moderation_reason?: string
          moderation_status?: string
          published_at?: string | null
          status?: string
          storage_path?: string | null
          text_content?: string
          updated_at?: string
        }
        Update: {
          audio_analysis_confidence?: number | null
          audio_analysis_decision?: string
          audio_analysis_labels?: Json
          audio_analysis_model?: string
          audio_analysis_reason?: string
          audio_analysis_status?: string
          audio_analyzed_at?: string | null
          audio_chunk_count?: number
          author_id?: string
          caption?: string
          created_at?: string
          duration_seconds?: number | null
          frame_analysis_confidence?: number | null
          frame_analysis_labels?: Json
          frame_analysis_model?: string
          frame_analysis_reason?: string
          frame_analysis_status?: string
          frame_analyzed_at?: string | null
          frame_count?: number
          id?: string
          media_type?: string
          moderated_at?: string | null
          moderation_labels?: Json
          moderation_reason?: string
          moderation_status?: string
          published_at?: string | null
          status?: string
          storage_path?: string | null
          text_content?: string
          updated_at?: string
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
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_cloudy_ai_request: {
        Args: { _request_id: string; _user_id: string }
        Returns: Json
      }
      apply_shorts_audio_analysis: {
        Args: {
          p_chunk_count: number
          p_confidence: number
          p_decision: string
          p_labels: Json
          p_model: string
          p_reason: string
          p_status: string
          p_video_id: string
        }
        Returns: boolean
      }
      apply_shorts_frame_analysis: {
        Args: {
          p_confidence: number
          p_frame_count: number
          p_labels: Json
          p_model: string
          p_reason: string
          p_status: string
          p_video_id: string
        }
        Returns: boolean
      }
      apply_shorts_text_moderation: {
        Args: {
          p_confidence: number
          p_content_id: string
          p_content_type: string
          p_decision: string
          p_labels: Json
          p_model?: string
          p_policy_version?: string
          p_reason: string
        }
        Returns: boolean
      }
      award_cloudy_lesson_xp: {
        Args: { _lesson_index: number; _level: string; _user_id: string }
        Returns: Json
      }
      finalize_shorts_nonvideo_publication: {
        Args: {
          p_author_id: string
          p_blocked: boolean
          p_confidence: number
          p_labels: Json
          p_model: string
          p_post_id: string
          p_reason: string
          p_status: string
        }
        Returns: boolean
      }
      finalize_shorts_publication: {
        Args: {
          p_author_id: string
          p_blocked: boolean
          p_confidence: number
          p_frame_count: number
          p_labels: Json
          p_model: string
          p_reason: string
          p_status: string
          p_video_id: string
        }
        Returns: boolean
      }
      get_weekly_league: {
        Args: { _week: string }
        Returns: {
          display_name: string
          is_me: boolean
          week_xp: number
        }[]
      }
      moderate_community_report: {
        Args: {
          p_content_action?: string
          p_moderation_note?: string
          p_moderator_id?: string
          p_report_id: string
          p_status: string
        }
        Returns: undefined
      }
      moderate_shorts_video: {
        Args: {
          p_decision: string
          p_moderator_id: string
          p_reason: string
          p_video_id: string
        }
        Returns: boolean
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
