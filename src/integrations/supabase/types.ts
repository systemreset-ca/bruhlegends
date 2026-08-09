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
      audit_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          group_id: string | null
          id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          group_id?: string | null
          id?: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          group_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      bruh_price_quotes: {
        Row: {
          asset_symbol: string
          expires_at: string
          id: string
          price_sol: number | null
          price_usd: number
          provider: string
          quoted_at: string
          raw: Json | null
        }
        Insert: {
          asset_symbol: string
          expires_at: string
          id?: string
          price_sol?: number | null
          price_usd: number
          provider: string
          quoted_at?: string
          raw?: Json | null
        }
        Update: {
          asset_symbol?: string
          expires_at?: string
          id?: string
          price_sol?: number | null
          price_usd?: number
          provider?: string
          quoted_at?: string
          raw?: Json | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          ath_at: string | null
          ath_multiple: number | null
          ath_price_usd: number | null
          baseline_liquidity_usd: number | null
          baseline_market_cap_usd: number | null
          baseline_price_usd: number | null
          baseline_provider: string | null
          baseline_raw: Json | null
          caller_membership_id: string
          created_at: string
          group_id: string
          id: string
          invalidated_reason: string | null
          last_observed_at: string | null
          last_price_usd: number | null
          mint: string
          name: string | null
          note: string | null
          pool_address: string | null
          season_id: string | null
          source: string
          source_message_id: number | null
          source_seen_at: string
          status: Database["public"]["Enums"]["call_status"]
          symbol: string | null
          updated_at: string
        }
        Insert: {
          ath_at?: string | null
          ath_multiple?: number | null
          ath_price_usd?: number | null
          baseline_liquidity_usd?: number | null
          baseline_market_cap_usd?: number | null
          baseline_price_usd?: number | null
          baseline_provider?: string | null
          baseline_raw?: Json | null
          caller_membership_id: string
          created_at?: string
          group_id: string
          id?: string
          invalidated_reason?: string | null
          last_observed_at?: string | null
          last_price_usd?: number | null
          mint: string
          name?: string | null
          note?: string | null
          pool_address?: string | null
          season_id?: string | null
          source?: string
          source_message_id?: number | null
          source_seen_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          symbol?: string | null
          updated_at?: string
        }
        Update: {
          ath_at?: string | null
          ath_multiple?: number | null
          ath_price_usd?: number | null
          baseline_liquidity_usd?: number | null
          baseline_market_cap_usd?: number | null
          baseline_price_usd?: number | null
          baseline_provider?: string | null
          baseline_raw?: Json | null
          caller_membership_id?: string
          created_at?: string
          group_id?: string
          id?: string
          invalidated_reason?: string | null
          last_observed_at?: string | null
          last_price_usd?: number | null
          mint?: string
          name?: string | null
          note?: string | null
          pool_address?: string | null
          season_id?: string | null
          source?: string
          source_message_id?: number | null
          source_seen_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          symbol?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_caller_membership_id_fkey"
            columns: ["caller_membership_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          call_id: string | null
          created_at: string
          group_id: string
          id: string
          raised_by_membership_id: string | null
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by_membership_id: string | null
          status: string
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          raised_by_membership_id?: string | null
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          status?: string
        }
        Update: {
          call_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          raised_by_membership_id?: string | null
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_membership_id_fkey"
            columns: ["raised_by_membership_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_membership_id_fkey"
            columns: ["resolved_by_membership_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          default_tip_privacy: Database["public"]["Enums"]["tip_privacy"]
          detection_opt_out: boolean
          display_name: string | null
          group_id: string
          id: string
          is_banned: boolean
          joined_at: string
          pseudonym: string | null
          role: Database["public"]["Enums"]["member_role"]
          telegram_user_id: number
          updated_at: string
        }
        Insert: {
          default_tip_privacy?: Database["public"]["Enums"]["tip_privacy"]
          detection_opt_out?: boolean
          display_name?: string | null
          group_id: string
          id?: string
          is_banned?: boolean
          joined_at?: string
          pseudonym?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          telegram_user_id: number
          updated_at?: string
        }
        Update: {
          default_tip_privacy?: Database["public"]["Enums"]["tip_privacy"]
          detection_opt_out?: boolean
          display_name?: string | null
          group_id?: string
          id?: string
          is_banned?: boolean
          joined_at?: string
          pseudonym?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          telegram_user_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_telegram_user_id_fkey"
            columns: ["telegram_user_id"]
            isOneToOne: false
            referencedRelation: "telegram_users"
            referencedColumns: ["telegram_user_id"]
          },
        ]
      }
      groups: {
        Row: {
          allow_repeat_calls: boolean
          announce_tips: boolean
          announcement_mode: string
          chat_type: string
          created_at: string
          detection_mode: Database["public"]["Enums"]["detection_mode"]
          id: string
          installed_at: string
          is_paused: boolean
          min_liquidity_usd: number
          min_token_age_minutes: number
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          raw_message_retention_days: number
          removed_at: string | null
          telegram_chat_id: number
          title: string
          updated_at: string
        }
        Insert: {
          allow_repeat_calls?: boolean
          announce_tips?: boolean
          announcement_mode?: string
          chat_type?: string
          created_at?: string
          detection_mode?: Database["public"]["Enums"]["detection_mode"]
          id?: string
          installed_at?: string
          is_paused?: boolean
          min_liquidity_usd?: number
          min_token_age_minutes?: number
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          raw_message_retention_days?: number
          removed_at?: string | null
          telegram_chat_id: number
          title?: string
          updated_at?: string
        }
        Update: {
          allow_repeat_calls?: boolean
          announce_tips?: boolean
          announcement_mode?: string
          chat_type?: string
          created_at?: string
          detection_mode?: Database["public"]["Enums"]["detection_mode"]
          id?: string
          installed_at?: string
          is_paused?: boolean
          min_liquidity_usd?: number
          min_token_age_minutes?: number
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          raw_message_retention_days?: number
          removed_at?: string | null
          telegram_chat_id?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_observations: {
        Row: {
          call_id: string
          id: string
          liquidity_usd: number | null
          market_cap_usd: number | null
          observed_at: string
          price_usd: number | null
          provider: string | null
          quarantine_reason: string | null
          quarantined: boolean
          raw: Json | null
        }
        Insert: {
          call_id: string
          id?: string
          liquidity_usd?: number | null
          market_cap_usd?: number | null
          observed_at?: string
          price_usd?: number | null
          provider?: string | null
          quarantine_reason?: string | null
          quarantined?: boolean
          raw?: Json | null
        }
        Update: {
          call_id?: string
          id?: string
          liquidity_usd?: number | null
          market_cap_usd?: number | null
          observed_at?: string
          price_usd?: number | null
          provider?: string | null
          quarantine_reason?: string | null
          quarantined?: boolean
          raw?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "market_observations_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          announced_at: string | null
          call_id: string
          id: string
          milestone: number
          price_usd: number | null
          reached_at: string
        }
        Insert: {
          announced_at?: string | null
          call_id: string
          id?: string
          milestone: number
          price_usd?: number | null
          reached_at?: string
        }
        Update: {
          announced_at?: string | null
          call_id?: string
          id?: string
          milestone?: number
          price_usd?: number | null
          reached_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          ends_at: string | null
          group_id: string
          id: string
          is_active: boolean
          name: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          name: string
          starts_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      supported_assets: {
        Row: {
          created_at: string
          decimals: number
          enabled: boolean
          id: string
          is_input_asset: boolean
          is_native: boolean
          is_tip_asset: boolean
          mint: string | null
          network: string
          symbol: string
        }
        Insert: {
          created_at?: string
          decimals: number
          enabled?: boolean
          id?: string
          is_input_asset?: boolean
          is_native?: boolean
          is_tip_asset?: boolean
          mint?: string | null
          network?: string
          symbol: string
        }
        Update: {
          created_at?: string
          decimals?: number
          enabled?: boolean
          id?: string
          is_input_asset?: boolean
          is_native?: boolean
          is_tip_asset?: boolean
          mint?: string | null
          network?: string
          symbol?: string
        }
        Relationships: []
      }
      swap_intents: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          input_amount_base_units: number
          input_symbol: string
          membership_id: string
          min_output_base_units: number
          output_symbol: string
          route: Json | null
          slippage_bps: number
          status: Database["public"]["Enums"]["intent_status"]
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          input_amount_base_units: number
          input_symbol: string
          membership_id: string
          min_output_base_units: number
          output_symbol: string
          route?: Json | null
          slippage_bps?: number
          status?: Database["public"]["Enums"]["intent_status"]
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          input_amount_base_units?: number
          input_symbol?: string
          membership_id?: string
          min_output_base_units?: number
          output_symbol?: string
          route?: Json | null
          slippage_bps?: number
          status?: Database["public"]["Enums"]["intent_status"]
        }
        Relationships: [
          {
            foreignKeyName: "swap_intents_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_users: {
        Row: {
          first_name: string | null
          first_seen_at: string
          language_code: string | null
          last_name: string | null
          last_seen_at: string
          telegram_user_id: number
          username: string | null
        }
        Insert: {
          first_name?: string | null
          first_seen_at?: string
          language_code?: string | null
          last_name?: string | null
          last_seen_at?: string
          telegram_user_id: number
          username?: string | null
        }
        Update: {
          first_name?: string | null
          first_seen_at?: string
          language_code?: string | null
          last_name?: string | null
          last_seen_at?: string
          telegram_user_id?: number
          username?: string | null
        }
        Relationships: []
      }
      tip_intents: {
        Row: {
          amount_base_units: number
          amount_display: number
          asset_mint: string | null
          asset_symbol: string
          call_id: string | null
          created_at: string
          expires_at: string
          group_id: string
          id: string
          privacy: Database["public"]["Enums"]["tip_privacy"]
          quote_id: string | null
          recipient_address: string
          recipient_membership_id: string
          reference_key: string
          sender_membership_id: string
          status: Database["public"]["Enums"]["intent_status"]
          updated_at: string
          usd_reference: number | null
        }
        Insert: {
          amount_base_units: number
          amount_display: number
          asset_mint?: string | null
          asset_symbol: string
          call_id?: string | null
          created_at?: string
          expires_at: string
          group_id: string
          id?: string
          privacy?: Database["public"]["Enums"]["tip_privacy"]
          quote_id?: string | null
          recipient_address: string
          recipient_membership_id: string
          reference_key: string
          sender_membership_id: string
          status?: Database["public"]["Enums"]["intent_status"]
          updated_at?: string
          usd_reference?: number | null
        }
        Update: {
          amount_base_units?: number
          amount_display?: number
          asset_mint?: string | null
          asset_symbol?: string
          call_id?: string | null
          created_at?: string
          expires_at?: string
          group_id?: string
          id?: string
          privacy?: Database["public"]["Enums"]["tip_privacy"]
          quote_id?: string | null
          recipient_address?: string
          recipient_membership_id?: string
          reference_key?: string
          sender_membership_id?: string
          status?: Database["public"]["Enums"]["intent_status"]
          updated_at?: string
          usd_reference?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tip_intents_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_intents_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_intents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "bruh_price_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_intents_recipient_membership_id_fkey"
            columns: ["recipient_membership_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_intents_sender_membership_id_fkey"
            columns: ["sender_membership_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_swaps: {
        Row: {
          confirmed_at: string
          id: string
          output_amount_base_units: number | null
          raw: Json | null
          signature: string
          swap_intent_id: string
        }
        Insert: {
          confirmed_at?: string
          id?: string
          output_amount_base_units?: number | null
          raw?: Json | null
          signature: string
          swap_intent_id: string
        }
        Update: {
          confirmed_at?: string
          id?: string
          output_amount_base_units?: number | null
          raw?: Json | null
          signature?: string
          swap_intent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verified_swaps_swap_intent_id_fkey"
            columns: ["swap_intent_id"]
            isOneToOne: true
            referencedRelation: "swap_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_transfers: {
        Row: {
          amount_base_units: number
          asset_mint: string | null
          confirmed_at: string
          id: string
          raw: Json | null
          recipient_address: string
          signature: string
          slot: number | null
          tip_intent_id: string
          usd_reference_at_execution: number | null
        }
        Insert: {
          amount_base_units: number
          asset_mint?: string | null
          confirmed_at?: string
          id?: string
          raw?: Json | null
          recipient_address: string
          signature: string
          slot?: number | null
          tip_intent_id: string
          usd_reference_at_execution?: number | null
        }
        Update: {
          amount_base_units?: number
          asset_mint?: string | null
          confirmed_at?: string
          id?: string
          raw?: Json | null
          recipient_address?: string
          signature?: string
          slot?: number | null
          tip_intent_id?: string
          usd_reference_at_execution?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "verified_transfers_tip_intent_id_fkey"
            columns: ["tip_intent_id"]
            isOneToOne: true
            referencedRelation: "tip_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_challenges: {
        Row: {
          address: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          membership_id: string
          message: string
          nonce: string
        }
        Insert: {
          address: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          membership_id: string
          message: string
          nonce: string
        }
        Update: {
          address?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          membership_id?: string
          message?: string
          nonce?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_challenges_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          active_from: string
          address: string
          created_at: string
          id: string
          membership_id: string
          nonce: string | null
          replaced_at: string | null
          signature_hash: string | null
          status: Database["public"]["Enums"]["wallet_status"]
          verification_method: string | null
          verified_at: string | null
        }
        Insert: {
          active_from?: string
          address: string
          created_at?: string
          id?: string
          membership_id: string
          nonce?: string | null
          replaced_at?: string | null
          signature_hash?: string | null
          status?: Database["public"]["Enums"]["wallet_status"]
          verification_method?: string | null
          verified_at?: string | null
        }
        Update: {
          active_from?: string
          address?: string
          created_at?: string
          id?: string
          membership_id?: string
          nonce?: string | null
          replaced_at?: string | null
          signature_hash?: string | null
          status?: Database["public"]["Enums"]["wallet_status"]
          verification_method?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_updates: {
        Row: {
          attempt_count: number
          last_error: string | null
          processed_at: string | null
          received_at: string
          status: string
          telegram_update_id: number
          update_type: string | null
        }
        Insert: {
          attempt_count?: number
          last_error?: string | null
          processed_at?: string | null
          received_at?: string
          status?: string
          telegram_update_id: number
          update_type?: string | null
        }
        Update: {
          attempt_count?: number
          last_error?: string | null
          processed_at?: string | null
          received_at?: string
          status?: string
          telegram_update_id?: number
          update_type?: string | null
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
      call_status:
        | "pending_confirmation"
        | "active"
        | "quarantined"
        | "rugged_or_illiquid"
        | "invalidated"
        | "archived"
        | "imported"
      detection_mode: "command_only" | "full_detection"
      intent_status:
        | "created"
        | "awaiting_payment"
        | "confirmed"
        | "expired"
        | "failed"
        | "cancelled"
      member_role: "member" | "moderator" | "admin"
      tip_privacy: "public" | "pseudonymous" | "anonymous" | "private"
      wallet_status:
        | "unverified"
        | "verified"
        | "pending_replacement"
        | "revoked"
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
      call_status: [
        "pending_confirmation",
        "active",
        "quarantined",
        "rugged_or_illiquid",
        "invalidated",
        "archived",
        "imported",
      ],
      detection_mode: ["command_only", "full_detection"],
      intent_status: [
        "created",
        "awaiting_payment",
        "confirmed",
        "expired",
        "failed",
        "cancelled",
      ],
      member_role: ["member", "moderator", "admin"],
      tip_privacy: ["public", "pseudonymous", "anonymous", "private"],
      wallet_status: [
        "unverified",
        "verified",
        "pending_replacement",
        "revoked",
      ],
    },
  },
} as const
