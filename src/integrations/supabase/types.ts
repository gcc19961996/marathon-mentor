export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_usage: {
        Row: {
          count: number;
          created_at: string;
          day: string;
          updated_at: string;
        };
        Insert: {
          count?: number;
          created_at?: string;
          day: string;
          updated_at?: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          day?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      checklist_items: {
        Row: {
          checked: boolean;
          created_at: string;
          id: string;
          item_date: string | null;
          key: string;
          label: string;
          note: string | null;
          sort_order: number;
          user_id: string;
        };
        Insert: {
          checked?: boolean;
          created_at?: string;
          id?: string;
          item_date?: string | null;
          key: string;
          label: string;
          note?: string | null;
          sort_order?: number;
          user_id: string;
        };
        Update: {
          checked?: boolean;
          created_at?: string;
          id?: string;
          item_date?: string | null;
          key?: string;
          label?: string;
          note?: string | null;
          sort_order?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      cross_training: {
        Row: {
          activity: string;
          created_at: string;
          date: string;
          id: string;
          minutes: number;
          user_id: string;
        };
        Insert: {
          activity: string;
          created_at?: string;
          date: string;
          id?: string;
          minutes?: number;
          user_id: string;
        };
        Update: {
          activity?: string;
          created_at?: string;
          date?: string;
          id?: string;
          minutes?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      daily_checkins: {
        Row: {
          computed_max_mi: number | null;
          computed_min_mi: number | null;
          created_at: string;
          date: string;
          id: string;
          leg_feel: number | null;
          pain_note: string | null;
          rest_recommended: boolean;
          sleep_quality: number | null;
          source: string;
          updated_at: string;
          user_id: string;
          whoop_recovery_pct: number | null;
        };
        Insert: {
          computed_max_mi?: number | null;
          computed_min_mi?: number | null;
          created_at?: string;
          date: string;
          id?: string;
          leg_feel?: number | null;
          pain_note?: string | null;
          rest_recommended?: boolean;
          sleep_quality?: number | null;
          source?: string;
          updated_at?: string;
          user_id?: string;
          whoop_recovery_pct?: number | null;
        };
        Update: {
          computed_max_mi?: number | null;
          computed_min_mi?: number | null;
          created_at?: string;
          date?: string;
          id?: string;
          leg_feel?: number | null;
          pain_note?: string | null;
          rest_recommended?: boolean;
          sleep_quality?: number | null;
          source?: string;
          updated_at?: string;
          user_id?: string;
          whoop_recovery_pct?: number | null;
        };
        Relationships: [];
      };
      milestones: {
        Row: {
          completed_date: string | null;
          created_at: string;
          criteria: string | null;
          id: string;
          is_custom: boolean;
          name: string;
          sort_order: number;
          target_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_date?: string | null;
          created_at?: string;
          criteria?: string | null;
          id?: string;
          is_custom?: boolean;
          name: string;
          sort_order?: number;
          target_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          completed_date?: string | null;
          created_at?: string;
          criteria?: string | null;
          id?: string;
          is_custom?: boolean;
          name?: string;
          sort_order?: number;
          target_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      plan_changes: {
        Row: {
          changed_at: string;
          id: string;
          user_id: string;
          what: string;
          why: string | null;
        };
        Insert: {
          changed_at?: string;
          id?: string;
          user_id: string;
          what: string;
          why?: string | null;
        };
        Update: {
          changed_at?: string;
          id?: string;
          user_id?: string;
          what?: string;
          why?: string | null;
        };
        Relationships: [];
      };
      plan_days: {
        Row: {
          actual_run_id: string | null;
          created_at: string;
          date: string;
          details: string | null;
          id: string;
          max_miles: number | null;
          min_miles: number | null;
          pace_target: string | null;
          phase: string;
          purpose: string | null;
          status: string;
          target_miles: number;
          updated_at: string;
          user_id: string;
          week_number: number;
          workout_type: string;
        };
        Insert: {
          actual_run_id?: string | null;
          created_at?: string;
          date: string;
          details?: string | null;
          id?: string;
          max_miles?: number | null;
          min_miles?: number | null;
          pace_target?: string | null;
          phase: string;
          purpose?: string | null;
          status?: string;
          target_miles?: number;
          updated_at?: string;
          user_id?: string;
          week_number: number;
          workout_type: string;
        };
        Update: {
          actual_run_id?: string | null;
          created_at?: string;
          date?: string;
          details?: string | null;
          id?: string;
          max_miles?: number | null;
          min_miles?: number | null;
          pace_target?: string | null;
          phase?: string;
          purpose?: string | null;
          status?: string;
          target_miles?: number;
          updated_at?: string;
          user_id?: string;
          week_number?: number;
          workout_type?: string;
        };
        Relationships: [];
      };
      plan_weeks: {
        Row: {
          created_at: string;
          id: string;
          phase: string;
          start_date: string;
          suggested_ceiling: number;
          target_miles: number;
          updated_at: string;
          user_id: string;
          week_number: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          phase: string;
          start_date: string;
          suggested_ceiling?: number;
          target_miles?: number;
          updated_at?: string;
          user_id?: string;
          week_number: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          phase?: string;
          start_date?: string;
          suggested_ceiling?: number;
          target_miles?: number;
          updated_at?: string;
          user_id?: string;
          week_number?: number;
        };
        Relationships: [];
      };
      profile: {
        Row: {
          created_at: string;
          days_per_week: number | null;
          id: string;
          long_run_day: string | null;
          longest_run_date: string | null;
          longest_run_mi: number | null;
          race_date: string;
          race_name: string;
          recent_race_date: string | null;
          recent_race_distance_mi: number | null;
          recent_race_seconds: number | null;
          setup_complete: boolean;
          typical_weekly_mileage: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          days_per_week?: number | null;
          id?: string;
          long_run_day?: string | null;
          longest_run_date?: string | null;
          longest_run_mi?: number | null;
          race_date?: string;
          race_name?: string;
          recent_race_date?: string | null;
          recent_race_distance_mi?: number | null;
          recent_race_seconds?: number | null;
          setup_complete?: boolean;
          typical_weekly_mileage?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          days_per_week?: number | null;
          id?: string;
          long_run_day?: string | null;
          longest_run_date?: string | null;
          longest_run_mi?: number | null;
          race_date?: string;
          race_name?: string;
          recent_race_date?: string | null;
          recent_race_distance_mi?: number | null;
          recent_race_seconds?: number | null;
          setup_complete?: boolean;
          typical_weekly_mileage?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          answer: string | null;
          asked_at: string;
          id: string;
          question: string;
          suggested_workout: Json | null;
          user_id: string;
        };
        Insert: {
          answer?: string | null;
          asked_at?: string;
          id?: string;
          question: string;
          suggested_workout?: Json | null;
          user_id?: string;
        };
        Update: {
          answer?: string | null;
          asked_at?: string;
          id?: string;
          question?: string;
          suggested_workout?: Json | null;
          user_id?: string;
        };
        Relationships: [];
      };
      run_best_efforts: {
        Row: {
          created_at: string;
          distance_m: number;
          id: string;
          name: string;
          seconds: number;
          strava_activity_id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          distance_m: number;
          id?: string;
          name: string;
          seconds: number;
          strava_activity_id: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          distance_m?: number;
          id?: string;
          name?: string;
          seconds?: number;
          strava_activity_id?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      run_splits: {
        Row: {
          created_at: string;
          distance_mi: number | null;
          elapsed_seconds: number | null;
          flag: string | null;
          flag_reason: string | null;
          heart_rate: number | null;
          id: string;
          mile_number: number;
          moving_seconds: number | null;
          pace_seconds: number;
          strava_activity_id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          distance_mi?: number | null;
          elapsed_seconds?: number | null;
          flag?: string | null;
          flag_reason?: string | null;
          heart_rate?: number | null;
          id?: string;
          mile_number: number;
          moving_seconds?: number | null;
          pace_seconds: number;
          strava_activity_id: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          distance_mi?: number | null;
          elapsed_seconds?: number | null;
          flag?: string | null;
          flag_reason?: string | null;
          heart_rate?: number | null;
          id?: string;
          mile_number?: number;
          moving_seconds?: number | null;
          pace_seconds?: number;
          strava_activity_id?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      runs: {
        Row: {
          avg_heart_rate: number | null;
          avg_pace_seconds: number | null;
          clock_left_running: boolean;
          created_at: string;
          date: string;
          distance_mi: number;
          duration_seconds: number;
          elapsed_seconds: number | null;
          elevation_gain_ft: number | null;
          fast_segment_pace_seconds: number | null;
          fluids_oz: number | null;
          gels: number | null;
          hidden: boolean;
          id: string;
          max_speed_mph: number | null;
          notes: string | null;
          source: string;
          stomach: number | null;
          stopped_seconds: number | null;
          strava_activity_id: number | null;
          streams_checked_at: string | null;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avg_heart_rate?: number | null;
          avg_pace_seconds?: number | null;
          clock_left_running?: boolean;
          created_at?: string;
          date: string;
          distance_mi?: number;
          duration_seconds?: number;
          elapsed_seconds?: number | null;
          elevation_gain_ft?: number | null;
          fast_segment_pace_seconds?: number | null;
          fluids_oz?: number | null;
          gels?: number | null;
          hidden?: boolean;
          id?: string;
          max_speed_mph?: number | null;
          notes?: string | null;
          source?: string;
          stomach?: number | null;
          stopped_seconds?: number | null;
          strava_activity_id?: number | null;
          streams_checked_at?: string | null;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          avg_heart_rate?: number | null;
          avg_pace_seconds?: number | null;
          clock_left_running?: boolean;
          created_at?: string;
          date?: string;
          distance_mi?: number;
          duration_seconds?: number;
          elapsed_seconds?: number | null;
          elevation_gain_ft?: number | null;
          fast_segment_pace_seconds?: number | null;
          fluids_oz?: number | null;
          gels?: number | null;
          hidden?: boolean;
          id?: string;
          max_speed_mph?: number | null;
          notes?: string | null;
          source?: string;
          stomach?: number | null;
          stopped_seconds?: number | null;
          strava_activity_id?: number | null;
          streams_checked_at?: string | null;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      strava_connection: {
        Row: {
          access_token: string | null;
          athlete_id: number | null;
          athlete_name: string | null;
          client_id: string | null;
          client_secret: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          last_error: string | null;
          last_synced_at: string | null;
          refresh_token: string | null;
          scope: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token?: string | null;
          athlete_id?: number | null;
          athlete_name?: string | null;
          client_id?: string | null;
          client_secret?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          refresh_token?: string | null;
          scope?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token?: string | null;
          athlete_id?: number | null;
          athlete_name?: string | null;
          client_id?: string | null;
          client_secret?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          refresh_token?: string | null;
          scope?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      target_times: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          set_at: string;
          target_pace_seconds: number;
          target_seconds: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          set_at?: string;
          target_pace_seconds: number;
          target_seconds: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          set_at?: string;
          target_pace_seconds?: number;
          target_seconds?: number;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      bump_ai_usage: { Args: { max_per_day: number }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
