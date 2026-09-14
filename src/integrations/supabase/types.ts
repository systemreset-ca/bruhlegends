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
      announcement_queue: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string | null
          group_id: string
          id: string
          kind: string
          sent_at: string | null
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key?: string | null
          group_id: string
          id?: string
          kind: string
          sent_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string | null
          group_id?: string
          id?: string
          kind?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_queue_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bruh_account_tip_audit: {
        Row: {
          created_at: string
          event_type: string
          intent_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          intent_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          intent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bruh_account_tip_audit_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "bruh_account_tip_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      bruh_account_tip_authorizations: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          intent_id: string
          telegram_user_id: number
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          intent_id: string
          telegram_user_id: number
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          intent_id?: string
          telegram_user_id?: number
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "bruh_account_tip_authorizations_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "bruh_account_tip_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bruh_account_tip_authorizations_telegram_user_id_fkey"
            columns: ["telegram_user_id"]
            isOneToOne: false
            referencedRelation: "bruh_secure_action_credentials"
            referencedColumns: ["telegram_user_id"]
          },
        ]
      }
      bruh_account_tip_credit_audit: {
        Row: {
          created_at: string
          intent_id: string
          legacy_tip_id: string
          signature: string
        }
        Insert: {
          created_at?: string
          intent_id: string
          legacy_tip_id: string
          signature: string
        }
        Update: {
          created_at?: string
          intent_id?: string
          legacy_tip_id?: string
          signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "bruh_account_tip_credit_audit_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: true
            referencedRelation: "bruh_account_tip_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bruh_account_tip_credit_audit_legacy_tip_id_fkey"
            columns: ["legacy_tip_id"]
            isOneToOne: true
            referencedRelation: "tip_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      bruh_account_tip_execution: {
        Row: {
          actual_fee_lamports: number | null
          finalized_slot: number | null
          intent_id: string
          last_valid_block_height: number | null
          sender_wallet_id: string
          signature: string | null
          signed_transaction: string | null
          state: string
        }
        Insert: {
          actual_fee_lamports?: number | null
          finalized_slot?: number | null
          intent_id: string
          last_valid_block_height?: number | null
          sender_wallet_id: string
          signature?: string | null
          signed_transaction?: string | null
          state: string
        }
        Update: {
          actual_fee_lamports?: number | null
          finalized_slot?: number | null
          intent_id?: string
          last_valid_block_height?: number | null
          sender_wallet_id?: string
          signature?: string | null
          signed_transaction?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "bruh_account_tip_execution_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: true
            referencedRelation: "bruh_account_tip_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bruh_account_tip_execution_sender_wallet_id_fkey"
            columns: ["sender_wallet_id"]
            isOneToOne: false
            referencedRelation: "bruh_account_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      bruh_account_tip_intents: {
        Row: {
          created_at: string
          expires_at: string
          fee_lamports: number
          id: string
          lamports: number
          network: string
          observed_balance: number
          observed_slot: number
          recipient_address: string
          recipient_user_id: number
          recipient_wallet_id: string
          reference: string
          request_key: string
          sender_address: string
          sender_user_id: number
          sender_wallet_id: string
          telegram_chat_id: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          fee_lamports: number
          id: string
          lamports: number
          network: string
          observed_balance: number
          observed_slot: number
          recipient_address: string
          recipient_user_id: number
          recipient_wallet_id: string
          reference: string
          request_key: string
          sender_address: string
          sender_user_id: number
          sender_wallet_id: string
          telegram_chat_id: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          fee_lamports?: number
          id?: string
          lamports?: number
          network?: string
          observed_balance?: number
          observed_slot?: number
          recipient_address?: string
          recipient_user_id?: number
          recipient_wallet_id?: string
          reference?: string
          request_key?: string
          sender_address?: string
          sender_user_id?: number
          sender_wallet_id?: string
          telegram_chat_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bruh_account_tip_intents_recipient_wallet_id_fkey"
            columns: ["recipient_wallet_id"]
            isOneToOne: false
            referencedRelation: "bruh_account_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bruh_account_tip_intents_sender_wallet_id_fkey"
            columns: ["sender_wallet_id"]
            isOneToOne: false
            referencedRelation: "bruh_account_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      bruh_account_wallet_audit: {
        Row: {
          created_at: string
          event_type: string
          id: number
          telegram_user_id: number
          wallet_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          telegram_user_id: number
          wallet_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          telegram_user_id?: number
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bruh_account_wallet_audit_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "bruh_account_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      bruh_account_wallets: {
        Row: {
          address: string
          ciphertext_hex: string
          created_at: string
          id: string
          iv_hex: string
          key_version: string
          network: string
          status: string
          telegram_user_id: number
        }
        Insert: {
          address: string
          ciphertext_hex: string
          created_at?: string
          id: string
          iv_hex: string
          key_version: string
          network: string
          status?: string
          telegram_user_id: number
        }
        Update: {
          address?: string
          ciphertext_hex?: string
          created_at?: string
          id?: string
          iv_hex?: string
          key_version?: string
          network?: string
          status?: string
          telegram_user_id?: number
        }
        Relationships: []
      }
      bruh_external_wallet_audit: {
        Row: {
          candidate_id: string
          created_at: string
          event_type: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          event_type: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          event_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bruh_external_wallet_audit_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "bruh_external_wallet_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      bruh_external_wallet_candidates: {
        Row: {
          address: string
          created_at: string
          id: string
          network: string
          status: string
          telegram_user_id: number
        }
        Insert: {
          address: string
          created_at?: string
          id: string
          network: string
          status: string
          telegram_user_id: number
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          network?: string
          status?: string
          telegram_user_id?: number
        }
        Relationships: []
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
      bruh_secure_action_audit: {
        Row: {
          created_at: string
          event_type: string
          id: number
          intent_id: string | null
          telegram_user_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          intent_id?: string | null
          telegram_user_id: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          intent_id?: string | null
          telegram_user_id?: number
        }
        Relationships: []
      }
      bruh_secure_action_credentials: {
        Row: {
          attempt_expires_at: string | null
          attempt_intent_id: string | null
          attempt_nonce: string | null
          created_at: string
          failures: number
          hash_hex: string
          iterations: number
          locked_until: string | null
          next_attempt_at: string | null
          salt_hex: string
          telegram_user_id: number
        }
        Insert: {
          attempt_expires_at?: string | null
          attempt_intent_id?: string | null
          attempt_nonce?: string | null
          created_at?: string
          failures?: number
          hash_hex: string
          iterations: number
          locked_until?: string | null
          next_attempt_at?: string | null
          salt_hex: string
          telegram_user_id: number
        }
        Update: {
          attempt_expires_at?: string | null
          attempt_intent_id?: string | null
          attempt_nonce?: string | null
          created_at?: string
          failures?: number
          hash_hex?: string
          iterations?: number
          locked_until?: string | null
          next_attempt_at?: string | null
          salt_hex?: string
          telegram_user_id?: number
        }
        Relationships: []
      }
      bruh_secure_action_setup_leases: {
        Row: {
          expires_at: string | null
          next_attempt_at: string
          nonce: string | null
          telegram_user_id: number
        }
        Insert: {
          expires_at?: string | null
          next_attempt_at: string
          nonce?: string | null
          telegram_user_id: number
        }
        Update: {
          expires_at?: string | null
          next_attempt_at?: string
          nonce?: string | null
          telegram_user_id?: number
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
            columns: ["caller_membership_id", "group_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id", "group_id"]
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
            columns: ["season_id", "group_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id", "group_id"]
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
            columns: ["call_id", "group_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id", "group_id"]
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
            columns: ["raised_by_membership_id", "group_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_membership_id_fkey"
            columns: ["resolved_by_membership_id", "group_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id", "group_id"]
          },
        ]
      }
      fee_events: {
        Row: {
          asset_mint: string | null
          asset_symbol: string
          created_at: string
          fee_base_units: number
          fee_bps: number
          gross_base_units: number
          group_id: string | null
          id: string
          leg: Database["public"]["Enums"]["fee_leg"]
          membership_id: string | null
          signature: string | null
          status: string
          tip_intent_id: string | null
          treasury_address: string
          updated_at: string
          usd_reference_at_execution: number | null
        }
        Insert: {
          asset_mint?: string | null
          asset_symbol: string
          created_at?: string
          fee_base_units: number
          fee_bps: number
          gross_base_units: number
          group_id?: string | null
          id?: string
          leg: Database["public"]["Enums"]["fee_leg"]
          membership_id?: string | null
          signature?: string | null
          status?: string
          tip_intent_id?: string | null
          treasury_address: string
          updated_at?: string
          usd_reference_at_execution?: number | null
        }
        Update: {
          asset_mint?: string | null
          asset_symbol?: string
          created_at?: string
          fee_base_units?: number
          fee_bps?: number
          gross_base_units?: number
          group_id?: string | null
          id?: string
          leg?: Database["public"]["Enums"]["fee_leg"]
          membership_id?: string | null
          signature?: string | null
          status?: string
          tip_intent_id?: string | null
          treasury_address?: string
          updated_at?: string
          usd_reference_at_execution?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_events_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_events_tip_intent_id_fkey"
            columns: ["tip_intent_id"]
            isOneToOne: false
            referencedRelation: "tip_intents"
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
          participation_opt_out: boolean
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
          participation_opt_out?: boolean
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
          participation_opt_out?: boolean
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
      miniapp_login_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          group_id: string | null
          id: string
          telegram_user_id: number
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          group_id?: string | null
          id?: string
          telegram_user_id: number
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          group_id?: string | null
          id?: string
          telegram_user_id?: number
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "miniapp_login_tokens_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      miniapp_sessions: {
        Row: {
          created_at: string
          expires_at: string
          group_id: string | null
          id: string
          session_hash: string
          telegram_user_id: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          group_id?: string | null
          id?: string
          session_hash: string
          telegram_user_id: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          group_id?: string | null
          id?: string
          session_hash?: string
          telegram_user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "miniapp_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      participation_events: {
        Row: {
          actor_id: string | null
          counterparty_id: string | null
          created_at: string
          earning_day: string
          group_id: string
          id: string
          membership_id: string
          points: number
          reason_code: string
          reverses_event_id: string | null
          rule_version: string
          season_id: string
          source_id: string
          source_kind: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          counterparty_id?: string | null
          created_at?: string
          earning_day: string
          group_id: string
          id?: string
          membership_id: string
          points: number
          reason_code: string
          reverses_event_id?: string | null
          rule_version: string
          season_id: string
          source_id: string
          source_kind: string
          status: string
        }
        Update: {
          actor_id?: string | null
          counterparty_id?: string | null
          created_at?: string
          earning_day?: string
          group_id?: string
          id?: string
          membership_id?: string
          points?: number
          reason_code?: string
          reverses_event_id?: string | null
          rule_version?: string
          season_id?: string
          source_id?: string
          source_kind?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "participation_events_actor_id_group_id_fkey"
            columns: ["actor_id", "group_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "participation_events_counterparty_id_group_id_fkey"
            columns: ["counterparty_id", "group_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "participation_events_membership_id_group_id_fkey"
            columns: ["membership_id", "group_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "participation_events_reverses_event_id_fkey"
            columns: ["reverses_event_id"]
            isOneToOne: false
            referencedRelation: "participation_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participation_events_season_id_group_id_fkey"
            columns: ["season_id", "group_id"]
            isOneToOne: false
            referencedRelation: "participation_seasons"
            referencedColumns: ["id", "group_id"]
          },
        ]
      }
      participation_jobs: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          error_code: string | null
          group_id: string
          id: string
          season_id: string
          status: string
          tip_id: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          error_code?: string | null
          group_id: string
          id?: string
          season_id: string
          status?: string
          tip_id: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          error_code?: string | null
          group_id?: string
          id?: string
          season_id?: string
          status?: string
          tip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participation_jobs_season_id_group_id_fkey"
            columns: ["season_id", "group_id"]
            isOneToOne: false
            referencedRelation: "participation_seasons"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "participation_jobs_tip_id_fkey"
            columns: ["tip_id"]
            isOneToOne: false
            referencedRelation: "tip_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      participation_reviews: {
        Row: {
          evidence_id: string
          group_id: string
          id: string
          membership_id: string
          reviewed_at: string
          reviewer_id: string
          season_id: string
          source_kind: string
        }
        Insert: {
          evidence_id: string
          group_id: string
          id?: string
          membership_id: string
          reviewed_at?: string
          reviewer_id: string
          season_id: string
          source_kind: string
        }
        Update: {
          evidence_id?: string
          group_id?: string
          id?: string
          membership_id?: string
          reviewed_at?: string
          reviewer_id?: string
          season_id?: string
          source_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "participation_reviews_membership_id_group_id_fkey"
            columns: ["membership_id", "group_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "participation_reviews_reviewer_id_group_id_fkey"
            columns: ["reviewer_id", "group_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "participation_reviews_season_id_group_id_fkey"
            columns: ["season_id", "group_id"]
            isOneToOne: false
            referencedRelation: "participation_seasons"
            referencedColumns: ["id", "group_id"]
          },
        ]
      }
      participation_seasons: {
        Row: {
          approval_record: string | null
          created_at: string
          ends_at: string
          group_id: string
          id: string
          member_daily_cap: number
          member_season_cap: number
          name: string
          network: string
          pair_daily_cap: number
          rule_version: string
          season_budget: number
          starts_at: string
          status: string
          tester_cap: number
          weights: Json
        }
        Insert: {
          approval_record?: string | null
          created_at?: string
          ends_at: string
          group_id: string
          id?: string
          member_daily_cap: number
          member_season_cap: number
          name: string
          network: string
          pair_daily_cap: number
          rule_version: string
          season_budget: number
          starts_at: string
          status?: string
          tester_cap: number
          weights: Json
        }
        Update: {
          approval_record?: string | null
          created_at?: string
          ends_at?: string
          group_id?: string
          id?: string
          member_daily_cap?: number
          member_season_cap?: number
          name?: string
          network?: string
          pair_daily_cap?: number
          rule_version?: string
          season_budget?: number
          starts_at?: string
          status?: string
          tester_cap?: number
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "participation_seasons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
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
      telegram_outbox: {
        Row: {
          action_key: string
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          lock_token: string | null
          locked_at: string | null
          method: string
          next_attempt_at: string
          payload: Json
          response_message_id: number | null
          sent_at: string | null
          status: string
          telegram_update_id: number
        }
        Insert: {
          action_key: string
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          method: string
          next_attempt_at?: string
          payload: Json
          response_message_id?: number | null
          sent_at?: string | null
          status?: string
          telegram_update_id: number
        }
        Update: {
          action_key?: string
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          method?: string
          next_attempt_at?: string
          payload?: Json
          response_message_id?: number | null
          sent_at?: string | null
          status?: string
          telegram_update_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_outbox_telegram_update_id_fkey"
            columns: ["telegram_update_id"]
            isOneToOne: false
            referencedRelation: "webhook_updates"
            referencedColumns: ["telegram_update_id"]
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
          network: string
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
          network?: string
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
          network?: string
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
            columns: ["call_id", "group_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id", "group_id"]
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
            columns: ["recipient_membership_id", "group_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "tip_intents_sender_membership_id_fkey"
            columns: ["sender_membership_id", "group_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id", "group_id"]
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
          lock_token: string | null
          locked_at: string | null
          next_attempt_at: string
          payload: Json | null
          processed_at: string | null
          received_at: string
          status: string
          telegram_chat_id: number | null
          telegram_update_id: number
          update_type: string | null
        }
        Insert: {
          attempt_count?: number
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          status?: string
          telegram_chat_id?: number | null
          telegram_update_id: number
          update_type?: string | null
        }
        Update: {
          attempt_count?: number
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          status?: string
          telegram_chat_id?: number | null
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
      award_participation: {
        Args: {
          p_kind: string
          p_member: string
          p_season: string
          p_source: string
        }
        Returns: {
          actor_id: string | null
          counterparty_id: string | null
          created_at: string
          earning_day: string
          group_id: string
          id: string
          membership_id: string
          points: number
          reason_code: string
          reverses_event_id: string | null
          rule_version: string
          season_id: string
          source_id: string
          source_kind: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "participation_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bruh_account_tip_authorized_read: {
        Args: { p_id: string; p_token_hash: string; p_user_id: number }
        Returns: Json
      }
      bruh_account_tip_authorized_signed: {
        Args: {
          p_id: string
          p_last_height: number
          p_signature: string
          p_token_hash: string
          p_transaction: string
          p_user_id: number
        }
        Returns: Json
      }
      bruh_account_tip_cancel: {
        Args: { p_id: string; p_user_id: number }
        Returns: Json
      }
      bruh_account_tip_finalize: {
        Args: {
          p_fee: number
          p_id: string
          p_signature: string
          p_slot: number
          p_user_id: number
        }
        Returns: Json
      }
      bruh_account_tip_finalize_credit: {
        Args: {
          p_fee: number
          p_id: string
          p_signature: string
          p_slot: number
          p_user_id: number
        }
        Returns: Json
      }
      bruh_account_tip_find_request: {
        Args: { p_request_key: string; p_user_id: number }
        Returns: Json
      }
      bruh_account_tip_read: {
        Args: { p_id: string; p_user_id: number }
        Returns: Json
      }
      bruh_account_tip_reserve: { Args: { p_record: Json }; Returns: Json }
      bruh_account_tip_signed: {
        Args: {
          p_id: string
          p_last_height: number
          p_signature: string
          p_transaction: string
          p_user_id: number
        }
        Returns: Json
      }
      bruh_account_wallet_provision: { Args: { p_record: Json }; Returns: Json }
      bruh_account_wallet_read: { Args: { p_user_id: string }; Returns: Json }
      bruh_community_leaderboard: {
        Args: {
          p_limit: number
          p_network: string
          p_order: string
          p_window: string
        }
        Returns: Json
      }
      bruh_external_wallet_read: { Args: { p_user_id: string }; Returns: Json }
      bruh_external_wallet_register: {
        Args: { p_address: string; p_id: string; p_user_id: string }
        Returns: Json
      }
      bruh_secure_action_begin: {
        Args: { p_intent_id: string; p_user_id: number }
        Returns: Json
      }
      bruh_secure_action_enroll: {
        Args: {
          p_hash: string
          p_nonce: string
          p_salt: string
          p_user_id: number
        }
        Returns: boolean
      }
      bruh_secure_action_finish: {
        Args: {
          p_intent_id: string
          p_nonce: string
          p_ok: boolean
          p_token_hash: string
          p_user_id: number
        }
        Returns: boolean
      }
      bruh_secure_action_setup_begin: {
        Args: { p_user_id: number }
        Returns: string
      }
      claim_telegram_outbox: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempt_count: number
          id: string
          lock_token: string
          method: string
          payload: Json
        }[]
      }
      claim_telegram_outbox_by_update_id: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_telegram_update_id: number
        }
        Returns: {
          attempt_count: number
          id: string
          lock_token: string
          method: string
          payload: Json
        }[]
      }
      claim_telegram_update_by_id: {
        Args: { p_lease_seconds?: number; p_telegram_update_id: number }
        Returns: {
          attempt_count: number
          lock_token: string
          payload: Json
          telegram_update_id: number
        }[]
      }
      claim_telegram_updates: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempt_count: number
          lock_token: string
          payload: Json
          telegram_update_id: number
        }[]
      }
      complete_wallet_challenge: {
        Args: {
          p_challenge_id: string
          p_membership_id: string
          p_replacement_delay_minutes: number
          p_signature_hash: string
          p_verification_method: string
        }
        Returns: {
          replaced_existing: boolean
          wallet_address: string
        }[]
      }
      create_participation_season: {
        Args: {
          p_approval_record?: string
          p_budget: number
          p_daily: number
          p_end: string
          p_group: string
          p_member: number
          p_name: string
          p_network: string
          p_pair: number
          p_start: string
          p_tester: number
          p_version: string
          p_weights: Json
        }
        Returns: string
      }
      enqueue_telegram_action: {
        Args: {
          p_action_key: string
          p_method: string
          p_payload: Json
          p_telegram_update_id: number
        }
        Returns: undefined
      }
      exchange_miniapp_login_token: {
        Args: { p_session_hash: string; p_token_hash: string }
        Returns: {
          group_id: string
          telegram_user_id: number
        }[]
      }
      participation_member_job_counts: {
        Args: { p_group: string; p_member: string }
        Returns: Json
      }
      participation_member_total: {
        Args: { p_group: string; p_member: string }
        Returns: number
      }
      process_participation_jobs: { Args: { p_limit?: number }; Returns: Json }
      retry_participation_job: { Args: { p_job: string }; Returns: undefined }
      reverse_participation: {
        Args: {
          p_actor: string
          p_event: string
          p_reason: string
          p_request: string
        }
        Returns: {
          actor_id: string | null
          counterparty_id: string | null
          created_at: string
          earning_day: string
          group_id: string
          id: string
          membership_id: string
          points: number
          reason_code: string
          reverses_event_id: string | null
          rule_version: string
          season_id: string
          source_id: string
          source_kind: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "participation_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_participation_activity: {
        Args: {
          p_evidence: string
          p_kind: string
          p_member: string
          p_reviewer: string
          p_season: string
        }
        Returns: string
      }
      set_participation_season_status: {
        Args: { p_season: string; p_status: string }
        Returns: undefined
      }
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
      fee_leg: "buy" | "sell"
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
      fee_leg: ["buy", "sell"],
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
