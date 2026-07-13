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
      accounts: {
        Row: {
          account_number: string
          account_subtype: Database["public"]["Enums"]["account_subtype"] | null
          account_type: Database["public"]["Enums"]["account_type"]
          branch_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          normal_balance: string | null
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_number: string
          account_subtype?:
            | Database["public"]["Enums"]["account_subtype"]
            | null
          account_type: Database["public"]["Enums"]["account_type"]
          branch_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          normal_balance?: string | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string
          account_subtype?:
            | Database["public"]["Enums"]["account_subtype"]
            | null
          account_type?: Database["public"]["Enums"]["account_type"]
          branch_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          normal_balance?: string | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          branch_id: string | null
          created_at: string | null
          details: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          action: string
          actor_id: string
          branch_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          branch_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_actions: {
        Row: {
          action_type: string
          id: string
          is_async: boolean | null
          params: Json | null
          rule_id: string
          sort_order: number | null
        }
        Insert: {
          action_type: string
          id?: string
          is_async?: boolean | null
          params?: Json | null
          rule_id: string
          sort_order?: number | null
        }
        Update: {
          action_type?: string
          id?: string
          is_async?: boolean | null
          params?: Json | null
          rule_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_actions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_conditions: {
        Row: {
          field: string | null
          id: string
          logic_gate: string | null
          operator: string | null
          parent_id: string | null
          rule_id: string
          sort_order: number | null
          value: string | null
        }
        Insert: {
          field?: string | null
          id?: string
          logic_gate?: string | null
          operator?: string | null
          parent_id?: string | null
          rule_id: string
          sort_order?: number | null
          value?: string | null
        }
        Update: {
          field?: string | null
          id?: string
          logic_gate?: string | null
          operator?: string | null
          parent_id?: string | null
          rule_id?: string
          sort_order?: number | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_conditions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "automation_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_conditions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          source: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          source?: string | null
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          action_type: string
          created_at: string | null
          duration_ms: number | null
          error_msg: string | null
          event_id: string | null
          id: string
          input: Json | null
          output: Json | null
          rule_id: string | null
          status: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          duration_ms?: number | null
          error_msg?: string | null
          event_id?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          rule_id?: string | null
          status: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          duration_ms?: number | null
          error_msg?: string | null
          event_id?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          rule_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "automation_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          cooldown_ms: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_daily: number | null
          name: string
          priority: number | null
          trigger_event: string
          updated_at: string | null
        }
        Insert: {
          cooldown_ms?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_daily?: number | null
          name: string
          priority?: number | null
          trigger_event: string
          updated_at?: string | null
        }
        Update: {
          cooldown_ms?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_daily?: number | null
          name?: string
          priority?: number | null
          trigger_event?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_schedules: {
        Row: {
          created_at: string | null
          cron_expr: string
          id: string
          is_active: boolean | null
          last_run: string | null
          name: string
          next_run: string | null
          payload: Json | null
          rule_id: string | null
        }
        Insert: {
          created_at?: string | null
          cron_expr: string
          id?: string
          is_active?: boolean | null
          last_run?: string | null
          name: string
          next_run?: string | null
          payload?: Json | null
          rule_id?: string | null
        }
        Update: {
          created_at?: string | null
          cron_expr?: string
          id?: string
          is_active?: boolean | null
          last_run?: string | null
          name?: string
          next_run?: string | null
          payload?: Json | null
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_schedules_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_id: string
          account_name: string
          account_number: string | null
          account_type: string | null
          bank_name: string
          branch_id: string | null
          created_at: string | null
          currency: string | null
          current_balance: number | null
          id: string
          is_active: boolean | null
          last_reconciled_at: string | null
          opening_balance: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          account_name: string
          account_number?: string | null
          account_type?: string | null
          bank_name: string
          branch_id?: string | null
          created_at?: string | null
          currency?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          last_reconciled_at?: string | null
          opening_balance?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          account_name?: string
          account_number?: string | null
          account_type?: string | null
          bank_name?: string
          branch_id?: string | null
          created_at?: string | null
          currency?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          last_reconciled_at?: string | null
          opening_balance?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliation_items: {
        Row: {
          bank_transaction_id: string | null
          id: string
          journal_entry_id: string | null
          match_type: string | null
          matched_at: string | null
          notes: string | null
          reconciliation_id: string
        }
        Insert: {
          bank_transaction_id?: string | null
          id?: string
          journal_entry_id?: string | null
          match_type?: string | null
          matched_at?: string | null
          notes?: string | null
          reconciliation_id: string
        }
        Update: {
          bank_transaction_id?: string | null
          id?: string
          journal_entry_id?: string | null
          match_type?: string | null
          matched_at?: string | null
          notes?: string | null
          reconciliation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliation_items_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_items_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_items_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "bank_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          bank_account_id: string
          bank_balance: number
          book_balance: number
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          difference: number
          id: string
          notes: string | null
          reconciliation_date: string
          status: string | null
        }
        Insert: {
          bank_account_id: string
          bank_balance?: number
          book_balance?: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          difference?: number
          id?: string
          notes?: string | null
          reconciliation_date: string
          status?: string | null
        }
        Update: {
          bank_account_id?: string
          bank_balance?: number
          book_balance?: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          difference?: number
          id?: string
          notes?: string | null
          reconciliation_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          is_reconciled: boolean | null
          journal_entry_id: string | null
          reconciled_at: string | null
          reference_number: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id: string
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          is_reconciled?: boolean | null
          journal_entry_id?: string | null
          reconciled_at?: string | null
          reference_number?: string | null
          transaction_date: string
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          is_reconciled?: boolean | null
          journal_entry_id?: string | null
          reconciled_at?: string | null
          reference_number?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_tracking: {
        Row: {
          batch_number: string
          created_at: string | null
          expiry_date: string | null
          id: string
          lot_number: string | null
          manufacture_date: string | null
          notes: string | null
          product_id: string
          quantity: number
          recall_reference: string | null
          received_date: string | null
          reserved_quantity: number | null
          status: string
          supplier_id: string | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          batch_number: string
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          manufacture_date?: string | null
          notes?: string | null
          product_id: string
          quantity?: number
          recall_reference?: string | null
          received_date?: string | null
          reserved_quantity?: number | null
          status?: string
          supplier_id?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          batch_number?: string
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          manufacture_date?: string | null
          notes?: string | null
          product_id?: string
          quantity?: number
          recall_reference?: string | null
          received_date?: string | null
          reserved_quantity?: number | null
          status?: string
          supplier_id?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_tracking_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "batch_tracking_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_tracking_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "batch_tracking_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["preferred_supplier_id"]
          },
          {
            foreignKeyName: "batch_tracking_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_performance_view"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "batch_tracking_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_tracking_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_receipt_settings: {
        Row: {
          address: string | null
          branch_id: string
          created_at: string | null
          email: string | null
          id: string
          phone_number: string | null
          receipt_header_text: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          branch_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          phone_number?: string | null
          receipt_header_text?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          phone_number?: string | null
          receipt_header_text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_receipt_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          close_time: string | null
          code: string
          created_at: string | null
          email: string | null
          id: string
          is_main: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          manager_id: string | null
          name: string
          open_time: string | null
          phone: string | null
          status: string | null
          tax_id: string | null
          tax_rate: number | null
          timezone: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          close_time?: string | null
          code: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_main?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          manager_id?: string | null
          name: string
          open_time?: string | null
          phone?: string | null
          status?: string | null
          tax_id?: string | null
          tax_rate?: number | null
          timezone?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          close_time?: string | null
          code?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_main?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          manager_id?: string | null
          name?: string
          open_time?: string | null
          phone?: string | null
          status?: string | null
          tax_id?: string | null
          tax_rate?: number | null
          timezone?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          address: string | null
          business_name: string
          business_pin: string | null
          created_at: string | null
          email: string | null
          id: string
          phone_number: string | null
          receipt_footer_text: string | null
          return_policy_text: string | null
          tax_pin: string | null
          thank_you_message: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string
          business_pin?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          phone_number?: string | null
          receipt_footer_text?: string | null
          return_policy_text?: string | null
          tax_pin?: string | null
          thank_you_message?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          business_pin?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone_number?: string | null
          receipt_footer_text?: string | null
          return_policy_text?: string | null
          tax_pin?: string | null
          thank_you_message?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cash_drawers: {
        Row: {
          branch_id: string
          created_at: string | null
          current_balance: number | null
          drawer_name: string
          expected_balance: number | null
          id: string
          last_counted_at: string | null
          last_counted_by: string | null
          last_variance: number | null
          register_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          current_balance?: number | null
          drawer_name: string
          expected_balance?: number | null
          id?: string
          last_counted_at?: string | null
          last_counted_by?: string | null
          last_variance?: number | null
          register_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          current_balance?: number | null
          drawer_name?: string
          expected_balance?: number | null
          id?: string
          last_counted_at?: string | null
          last_counted_by?: string | null
          last_variance?: number | null
          register_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_drawers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawers_last_counted_by_fkey"
            columns: ["last_counted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawers_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "registers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_events: {
        Row: {
          amount: number
          approved_by: string | null
          balance_after: number | null
          balance_before: number | null
          branch_id: string
          created_at: string | null
          device_info: string | null
          drawer_id: string | null
          event_type: string
          id: string
          notes: string | null
          performed_by: string
          photo_url: string | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          register_id: string | null
        }
        Insert: {
          amount?: number
          approved_by?: string | null
          balance_after?: number | null
          balance_before?: number | null
          branch_id: string
          created_at?: string | null
          device_info?: string | null
          drawer_id?: string | null
          event_type: string
          id?: string
          notes?: string | null
          performed_by: string
          photo_url?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          register_id?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          balance_after?: number | null
          balance_before?: number | null
          branch_id?: string
          created_at?: string | null
          device_info?: string | null
          drawer_id?: string | null
          event_type?: string
          id?: string
          notes?: string | null
          performed_by?: string
          photo_url?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          register_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_events_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_events_drawer_id_fkey"
            columns: ["drawer_id"]
            isOneToOne: false
            referencedRelation: "cash_drawers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_events_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "registers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      category_tax_assignments: {
        Row: {
          category_id: string
          created_at: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_tax_inclusive: boolean | null
          tax_group_id: string
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_tax_inclusive?: boolean | null
          tax_group_id: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_tax_inclusive?: boolean | null
          tax_group_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_tax_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_tax_assignments_tax_group_id_fkey"
            columns: ["tax_group_id"]
            isOneToOne: false
            referencedRelation: "category_tax_view"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "category_tax_assignments_tax_group_id_fkey"
            columns: ["tax_group_id"]
            isOneToOne: false
            referencedRelation: "tax_group_combined_view"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "category_tax_assignments_tax_group_id_fkey"
            columns: ["tax_group_id"]
            isOneToOne: false
            referencedRelation: "tax_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_events: {
        Row: {
          branch_id: string
          created_at: string | null
          device_info: string | null
          event_type: string
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          method: string | null
          notes: string | null
          timestamp: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          device_info?: string | null
          event_type: string
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          method?: string | null
          notes?: string | null
          timestamp?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          device_info?: string | null
          event_type?: string
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          method?: string | null
          notes?: string | null
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clock_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_payments: {
        Row: {
          amount_cents: number
          created_at: string | null
          customer_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          recorded_by: string
          reference_number: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by: string
          reference_number?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "credit_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segment_members: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          customer_id: string
          id: string
          segment_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          customer_id: string
          id?: string
          segment_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          customer_id?: string
          id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_segment_members_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_segment_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_segment_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_segment_members_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "customer_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segments: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          birthday: string | null
          created_at: string | null
          credit_balance: number | null
          credit_limit: number | null
          email: string | null
          id: string
          last_purchase_date: string | null
          loyalty_points: number | null
          name: string
          notes: string | null
          phone: string | null
          search_vector: unknown
          tags: string[] | null
          tier: string | null
          total_lifetime_spend_cents: number | null
          total_visits: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          birthday?: string | null
          created_at?: string | null
          credit_balance?: number | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          last_purchase_date?: string | null
          loyalty_points?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          search_vector?: unknown
          tags?: string[] | null
          tier?: string | null
          total_lifetime_spend_cents?: number | null
          total_visits?: number | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          birthday?: string | null
          created_at?: string | null
          credit_balance?: number | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          last_purchase_date?: string | null
          loyalty_points?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          search_vector?: unknown
          tags?: string[] | null
          tier?: string | null
          total_lifetime_spend_cents?: number | null
          total_visits?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          branch_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_cart: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          session_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          session_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          session_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_cart_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ecommerce_cart_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_cart_items: {
        Row: {
          cart_id: string
          created_at: string | null
          id: string
          product_id: string
          quantity: number
        }
        Insert: {
          cart_id: string
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
        }
        Update: {
          cart_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_cart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ecommerce_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
        ]
      }
      ecommerce_discount_codes: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_discount_amount: number | null
          min_order_amount: number | null
          starts_at: string | null
          usage_limit: number | null
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          starts_at?: string | null
          usage_limit?: number | null
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          starts_at?: string | null
          usage_limit?: number | null
          used_count?: number | null
        }
        Relationships: []
      }
      ecommerce_order_items: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          id: string
          order_id: string
          product_id: string
          quantity: number
          tax_rate: number | null
          total_price: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          order_id: string
          product_id: string
          quantity: number
          tax_rate?: number | null
          total_price: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          tax_rate?: number | null
          total_price?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ecommerce_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
        ]
      }
      ecommerce_orders: {
        Row: {
          billing_address: Json | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          delivered_at: string | null
          discount_amount: number | null
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_amount: number | null
          status: string | null
          store_id: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          billing_address?: Json | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          status?: string | null
          store_id?: string | null
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          billing_address?: Json | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          status?: string | null
          store_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ecommerce_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_product_sync: {
        Row: {
          created_at: string | null
          id: string
          last_synced_at: string | null
          online_data: Json | null
          online_product_id: string | null
          product_id: string
          store_id: string | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          online_data?: Json | null
          online_product_id?: string | null
          product_id: string
          store_id?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          online_data?: Json | null
          online_product_id?: string | null
          product_id?: string
          store_id?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_product_sync_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ecommerce_product_sync_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_product_sync_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ecommerce_product_sync_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_shipping_methods: {
        Row: {
          base_price: number
          created_at: string | null
          description: string | null
          estimated_days: number | null
          id: string
          is_active: boolean | null
          max_order_amount: number | null
          min_order_amount: number | null
          name: string
          price_per_km: number | null
        }
        Insert: {
          base_price: number
          created_at?: string | null
          description?: string | null
          estimated_days?: number | null
          id?: string
          is_active?: boolean | null
          max_order_amount?: number | null
          min_order_amount?: number | null
          name: string
          price_per_km?: number | null
        }
        Update: {
          base_price?: number
          created_at?: string | null
          description?: string | null
          estimated_days?: number | null
          id?: string
          is_active?: boolean | null
          max_order_amount?: number | null
          min_order_amount?: number | null
          name?: string
          price_per_km?: number | null
        }
        Relationships: []
      }
      ecommerce_stores: {
        Row: {
          banner_url: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string | null
          document_name: string | null
          document_type: string
          employee_profile_id: string
          file_url: string | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_name?: string | null
          document_type: string
          employee_profile_id: string
          file_url?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_name?: string | null
          document_type?: string
          employee_profile_id?: string
          file_url?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_profile_id_fkey"
            columns: ["employee_profile_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_goals: {
        Row: {
          created_at: string | null
          current_value: number | null
          description: string | null
          employee_profile_id: string
          end_date: string | null
          id: string
          metric: string | null
          start_date: string | null
          status: string | null
          target_value: number | null
          title: string
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          employee_profile_id: string
          end_date?: string | null
          id?: string
          metric?: string | null
          start_date?: string | null
          status?: string | null
          target_value?: number | null
          title: string
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          employee_profile_id?: string
          end_date?: string | null
          id?: string
          metric?: string | null
          start_date?: string | null
          status?: string | null
          target_value?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_goals_employee_profile_id_fkey"
            columns: ["employee_profile_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_profiles: {
        Row: {
          allowances: number | null
          basic_salary: number | null
          created_at: string | null
          department_id: string | null
          digital_signature_url: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          employee_id: string | null
          employment_status: string | null
          employment_type: string | null
          hire_date: string | null
          id: string
          kra_pin: string | null
          national_id: string | null
          nhif_number: string | null
          nssf_number: string | null
          photo_url: string | null
          position: string | null
          search_vector: unknown
          staff_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allowances?: number | null
          basic_salary?: number | null
          created_at?: string | null
          department_id?: string | null
          digital_signature_url?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_id?: string | null
          employment_status?: string | null
          employment_type?: string | null
          hire_date?: string | null
          id?: string
          kra_pin?: string | null
          national_id?: string | null
          nhif_number?: string | null
          nssf_number?: string | null
          photo_url?: string | null
          position?: string | null
          search_vector?: unknown
          staff_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allowances?: number | null
          basic_salary?: number | null
          created_at?: string | null
          department_id?: string | null
          digital_signature_url?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_id?: string | null
          employment_status?: string | null
          employment_type?: string | null
          hire_date?: string | null
          id?: string
          kra_pin?: string | null
          national_id?: string | null
          nhif_number?: string | null
          nssf_number?: string | null
          photo_url?: string | null
          position?: string | null
          search_vector?: unknown
          staff_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_schedules: {
        Row: {
          branch_id: string
          break_duration: number | null
          created_at: string | null
          date: string
          employee_profile_id: string
          end_time: string
          id: string
          notes: string | null
          shift_template_id: string | null
          start_time: string
          status: string | null
        }
        Insert: {
          branch_id: string
          break_duration?: number | null
          created_at?: string | null
          date: string
          employee_profile_id: string
          end_time: string
          id?: string
          notes?: string | null
          shift_template_id?: string | null
          start_time: string
          status?: string | null
        }
        Update: {
          branch_id?: string
          break_duration?: number | null
          created_at?: string | null
          date?: string
          employee_profile_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          shift_template_id?: string | null
          start_time?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_schedules_employee_profile_id_fkey"
            columns: ["employee_profile_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_schedules_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string | null
          created_by: string | null
          from_currency: string
          id: string
          rate: number
          source: string | null
          to_currency: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          from_currency: string
          id?: string
          rate: number
          source?: string | null
          to_currency: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          from_currency?: string
          id?: string
          rate?: number
          source?: string | null
          to_currency?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_cents: number
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          category_id: string
          created_at: string | null
          created_by: string
          currency: string | null
          description: string
          exchange_rate: number | null
          expense_date: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          recurring_id: string | null
          reference_number: string | null
          rejection_reason: string | null
          status: string
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          amount_cents: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          category_id: string
          created_at?: string | null
          created_by: string
          currency?: string | null
          description: string
          exchange_rate?: number | null
          expense_date?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          recurring_id?: string | null
          reference_number?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          amount_cents?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          category_id?: string
          created_at?: string | null
          created_by?: string
          currency?: string | null
          description?: string
          exchange_rate?: number | null
          expense_date?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          recurring_id?: string | null
          reference_number?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          key: string
          name: string
          rollout_percentage: number | null
          target_branches: string[] | null
          target_roles: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          key: string
          name: string
          rollout_percentage?: number | null
          target_branches?: string[] | null
          target_roles?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          key?: string
          name?: string
          rollout_percentage?: number | null
          target_branches?: string[] | null
          target_roles?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      financial_periods: {
        Row: {
          branch_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          end_date: string
          id: string
          name: string
          period_type: string
          start_date: string
          status: string | null
        }
        Insert: {
          branch_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          end_date: string
          id?: string
          name: string
          period_type: string
          start_date: string
          status?: string | null
        }
        Update: {
          branch_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          end_date?: string
          id?: string
          name?: string
          period_type?: string
          start_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_periods_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_configs: {
        Row: {
          category: string | null
          config: Json | null
          created_at: string | null
          credentials: Json | null
          description: string | null
          id: string
          integration_id: string
          last_sync_at: string | null
          name: string
          status: string | null
          sync_error: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          config?: Json | null
          created_at?: string | null
          credentials?: Json | null
          description?: string | null
          id?: string
          integration_id: string
          last_sync_at?: string | null
          name: string
          status?: string | null
          sync_error?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          config?: Json | null
          created_at?: string | null
          credentials?: Json | null
          description?: string | null
          id?: string
          integration_id?: string
          last_sync_at?: string | null
          name?: string
          status?: string | null
          sync_error?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          action: string
          created_at: string | null
          duration_ms: number | null
          id: string
          integration_id: string
          level: string | null
          message: string
          metadata: Json | null
        }
        Insert: {
          action: string
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          integration_id: string
          level?: string | null
          message: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          integration_id?: string
          level?: string | null
          message?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["integration_id"]
          },
        ]
      }
      inventory: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          last_counted_at: string | null
          product_id: string
          quantity: number
          reserved_stock: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          last_counted_at?: string | null
          product_id: string
          quantity?: number
          reserved_stock?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          last_counted_at?: string | null
          product_id?: string
          quantity?: number
          reserved_stock?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
        ]
      }
      inventory_snapshots: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          reserved_stock: number | null
          snapshot_date: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          reserved_stock?: number | null
          snapshot_date?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          reserved_stock?: number | null
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_snapshots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          id: string
          invoice_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sort_order: number | null
          tax_cents: number | null
          tax_percent: number | null
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          sort_order?: number | null
          tax_cents?: number | null
          tax_percent?: number | null
          total_cents: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sort_order?: number | null
          tax_cents?: number | null
          tax_percent?: number | null
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          branch_id: string
          created_at: string | null
          fiscal_year: string | null
          id: string
          last_number: number
          prefix: string
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          fiscal_year?: string | null
          id?: string
          last_number?: number
          prefix?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          fiscal_year?: string | null
          id?: string
          last_number?: number
          prefix?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          branch_id: string
          created_at: string | null
          created_by: string
          currency: string | null
          customer_id: string
          due_date: string
          exchange_rate: number | null
          id: string
          invoice_number: string
          issued_date: string
          notes: string | null
          paid_amount_cents: number
          paid_date: string | null
          sale_id: string | null
          status: string
          terms: string | null
          total_amount_cents: number
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          created_by: string
          currency?: string | null
          customer_id: string
          due_date: string
          exchange_rate?: number | null
          id?: string
          invoice_number: string
          issued_date?: string
          notes?: string | null
          paid_amount_cents?: number
          paid_date?: string | null
          sale_id?: string | null
          status?: string
          terms?: string | null
          total_amount_cents: number
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          created_by?: string
          currency?: string | null
          customer_id?: string
          due_date?: string
          exchange_rate?: number | null
          id?: string
          invoice_number?: string
          issued_date?: string
          notes?: string | null
          paid_amount_cents?: number
          paid_date?: string | null
          sale_id?: string | null
          status?: string
          terms?: string | null
          total_amount_cents?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_void_status"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          entry_date: string
          entry_number: string
          id: string
          is_adjusting: boolean | null
          notes: string | null
          period_id: string | null
          posted_at: string | null
          posted_by: string | null
          reference_id: string | null
          reference_type: string | null
          status: string | null
          total_credit: number | null
          total_debit: number | null
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          entry_date: string
          entry_number: string
          id?: string
          is_adjusting?: boolean | null
          notes?: string | null
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          total_credit?: number | null
          total_debit?: number | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          entry_date?: string
          entry_number?: string
          id?: string
          is_adjusting?: boolean | null
          notes?: string | null
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          total_credit?: number | null
          total_debit?: number | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "financial_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string | null
          credit: number | null
          debit: number | null
          description: string | null
          id: string
          journal_entry_id: string
          line_number: number
        }
        Insert: {
          account_id: string
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          description?: string | null
          id?: string
          journal_entry_id: string
          line_number: number
        }
        Update: {
          account_id?: string
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          description?: string | null
          id?: string
          journal_entry_id?: string
          line_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_checklists: {
        Row: {
          branch_id: string
          checked_by: string | null
          created_at: string | null
          id: string
          items: Json | null
          last_checked_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          checked_by?: string | null
          created_at?: string | null
          id?: string
          items?: Json | null
          last_checked_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          checked_by?: string | null
          created_at?: string | null
          id?: string
          items?: Json | null
          last_checked_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "launch_checklists_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_checklists_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          employee_profile_id: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          start_date: string
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          employee_profile_id: string
          end_date: string
          id?: string
          leave_type: string
          reason?: string | null
          start_date: string
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          employee_profile_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          start_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_profile_id_fkey"
            columns: ["employee_profile_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_settings: {
        Row: {
          birthday_multiplier: number | null
          campaign_multiplier: number | null
          created_at: string | null
          earn_enabled: boolean | null
          earn_minimum_basket_cents: number | null
          earn_on_discounted: boolean | null
          earn_rate_cents_per_point: number | null
          earn_threshold_cents: number | null
          enable_birthday_bonus: boolean | null
          enable_holiday_bonus: boolean | null
          enable_tiers: boolean | null
          enable_weekend_bonus: boolean | null
          expiry_days: number | null
          expiry_enabled: boolean | null
          holiday_multiplier: number | null
          id: string
          point_value_cents: number | null
          redeem_enabled: boolean | null
          redeem_max_percent_per_sale: number | null
          redeem_minimum_basket_cents: number | null
          redeem_minimum_points: number | null
          redeem_value_cents: number | null
          tier_bronze_multiplier: number | null
          tier_gold_multiplier: number | null
          tier_platinum_multiplier: number | null
          tier_silver_multiplier: number | null
          updated_at: string | null
          updated_by: string | null
          weekend_multiplier: number | null
        }
        Insert: {
          birthday_multiplier?: number | null
          campaign_multiplier?: number | null
          created_at?: string | null
          earn_enabled?: boolean | null
          earn_minimum_basket_cents?: number | null
          earn_on_discounted?: boolean | null
          earn_rate_cents_per_point?: number | null
          earn_threshold_cents?: number | null
          enable_birthday_bonus?: boolean | null
          enable_holiday_bonus?: boolean | null
          enable_tiers?: boolean | null
          enable_weekend_bonus?: boolean | null
          expiry_days?: number | null
          expiry_enabled?: boolean | null
          holiday_multiplier?: number | null
          id?: string
          point_value_cents?: number | null
          redeem_enabled?: boolean | null
          redeem_max_percent_per_sale?: number | null
          redeem_minimum_basket_cents?: number | null
          redeem_minimum_points?: number | null
          redeem_value_cents?: number | null
          tier_bronze_multiplier?: number | null
          tier_gold_multiplier?: number | null
          tier_platinum_multiplier?: number | null
          tier_silver_multiplier?: number | null
          updated_at?: string | null
          updated_by?: string | null
          weekend_multiplier?: number | null
        }
        Update: {
          birthday_multiplier?: number | null
          campaign_multiplier?: number | null
          created_at?: string | null
          earn_enabled?: boolean | null
          earn_minimum_basket_cents?: number | null
          earn_on_discounted?: boolean | null
          earn_rate_cents_per_point?: number | null
          earn_threshold_cents?: number | null
          enable_birthday_bonus?: boolean | null
          enable_holiday_bonus?: boolean | null
          enable_tiers?: boolean | null
          enable_weekend_bonus?: boolean | null
          expiry_days?: number | null
          expiry_enabled?: boolean | null
          holiday_multiplier?: number | null
          id?: string
          point_value_cents?: number | null
          redeem_enabled?: boolean | null
          redeem_max_percent_per_sale?: number | null
          redeem_minimum_basket_cents?: number | null
          redeem_minimum_points?: number | null
          redeem_value_cents?: number | null
          tier_bronze_multiplier?: number | null
          tier_gold_multiplier?: number | null
          tier_platinum_multiplier?: number | null
          tier_silver_multiplier?: number | null
          updated_at?: string | null
          updated_by?: string | null
          weekend_multiplier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          balance_after: number
          balance_before: number
          branch_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          points_delta: number
          reason: string | null
          sale_id: string | null
          type: string
        }
        Insert: {
          balance_after: number
          balance_before: number
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          points_delta: number
          reason?: string | null
          sale_id?: string | null
          type: string
        }
        Update: {
          balance_after?: number
          balance_before?: number
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          points_delta?: number
          reason?: string | null
          sale_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_void_status"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_transactions: {
        Row: {
          amount: number
          callback_payload: Json | null
          callback_received_at: string | null
          checkout_request_id: string
          created_at: string
          error_message: string | null
          id: string
          initiated_at: string
          merchant_request_id: string
          mpesa_receipt_number: string | null
          phone_number: string
          result_code: number | null
          result_description: string | null
          sale_finalized_at: string | null
          sale_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          callback_payload?: Json | null
          callback_received_at?: string | null
          checkout_request_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          initiated_at?: string
          merchant_request_id: string
          mpesa_receipt_number?: string | null
          phone_number: string
          result_code?: number | null
          result_description?: string | null
          sale_finalized_at?: string | null
          sale_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          callback_payload?: Json | null
          callback_received_at?: string | null
          checkout_request_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          initiated_at?: string
          merchant_request_id?: string
          mpesa_receipt_number?: string | null
          phone_number?: string
          result_code?: number | null
          result_description?: string | null
          sale_finalized_at?: string | null
          sale_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpesa_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales_void_status"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body: string
          channel: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          read_at: string | null
          recipient: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string
          channel: string
          created_at: string | null
          enabled: boolean | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          channel: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          channel?: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          branch_id: string | null
          created_at: string | null
          delivery_method: string
          event_type: string
          id: string
          is_active: boolean | null
          label: string
          recipient_role: string | null
          recipient_user_id: string | null
          threshold_value: number | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          delivery_method?: string
          event_type: string
          id?: string
          is_active?: boolean | null
          label: string
          recipient_role?: string | null
          recipient_user_id?: string | null
          threshold_value?: number | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          delivery_method?: string
          event_type?: string
          id?: string
          is_active?: boolean | null
          label?: string
          recipient_role?: string | null
          recipient_user_id?: string | null
          threshold_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_template: string
          category: string | null
          channels: string[] | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          push_template: string | null
          sms_template: string | null
          subject_template: string | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body_template: string
          category?: string | null
          channels?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          push_template?: string | null
          sms_template?: string | null
          subject_template?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body_template?: string
          category?: string | null
          channels?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          push_template?: string | null
          sms_template?: string | null
          subject_template?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string | null
          event_type: string | null
          id: string
          is_read: boolean | null
          read_at: string | null
          reference_id: string | null
          reference_type: string | null
          severity: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          severity?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          severity?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          provider: string
          sale_id: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          sale_id?: string | null
          status: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          sale_id?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_void_status"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_splits: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          method: string
          reference: string | null
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          method: string
          reference?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          method?: string
          reference?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_splits_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_splits_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_void_status"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          employee_count: number | null
          id: string
          name: string
          period_end: string
          period_start: string
          processed_by: string | null
          status: string | null
          total_deductions: number | null
          total_gross: number | null
          total_net: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_count?: number | null
          id?: string
          name: string
          period_end: string
          period_start: string
          processed_by?: string | null
          status?: string | null
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_count?: number | null
          id?: string
          name?: string
          period_end?: string
          period_start?: string
          processed_by?: string | null
          status?: string | null
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          allowances: number | null
          basic_salary: number
          bonus: number | null
          created_at: string | null
          employee_id: string
          gross_salary: number
          housing_levy: number | null
          id: string
          net_salary: number | null
          nhif: number | null
          nssf: number | null
          other_deductions: number | null
          overtime_pay: number | null
          paid_at: string | null
          paye: number | null
          payroll_run_id: string
          period_end: string
          period_start: string
          status: string | null
          total_deductions: number | null
          user_id: string | null
        }
        Insert: {
          allowances?: number | null
          basic_salary?: number
          bonus?: number | null
          created_at?: string | null
          employee_id: string
          gross_salary?: number
          housing_levy?: number | null
          id?: string
          net_salary?: number | null
          nhif?: number | null
          nssf?: number | null
          other_deductions?: number | null
          overtime_pay?: number | null
          paid_at?: string | null
          paye?: number | null
          payroll_run_id: string
          period_end: string
          period_start: string
          status?: string | null
          total_deductions?: number | null
          user_id?: string | null
        }
        Update: {
          allowances?: number | null
          basic_salary?: number
          bonus?: number | null
          created_at?: string | null
          employee_id?: string
          gross_salary?: number
          housing_levy?: number | null
          id?: string
          net_salary?: number | null
          nhif?: number | null
          nssf?: number | null
          other_deductions?: number | null
          overtime_pay?: number | null
          paid_at?: string | null
          paye?: number | null
          payroll_run_id?: string
          period_end?: string
          period_start?: string
          status?: string | null
          total_deductions?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_definitions: {
        Row: {
          category: string
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          label: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          label: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          label?: string
        }
        Relationships: []
      }
      plugin_configs: {
        Row: {
          created_at: string | null
          encrypted: boolean | null
          id: string
          key: string
          plugin_id: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted?: boolean | null
          id?: string
          key: string
          plugin_id: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted?: boolean | null
          id?: string
          key?: string
          plugin_id?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plugin_configs_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["plugin_id"]
          },
        ]
      }
      plugin_hooks: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          handler_name: string
          hook_key: string
          hook_type: string
          id: string
          plugin_id: string
          priority: number | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          handler_name: string
          hook_key: string
          hook_type: string
          id?: string
          plugin_id: string
          priority?: number | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          handler_name?: string
          hook_key?: string
          hook_type?: string
          id?: string
          plugin_id?: string
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plugin_hooks_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["plugin_id"]
          },
        ]
      }
      plugin_logs: {
        Row: {
          created_at: string | null
          id: string
          level: string | null
          message: string
          metadata: Json | null
          plugin_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          level?: string | null
          message: string
          metadata?: Json | null
          plugin_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: string | null
          message?: string
          metadata?: Json | null
          plugin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_logs_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["plugin_id"]
          },
        ]
      }
      plugins: {
        Row: {
          author: string | null
          config: Json | null
          description: string | null
          id: string
          installed_at: string | null
          name: string
          plugin_id: string
          status: string | null
          uninstalled_at: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          author?: string | null
          config?: Json | null
          description?: string | null
          id?: string
          installed_at?: string | null
          name: string
          plugin_id: string
          status?: string | null
          uninstalled_at?: string | null
          updated_at?: string | null
          version: string
        }
        Update: {
          author?: string | null
          config?: Json | null
          description?: string | null
          id?: string
          installed_at?: string | null
          name?: string
          plugin_id?: string
          status?: string | null
          uninstalled_at?: string | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      product_activity_log: {
        Row: {
          activity_type: string
          changes_json: Json | null
          created_at: string | null
          description: string
          id: string
          performed_by: string | null
          product_id: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          activity_type: string
          changes_json?: Json | null
          created_at?: string | null
          description: string
          id?: string
          performed_by?: string | null
          product_id: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          activity_type?: string
          changes_json?: Json | null
          created_at?: string | null
          description?: string
          id?: string
          performed_by?: string | null
          product_id?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_activity_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_activity_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_activity_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_activity_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          branch_id: string | null
          change_reason: string | null
          changed_by: string | null
          created_at: string | null
          effective_date: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          price: number
          price_type: string
          product_id: string
          source_batch_id: string | null
        }
        Insert: {
          branch_id?: string | null
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          price: number
          price_type: string
          product_id: string
          source_batch_id?: string | null
        }
        Update: {
          branch_id?: string | null
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          price?: number
          price_type?: string
          product_id?: string
          source_batch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_preferred: boolean | null
          last_supplied_date: string | null
          lead_time_days: number | null
          min_order_qty: number | null
          negotiated_price: number | null
          notes: string | null
          product_id: string
          quality_rating: number | null
          supplier_code: string | null
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_preferred?: boolean | null
          last_supplied_date?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          negotiated_price?: number | null
          notes?: string | null
          product_id: string
          quality_rating?: number | null
          supplier_code?: string | null
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_preferred?: boolean | null
          last_supplied_date?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          negotiated_price?: number | null
          notes?: string | null
          product_id?: string
          quality_rating?: number | null
          supplier_code?: string | null
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["preferred_supplier_id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_performance_view"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          avg_daily_sales: number | null
          avg_monthly_sales: number | null
          avg_weekly_sales: number | null
          brand: string | null
          category_id: string | null
          created_at: string | null
          currency: string | null
          department: string | null
          description: string | null
          dimensions: string | null
          id: string
          internal_code: string | null
          is_batch_tracked: boolean | null
          is_expirable: boolean | null
          is_serialized: boolean | null
          last_price_update: string | null
          last_purchase_date: string | null
          lead_time_days: number | null
          manufacturer: string | null
          max_discount_percent: number | null
          min_margin_percent: number | null
          name: string
          preferred_supplier_id: string | null
          promotion_price: number | null
          purchase_price: number
          qr_code: string | null
          reorder_level: number
          reserved_stock: number | null
          safety_stock: number | null
          search_aliases: string[] | null
          search_vector: unknown
          selling_price: number
          sku: string
          staff_price: number | null
          status: string | null
          subcategory: string | null
          tags: string[] | null
          tax_exclusive_price: number | null
          tax_inclusive_price: number | null
          updated_at: string | null
          vip_price: number | null
          weight: number | null
          weight_unit: string | null
          wholesale_price: number | null
        }
        Insert: {
          avg_daily_sales?: number | null
          avg_monthly_sales?: number | null
          avg_weekly_sales?: number | null
          brand?: string | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          department?: string | null
          description?: string | null
          dimensions?: string | null
          id?: string
          internal_code?: string | null
          is_batch_tracked?: boolean | null
          is_expirable?: boolean | null
          is_serialized?: boolean | null
          last_price_update?: string | null
          last_purchase_date?: string | null
          lead_time_days?: number | null
          manufacturer?: string | null
          max_discount_percent?: number | null
          min_margin_percent?: number | null
          name: string
          preferred_supplier_id?: string | null
          promotion_price?: number | null
          purchase_price?: number
          qr_code?: string | null
          reorder_level?: number
          reserved_stock?: number | null
          safety_stock?: number | null
          search_aliases?: string[] | null
          search_vector?: unknown
          selling_price?: number
          sku: string
          staff_price?: number | null
          status?: string | null
          subcategory?: string | null
          tags?: string[] | null
          tax_exclusive_price?: number | null
          tax_inclusive_price?: number | null
          updated_at?: string | null
          vip_price?: number | null
          weight?: number | null
          weight_unit?: string | null
          wholesale_price?: number | null
        }
        Update: {
          avg_daily_sales?: number | null
          avg_monthly_sales?: number | null
          avg_weekly_sales?: number | null
          brand?: string | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          department?: string | null
          description?: string | null
          dimensions?: string | null
          id?: string
          internal_code?: string | null
          is_batch_tracked?: boolean | null
          is_expirable?: boolean | null
          is_serialized?: boolean | null
          last_price_update?: string | null
          last_purchase_date?: string | null
          lead_time_days?: number | null
          manufacturer?: string | null
          max_discount_percent?: number | null
          min_margin_percent?: number | null
          name?: string
          preferred_supplier_id?: string | null
          promotion_price?: number | null
          purchase_price?: number
          qr_code?: string | null
          reorder_level?: number
          reserved_stock?: number | null
          safety_stock?: number | null
          search_aliases?: string[] | null
          search_vector?: unknown
          selling_price?: number
          sku?: string
          staff_price?: number | null
          status?: string | null
          subcategory?: string | null
          tags?: string[] | null
          tax_exclusive_price?: number | null
          tax_inclusive_price?: number | null
          updated_at?: string | null
          vip_price?: number | null
          weight?: number | null
          weight_unit?: string | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["preferred_supplier_id"]
          },
          {
            foreignKeyName: "products_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_performance_view"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "products_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_coupons: {
        Row: {
          code: string
          created_at: string | null
          current_usage: number | null
          id: string
          is_active: boolean | null
          promotion_id: string
          usage_limit: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          current_usage?: number | null
          id?: string
          is_active?: boolean | null
          promotion_id: string
          usage_limit?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          current_usage?: number | null
          id?: string
          is_active?: boolean | null
          promotion_id?: string
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_coupons_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_usage_log: {
        Row: {
          bonus_multiplier_applied: number | null
          coupon_id: string | null
          discount_cents: number
          id: string
          logged_at: string | null
          promotion_id: string
          sale_id: string
        }
        Insert: {
          bonus_multiplier_applied?: number | null
          coupon_id?: string | null
          discount_cents?: number
          id?: string
          logged_at?: string | null
          promotion_id: string
          sale_id: string
        }
        Update: {
          bonus_multiplier_applied?: number | null
          coupon_id?: string | null
          discount_cents?: number
          id?: string
          logged_at?: string | null
          promotion_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_usage_log_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "promotion_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usage_log_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usage_log_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usage_log_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_void_status"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          applicable_category_ids: string[] | null
          applicable_product_ids: string[] | null
          auto_apply: boolean | null
          bonus_multiplier: number | null
          created_at: string | null
          current_usage: number | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          max_discount_cents: number | null
          min_purchase_cents: number | null
          name: string
          requires_coupon: boolean | null
          scope: string
          stackable: boolean | null
          start_date: string | null
          type: string
          updated_at: string | null
          usage_limit: number | null
          value: number
        }
        Insert: {
          applicable_category_ids?: string[] | null
          applicable_product_ids?: string[] | null
          auto_apply?: boolean | null
          bonus_multiplier?: number | null
          created_at?: string | null
          current_usage?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_cents?: number | null
          min_purchase_cents?: number | null
          name: string
          requires_coupon?: boolean | null
          scope?: string
          stackable?: boolean | null
          start_date?: string | null
          type: string
          updated_at?: string | null
          usage_limit?: number | null
          value?: number
        }
        Update: {
          applicable_category_ids?: string[] | null
          applicable_product_ids?: string[] | null
          auto_apply?: boolean | null
          bonus_multiplier?: number | null
          created_at?: string | null
          current_usage?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_cents?: number | null
          min_purchase_cents?: number | null
          name?: string
          requires_coupon?: boolean | null
          scope?: string
          stackable?: boolean | null
          start_date?: string | null
          type?: string
          updated_at?: string | null
          usage_limit?: number | null
          value?: number
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          batch_number: string | null
          created_at: string | null
          discount_percent: number | null
          expiry_date: string | null
          id: string
          line_total: number
          notes: string | null
          product_id: string
          purchase_order_id: string
          quantity: number
          received_quantity: number
          tax_percent: number | null
          unit_price: number
          warehouse_id: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string | null
          discount_percent?: number | null
          expiry_date?: string | null
          id?: string
          line_total: number
          notes?: string | null
          product_id: string
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          tax_percent?: number | null
          unit_price: number
          warehouse_id?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string | null
          discount_percent?: number | null
          expiry_date?: string | null
          id?: string
          line_total?: number
          notes?: string | null
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          tax_percent?: number | null
          unit_price?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_cost: number | null
          actual_delivery_date: string | null
          approved_at: string | null
          approver_id: string | null
          branch_id: string
          buyer_id: string | null
          created_at: string | null
          currency: string | null
          discount_amount: number | null
          exchange_rate: number | null
          expected_delivery: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          ordered_at: string | null
          payment_date: string | null
          payment_due_date: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          po_number: string | null
          received_at: string | null
          rejection_reason: string | null
          shipping_cost: number | null
          shipping_method: string | null
          status: string
          submitted_at: string | null
          subtotal: number
          supplier_id: string
          tax_amount: number
          total_amount: number
          tracking_number: string | null
          updated_at: string | null
          urgency: string | null
          warehouse_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          actual_delivery_date?: string | null
          approved_at?: string | null
          approver_id?: string | null
          branch_id: string
          buyer_id?: string | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          exchange_rate?: number | null
          expected_delivery?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          payment_date?: string | null
          payment_due_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          po_number?: string | null
          received_at?: string | null
          rejection_reason?: string | null
          shipping_cost?: number | null
          shipping_method?: string | null
          status?: string
          submitted_at?: string | null
          subtotal?: number
          supplier_id: string
          tax_amount?: number
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string | null
          urgency?: string | null
          warehouse_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          actual_delivery_date?: string | null
          approved_at?: string | null
          approver_id?: string | null
          branch_id?: string
          buyer_id?: string | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          exchange_rate?: number | null
          expected_delivery?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          payment_date?: string | null
          payment_due_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          po_number?: string | null
          received_at?: string | null
          rejection_reason?: string | null
          shipping_cost?: number | null
          shipping_method?: string | null
          status?: string
          submitted_at?: string | null
          subtotal?: number
          supplier_id?: string
          tax_amount?: number
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string | null
          urgency?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["preferred_supplier_id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_performance_view"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipt_items: {
        Row: {
          condition_notes: string | null
          created_at: string | null
          id: string
          is_damaged: boolean | null
          lot_number: string | null
          manufacture_date: string | null
          product_id: string | null
          quality_checked: boolean | null
          quality_checked_at: string | null
          quality_checked_by: string | null
          quality_notes: string | null
          quantity: number
          quantity_accepted: number | null
          quantity_ordered: number | null
          quantity_rejected: number | null
          receipt_id: string
          rejection_reason: string | null
          unit_cost: number | null
          warehouse_location: string | null
        }
        Insert: {
          condition_notes?: string | null
          created_at?: string | null
          id?: string
          is_damaged?: boolean | null
          lot_number?: string | null
          manufacture_date?: string | null
          product_id?: string | null
          quality_checked?: boolean | null
          quality_checked_at?: string | null
          quality_checked_by?: string | null
          quality_notes?: string | null
          quantity?: number
          quantity_accepted?: number | null
          quantity_ordered?: number | null
          quantity_rejected?: number | null
          receipt_id: string
          rejection_reason?: string | null
          unit_cost?: number | null
          warehouse_location?: string | null
        }
        Update: {
          condition_notes?: string | null
          created_at?: string | null
          id?: string
          is_damaged?: boolean | null
          lot_number?: string | null
          manufacture_date?: string | null
          product_id?: string | null
          quality_checked?: boolean | null
          quality_checked_at?: string | null
          quality_checked_by?: string | null
          quality_notes?: string | null
          quantity?: number
          quantity_accepted?: number | null
          quantity_ordered?: number | null
          quantity_rejected?: number | null
          receipt_id?: string
          rejection_reason?: string | null
          unit_cost?: number | null
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_quality_checked_by_fkey"
            columns: ["quality_checked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          created_at: string | null
          documents: Json | null
          id: string
          notes: string | null
          purchase_order_id: string | null
          receipt_number: string | null
          received_date: string | null
          rejection_reason: string | null
          supplier_id: string | null
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string | null
          documents?: Json | null
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number?: string | null
          received_date?: string | null
          rejection_reason?: string | null
          supplier_id?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string | null
          documents?: Json | null
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number?: string | null
          received_date?: string | null
          rejection_reason?: string | null
          supplier_id?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["preferred_supplier_id"]
          },
          {
            foreignKeyName: "purchase_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_performance_view"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "purchase_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          amount_cents: number
          branch_id: string
          category_id: string
          created_at: string | null
          created_by: string
          description: string
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean | null
          last_generated_date: string | null
          next_date: string
          notes: string | null
          payment_method: string | null
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          amount_cents: number
          branch_id: string
          category_id: string
          created_at?: string | null
          created_by: string
          description: string
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_generated_date?: string | null
          next_date: string
          notes?: string | null
          payment_method?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          amount_cents?: number
          branch_id?: string
          category_id?: string
          created_at?: string | null
          created_by?: string
          description?: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_generated_date?: string | null
          next_date?: string
          notes?: string | null
          payment_method?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      registers: {
        Row: {
          app_version: string | null
          battery_level: number | null
          branch_id: string
          created_at: string | null
          current_cashier_id: string | null
          current_drawer_id: string | null
          customer_display_status: string | null
          health_score: number | null
          id: string
          last_login: string | null
          network_status: string | null
          printer_status: string | null
          register_name: string
          register_type: string | null
          scanner_status: string | null
          serial_number: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          app_version?: string | null
          battery_level?: number | null
          branch_id: string
          created_at?: string | null
          current_cashier_id?: string | null
          current_drawer_id?: string | null
          customer_display_status?: string | null
          health_score?: number | null
          id?: string
          last_login?: string | null
          network_status?: string | null
          printer_status?: string | null
          register_name: string
          register_type?: string | null
          scanner_status?: string | null
          serial_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          app_version?: string | null
          battery_level?: number | null
          branch_id?: string
          created_at?: string | null
          current_cashier_id?: string | null
          current_drawer_id?: string | null
          customer_display_status?: string | null
          health_score?: number | null
          id?: string
          last_login?: string | null
          network_status?: string | null
          printer_status?: string | null
          register_name?: string
          register_type?: string | null
          scanner_status?: string | null
          serial_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_registers_current_drawer"
            columns: ["current_drawer_id"]
            isOneToOne: false
            referencedRelation: "cash_drawers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registers_current_cashier_id_fkey"
            columns: ["current_cashier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_suggestions: {
        Row: {
          available_stock: number | null
          avg_daily_sales: number | null
          branch_id: string | null
          created_at: string | null
          current_stock: number
          estimated_cost: number | null
          id: string
          lead_time_days: number | null
          max_stock: number | null
          notes: string | null
          preferred_supplier_id: string | null
          priority: string
          product_id: string
          reorder_level: number | null
          reserved_stock: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          safety_stock: number | null
          status: string
          suggested_order_qty: number
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          available_stock?: number | null
          avg_daily_sales?: number | null
          branch_id?: string | null
          created_at?: string | null
          current_stock?: number
          estimated_cost?: number | null
          id?: string
          lead_time_days?: number | null
          max_stock?: number | null
          notes?: string | null
          preferred_supplier_id?: string | null
          priority?: string
          product_id: string
          reorder_level?: number | null
          reserved_stock?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_stock?: number | null
          status?: string
          suggested_order_qty?: number
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          available_stock?: number | null
          avg_daily_sales?: number | null
          branch_id?: string | null
          created_at?: string | null
          current_stock?: number
          estimated_cost?: number | null
          id?: string
          lead_time_days?: number | null
          max_stock?: number | null
          notes?: string | null
          preferred_supplier_id?: string | null
          priority?: string
          product_id?: string
          reorder_level?: number | null
          reserved_stock?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_stock?: number | null
          status?: string
          suggested_order_qty?: number
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reorder_suggestions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_suggestions_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["preferred_supplier_id"]
          },
          {
            foreignKeyName: "reorder_suggestions_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_performance_view"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "reorder_suggestions_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_suggestions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reorder_suggestions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_suggestions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reorder_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_suggestions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          product_id: string
          quantity_returned: number
          reason: string | null
          sale_id: string
          total_refund: number
          unit_refund_amount: number
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          product_id: string
          quantity_returned: number
          reason?: string | null
          sale_id: string
          total_refund?: number
          unit_refund_amount?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          product_id?: string
          quantity_returned?: number
          reason?: string | null
          sale_id?: string
          total_refund?: number
          unit_refund_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "return_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_void_status"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          grant_type: string | null
          id: string
          max_value: number | null
          permission_code: string
          requires_approval: boolean | null
          role: string
          time_restriction: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          grant_type?: string | null
          id?: string
          max_value?: number | null
          permission_code: string
          requires_approval?: boolean | null
          role: string
          time_restriction?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          grant_type?: string | null
          id?: string
          max_value?: number | null
          permission_code?: string
          requires_approval?: boolean | null
          role?: string
          time_restriction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permission_definitions"
            referencedColumns: ["code"]
          },
        ]
      }
      sale_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string
          reason: string | null
          sale_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by: string
          reason?: string | null
          sale_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string
          reason?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_audit_log_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_audit_log_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_void_status"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string | null
          discount_percent: number
          id: string
          line_total: number
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          discount_percent?: number
          id?: string
          line_total: number
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Update: {
          created_at?: string | null
          discount_percent?: number
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_void_status"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string
          cashier_id: string
          created_at: string | null
          currency: string | null
          customer_id: string | null
          discount_amount: number
          exchange_rate: number | null
          hold_notes: string | null
          id: string
          notes: string | null
          payment_method: string
          payment_status: string
          receipt_number: string
          return_reason: string | null
          returned_amount: number | null
          returned_at: string | null
          returned_by: string | null
          returned_qty: number | null
          sale_status: string | null
          shift_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          branch_id: string
          cashier_id: string
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number
          exchange_rate?: number | null
          hold_notes?: string | null
          id?: string
          notes?: string | null
          payment_method: string
          payment_status?: string
          receipt_number: string
          return_reason?: string | null
          returned_amount?: number | null
          returned_at?: string | null
          returned_by?: string | null
          returned_qty?: number | null
          sale_status?: string | null
          shift_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          branch_id?: string
          cashier_id?: string
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number
          exchange_rate?: number | null
          hold_notes?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          payment_status?: string
          receipt_number?: string
          return_reason?: string | null
          returned_amount?: number | null
          returned_at?: string | null
          returned_by?: string | null
          returned_qty?: number | null
          sale_status?: string | null
          shift_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          notes: string | null
          performed_by: string
          shift_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          notes?: string | null
          performed_by: string
          shift_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          notes?: string | null
          performed_by?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_audit_log_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_audit_log_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_ledgers: {
        Row: {
          action: string
          counted_cash: number
          created_at: string | null
          difference: number
          expected_cash: number
          id: string
          notes: string | null
          payment_breakdown: Json
          recorded_by: string
          shift_id: string
        }
        Insert: {
          action: string
          counted_cash: number
          created_at?: string | null
          difference: number
          expected_cash: number
          id?: string
          notes?: string | null
          payment_breakdown: Json
          recorded_by: string
          shift_id: string
        }
        Update: {
          action?: string
          counted_cash?: number
          created_at?: string | null
          difference?: number
          expected_cash?: number
          id?: string
          notes?: string | null
          payment_breakdown?: Json
          recorded_by?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_ledgers_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_ledgers_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_ledgers_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          branch_id: string | null
          break_duration: number | null
          created_at: string | null
          end_time: string
          id: string
          is_overnight: boolean | null
          name: string
          start_time: string
        }
        Insert: {
          branch_id?: string | null
          break_duration?: number | null
          created_at?: string | null
          end_time: string
          id?: string
          is_overnight?: boolean | null
          name: string
          start_time: string
        }
        Update: {
          branch_id?: string | null
          break_duration?: number | null
          created_at?: string | null
          end_time?: string
          id?: string
          is_overnight?: boolean | null
          name?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          branch_id: string
          cashier_id: string
          closed_at: string | null
          closing_notes: string | null
          created_at: string | null
          drawer_id: string | null
          id: string
          opened_at: string
          opening_float: number
          register_id: string | null
          reopened_at: string | null
          reopened_by: string | null
          shift_number: string
          status: string
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          cashier_id: string
          closed_at?: string | null
          closing_notes?: string | null
          created_at?: string | null
          drawer_id?: string | null
          id?: string
          opened_at?: string
          opening_float: number
          register_id?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          shift_number: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          cashier_id?: string
          closed_at?: string | null
          closing_notes?: string | null
          created_at?: string | null
          drawer_id?: string | null
          id?: string
          opened_at?: string
          opening_float?: number
          register_id?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          shift_number?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_drawer_id_fkey"
            columns: ["drawer_id"]
            isOneToOne: false
            referencedRelation: "cash_drawers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_items: {
        Row: {
          batch_number: string | null
          created_at: string | null
          expected_quantity: number
          expiry_date: string | null
          id: string
          is_blind: boolean | null
          location: string | null
          notes: string | null
          physical_quantity: number
          product_id: string
          recount_needed: boolean | null
          recount_quantity: number | null
          stock_count_id: string
          updated_at: string | null
          variance: number
          variance_pct: number | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string | null
          expected_quantity?: number
          expiry_date?: string | null
          id?: string
          is_blind?: boolean | null
          location?: string | null
          notes?: string | null
          physical_quantity?: number
          product_id: string
          recount_needed?: boolean | null
          recount_quantity?: number | null
          stock_count_id: string
          updated_at?: string | null
          variance?: number
          variance_pct?: number | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string | null
          expected_quantity?: number
          expiry_date?: string | null
          id?: string
          is_blind?: boolean | null
          location?: string | null
          notes?: string | null
          physical_quantity?: number
          product_id?: string
          recount_needed?: boolean | null
          recount_quantity?: number | null
          stock_count_id?: string
          updated_at?: string | null
          variance?: number
          variance_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_count_items_stock_count_id_fkey"
            columns: ["stock_count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          approval_threshold: number | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          count_date: string
          count_type: string | null
          created_at: string | null
          created_by: string
          frozen_at: string | null
          frozen_by: string | null
          id: string
          is_frozen: boolean | null
          net_variance: number | null
          notes: string | null
          recounted: boolean | null
          recounted_at: string | null
          requires_approval: boolean | null
          shrinkage_amount: number | null
          shrinkage_value: number | null
          status: string
          total_discrepancies: number | null
          total_items: number | null
          total_variance: number | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          approval_threshold?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          count_date?: string
          count_type?: string | null
          created_at?: string | null
          created_by: string
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          is_frozen?: boolean | null
          net_variance?: number | null
          notes?: string | null
          recounted?: boolean | null
          recounted_at?: string | null
          requires_approval?: boolean | null
          shrinkage_amount?: number | null
          shrinkage_value?: number | null
          status?: string
          total_discrepancies?: number | null
          total_items?: number | null
          total_variance?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          approval_threshold?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          count_date?: string
          count_type?: string | null
          created_at?: string | null
          created_by?: string
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          is_frozen?: boolean | null
          net_variance?: number | null
          notes?: string | null
          recounted?: boolean | null
          recounted_at?: string | null
          requires_approval?: boolean | null
          shrinkage_amount?: number | null
          shrinkage_value?: number | null
          status?: string
          total_discrepancies?: number | null
          total_items?: number | null
          total_variance?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_frozen_by_fkey"
            columns: ["frozen_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          reason_category: string | null
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          reason_category?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reason_category?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          batch_number: string | null
          created_at: string | null
          expiry_date: string | null
          id: string
          product_id: string
          quantity: number
          quantity_damaged: number | null
          quantity_dispatched: number | null
          quantity_received: number | null
          quantity_requested: number | null
          received_quantity: number
          stock_transfer_id: string
          unit_cost: number | null
          variance: number | null
          variance_notes: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          product_id: string
          quantity: number
          quantity_damaged?: number | null
          quantity_dispatched?: number | null
          quantity_received?: number | null
          quantity_requested?: number | null
          received_quantity?: number
          stock_transfer_id: string
          unit_cost?: number | null
          variance?: number | null
          variance_notes?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          product_id?: string
          quantity?: number
          quantity_damaged?: number | null
          quantity_dispatched?: number | null
          quantity_received?: number | null
          quantity_requested?: number | null
          received_quantity?: number
          stock_transfer_id?: string
          unit_cost?: number | null
          variance?: number | null
          variance_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reorder_engine_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_transfer_items_stock_transfer_id_fkey"
            columns: ["stock_transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          actual_arrival: string | null
          approved_by: string | null
          arrived_at: string | null
          created_at: string | null
          dispatched_at: string | null
          driver_name: string | null
          driver_phone: string | null
          expected_arrival: string | null
          from_branch_id: string
          from_warehouse_id: string | null
          id: string
          notes: string | null
          photos: string[] | null
          received_by: string | null
          requested_by: string | null
          signature: string | null
          status: string
          to_branch_id: string
          to_warehouse_id: string | null
          transfer_number: string | null
          updated_at: string | null
          variance_report: Json | null
          vehicle_number: string | null
        }
        Insert: {
          actual_arrival?: string | null
          approved_by?: string | null
          arrived_at?: string | null
          created_at?: string | null
          dispatched_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          expected_arrival?: string | null
          from_branch_id: string
          from_warehouse_id?: string | null
          id?: string
          notes?: string | null
          photos?: string[] | null
          received_by?: string | null
          requested_by?: string | null
          signature?: string | null
          status?: string
          to_branch_id: string
          to_warehouse_id?: string | null
          transfer_number?: string | null
          updated_at?: string | null
          variance_report?: Json | null
          vehicle_number?: string | null
        }
        Update: {
          actual_arrival?: string | null
          approved_by?: string | null
          arrived_at?: string | null
          created_at?: string | null
          dispatched_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          expected_arrival?: string | null
          from_branch_id?: string
          from_warehouse_id?: string | null
          id?: string
          notes?: string | null
          photos?: string[] | null
          received_by?: string | null
          requested_by?: string | null
          signature?: string | null
          status?: string
          to_branch_id?: string
          to_warehouse_id?: string | null
          transfer_number?: string | null
          updated_at?: string | null
          variance_report?: Json | null
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contacts: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["preferred_supplier_id"]
          },
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_performance_view"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_documents: {
        Row: {
          created_at: string | null
          document_name: string
          document_type: string
          expiry_date: string | null
          file_size: number | null
          file_url: string | null
          id: string
          mime_type: string | null
          notes: string | null
          supplier_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_name: string
          document_type: string
          expiry_date?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          supplier_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_name?: string
          document_type?: string
          expiry_date?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          supplier_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["preferred_supplier_id"]
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_performance_view"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_performance_snapshots: {
        Row: {
          accepted_items: number | null
          avg_delivery_days: number | null
          avg_order_value: number | null
          created_at: string | null
          id: string
          late_deliveries: number | null
          on_time_deliveries: number | null
          period_month: number
          period_year: number
          quality_score: number | null
          rejected_items: number | null
          reliability_score: number | null
          supplier_id: string
          total_orders: number | null
          total_value: number | null
        }
        Insert: {
          accepted_items?: number | null
          avg_delivery_days?: number | null
          avg_order_value?: number | null
          created_at?: string | null
          id?: string
          late_deliveries?: number | null
          on_time_deliveries?: number | null
          period_month: number
          period_year: number
          quality_score?: number | null
          rejected_items?: number | null
          reliability_score?: number | null
          supplier_id: string
          total_orders?: number | null
          total_value?: number | null
        }
        Update: {
          accepted_items?: number | null
          avg_delivery_days?: number | null
          avg_order_value?: number | null
          created_at?: string | null
          id?: string
          late_deliveries?: number | null
          on_time_deliveries?: number | null
          period_month?: number
          period_year?: number
          quality_score?: number | null
          rejected_items?: number | null
          reliability_score?: number | null
          supplier_id?: string
          total_orders?: number | null
          total_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_performance_snapshots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["preferred_supplier_id"]
          },
          {
            foreignKeyName: "supplier_performance_snapshots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_performance_view"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_performance_snapshots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          balance: number | null
          bank_account: string | null
          bank_code: string | null
          bank_name: string | null
          code: string | null
          company_name: string | null
          contact_person: string | null
          created_at: string | null
          credit_days: number | null
          credit_limit: number | null
          delivery_days: string | null
          email: string | null
          id: string
          late_delivery_pct: number | null
          lead_time: number | null
          name: string
          notes: string | null
          outstanding_orders: number | null
          payment_terms: string | null
          performance_score: number | null
          phone: string | null
          quality_score: number | null
          rating: number | null
          rejected_deliveries: number | null
          search_vector: unknown
          status: string | null
          tax_number: string | null
          total_orders: number | null
          total_purchase_amount: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          balance?: number | null
          bank_account?: string | null
          bank_code?: string | null
          bank_name?: string | null
          code?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          delivery_days?: string | null
          email?: string | null
          id?: string
          late_delivery_pct?: number | null
          lead_time?: number | null
          name: string
          notes?: string | null
          outstanding_orders?: number | null
          payment_terms?: string | null
          performance_score?: number | null
          phone?: string | null
          quality_score?: number | null
          rating?: number | null
          rejected_deliveries?: number | null
          search_vector?: unknown
          status?: string | null
          tax_number?: string | null
          total_orders?: number | null
          total_purchase_amount?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          balance?: number | null
          bank_account?: string | null
          bank_code?: string | null
          bank_name?: string | null
          code?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          delivery_days?: string | null
          email?: string | null
          id?: string
          late_delivery_pct?: number | null
          lead_time?: number | null
          name?: string
          notes?: string | null
          outstanding_orders?: number | null
          payment_terms?: string | null
          performance_score?: number | null
          phone?: string | null
          quality_score?: number | null
          rating?: number | null
          rejected_deliveries?: number | null
          search_vector?: unknown
          status?: string | null
          tax_number?: string | null
          total_orders?: number | null
          total_purchase_amount?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      system_audit_log: {
        Row: {
          action: string
          branch_id: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          branch_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          branch_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_audit_log_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_categories: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          department: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          department?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          department?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      task_checklist_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          description: string | null
          id: string
          is_completed: boolean | null
          is_required: boolean | null
          sort_order: number | null
          task_id: string
          template_id: string | null
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          is_required?: boolean | null
          sort_order?: number | null
          task_id: string
          template_id?: string | null
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          is_required?: boolean | null
          sort_order?: number | null
          task_id?: string
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          photo_url: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          photo_url?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          photo_url?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          applicable_roles: string[] | null
          category_id: string | null
          created_at: string | null
          description: string | null
          estimated_minutes: number | null
          id: string
          instructions: string | null
          is_active: boolean | null
          name: string
          priority: string | null
          recurrence: string | null
          recurrence_days: number[] | null
          requires_photo: boolean | null
          requires_signature: boolean | null
          updated_at: string | null
        }
        Insert: {
          applicable_roles?: string[] | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          name: string
          priority?: string | null
          recurrence?: string | null
          recurrence_days?: number[] | null
          requires_photo?: boolean | null
          requires_signature?: boolean | null
          updated_at?: string | null
        }
        Update: {
          applicable_roles?: string[] | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          name?: string
          priority?: string | null
          recurrence?: string | null
          recurrence_days?: number[] | null
          requires_photo?: boolean | null
          requires_signature?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      task_time_logs: {
        Row: {
          action: string
          created_at: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          task_id: string
          timestamp: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          task_id: string
          timestamp?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          task_id?: string
          timestamp?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_time_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_time_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_minutes: number | null
          area: string | null
          assigned_by: string | null
          assigned_to: string | null
          blocked_reason: string | null
          branch_id: string
          category_id: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          estimated_minutes: number | null
          id: string
          instructions: string | null
          location: string | null
          metadata: Json | null
          notes: string | null
          photo_url: string | null
          priority: string | null
          signature_url: string | null
          started_at: string | null
          status: string | null
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_minutes?: number | null
          area?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          blocked_reason?: string | null
          branch_id: string
          category_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          instructions?: string | null
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          photo_url?: string | null
          priority?: string | null
          signature_url?: string | null
          started_at?: string | null
          status?: string | null
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_minutes?: number | null
          area?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          blocked_reason?: string | null
          branch_id?: string
          category_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          instructions?: string | null
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          photo_url?: string | null
          priority?: string | null
          signature_url?: string | null
          started_at?: string | null
          status?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_group_items: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          rate_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          rate_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          rate_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "category_tax_view"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "tax_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tax_group_combined_view"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "tax_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tax_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_group_items_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          created_at: string | null
          description: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          percentage: number
          tax_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          percentage: number
          tax_type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          percentage?: number
          tax_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tenant_assets: {
        Row: {
          asset_type: string
          created_at: string | null
          file_name: string
          file_url: string
          height: number | null
          id: string
          is_active: boolean | null
          mime_type: string | null
          tenant_id: string
          width: number | null
        }
        Insert: {
          asset_type: string
          created_at?: string | null
          file_name: string
          file_url: string
          height?: number | null
          id?: string
          is_active?: boolean | null
          mime_type?: string | null
          tenant_id: string
          width?: number | null
        }
        Update: {
          asset_type?: string
          created_at?: string | null
          file_name?: string
          file_url?: string
          height?: number | null
          id?: string
          is_active?: boolean | null
          mime_type?: string | null
          tenant_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_configs"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_configs: {
        Row: {
          accent_color: string | null
          background_color: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          custom_css: string | null
          email_template_id: string | null
          favicon_url: string | null
          features: Json | null
          font_family: string | null
          footer_text: string | null
          id: string
          is_active: boolean | null
          limits: Json | null
          login_background_url: string | null
          logo_url: string | null
          name: string
          primary_color: string | null
          receipt_template: string | null
          secondary_color: string | null
          social_links: Json | null
          tenant_id: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          custom_css?: string | null
          email_template_id?: string | null
          favicon_url?: string | null
          features?: Json | null
          font_family?: string | null
          footer_text?: string | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          login_background_url?: string | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          receipt_template?: string | null
          secondary_color?: string | null
          social_links?: Json | null
          tenant_id: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          custom_css?: string | null
          email_template_id?: string | null
          favicon_url?: string | null
          features?: Json | null
          font_family?: string | null
          footer_text?: string | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          login_background_url?: string | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          receipt_template?: string | null
          secondary_color?: string | null
          social_links?: Json | null
          tenant_id?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      tenant_domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          is_primary: boolean | null
          ssl_status: string | null
          tenant_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          is_primary?: boolean | null
          ssl_status?: string | null
          tenant_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          is_primary?: boolean | null
          ssl_status?: string | null
          tenant_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_configs"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_themes: {
        Row: {
          accent_color: string
          background_color: string
          border_color: string
          card_background: string
          created_at: string | null
          description: string | null
          font_family: string | null
          id: string
          is_default: boolean | null
          name: string
          preview_url: string | null
          primary_color: string
          secondary_color: string
          text_color: string
        }
        Insert: {
          accent_color: string
          background_color: string
          border_color: string
          card_background: string
          created_at?: string | null
          description?: string | null
          font_family?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          preview_url?: string | null
          primary_color: string
          secondary_color: string
          text_color: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          border_color?: string
          card_background?: string
          created_at?: string | null
          description?: string | null
          font_family?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          preview_url?: string | null
          primary_color?: string
          secondary_color?: string
          text_color?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          branch_id: string | null
          created_at: string | null
          expires_at: string | null
          grant_type: string | null
          granted_by: string | null
          id: string
          max_value: number | null
          permission_code: string
          requires_approval: boolean | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          grant_type?: string | null
          granted_by?: string | null
          id?: string
          max_value?: number | null
          permission_code: string
          requires_approval?: boolean | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          grant_type?: string | null
          granted_by?: string | null
          id?: string
          max_value?: number | null
          permission_code?: string
          requires_approval?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permission_definitions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          branch_id: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          role: string
          status: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          role: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          access_permissions: string[] | null
          address: string | null
          branch_id: string | null
          capacity: number | null
          capacity_unit: string | null
          code: string
          created_at: string | null
          current_utilization: number | null
          dispatch_performance: number | null
          id: string
          is_secure: boolean | null
          is_temperature_controlled: boolean | null
          location: string | null
          manager_id: string | null
          name: string
          phone: string | null
          receiving_performance: number | null
          sort_order: number | null
          status: string
          stock_accuracy: number | null
          temperature_max: number | null
          temperature_min: number | null
          temperature_notes: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          access_permissions?: string[] | null
          address?: string | null
          branch_id?: string | null
          capacity?: number | null
          capacity_unit?: string | null
          code: string
          created_at?: string | null
          current_utilization?: number | null
          dispatch_performance?: number | null
          id?: string
          is_secure?: boolean | null
          is_temperature_controlled?: boolean | null
          location?: string | null
          manager_id?: string | null
          name: string
          phone?: string | null
          receiving_performance?: number | null
          sort_order?: number | null
          status?: string
          stock_accuracy?: number | null
          temperature_max?: number | null
          temperature_min?: number | null
          temperature_notes?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          access_permissions?: string[] | null
          address?: string | null
          branch_id?: string | null
          capacity?: number | null
          capacity_unit?: string | null
          code?: string
          created_at?: string | null
          current_utilization?: number | null
          dispatch_performance?: number | null
          id?: string
          is_secure?: boolean | null
          is_temperature_controlled?: boolean | null
          location?: string | null
          manager_id?: string | null
          name?: string
          phone?: string | null
          receiving_performance?: number | null
          sort_order?: number | null
          status?: string
          stock_accuracy?: number | null
          temperature_max?: number | null
          temperature_min?: number | null
          temperature_notes?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt: number | null
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          endpoint_id: string
          error_message: string | null
          event: string
          id: string
          max_attempts: number | null
          payload: Json
          request_body: string | null
          request_headers: Json | null
          request_url: string | null
          response_body: string | null
          response_headers: Json | null
          response_status: number | null
          status: string | null
        }
        Insert: {
          attempt?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          endpoint_id: string
          error_message?: string | null
          event: string
          id?: string
          max_attempts?: number | null
          payload: Json
          request_body?: string | null
          request_headers?: Json | null
          request_url?: string | null
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
          status?: string | null
        }
        Update: {
          attempt?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          endpoint_id?: string
          error_message?: string | null
          event?: string
          id?: string
          max_attempts?: number | null
          payload?: Json
          request_body?: string | null
          request_headers?: Json | null
          request_url?: string | null
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string | null
          description: string | null
          error_message: string | null
          events: string[]
          headers: Json | null
          id: string
          last_triggered_at: string | null
          name: string
          retry_count: number | null
          secret: string | null
          status: string | null
          timeout_ms: number | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          events: string[]
          headers?: Json | null
          id?: string
          last_triggered_at?: string | null
          name: string
          retry_count?: number | null
          secret?: string | null
          status?: string | null
          timeout_ms?: number | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          events?: string[]
          headers?: Json | null
          id?: string
          last_triggered_at?: string | null
          name?: string
          retry_count?: number | null
          secret?: string | null
          status?: string | null
          timeout_ms?: number | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      worker_assignments: {
        Row: {
          branch_id: string
          created_at: string | null
          employee_id: string
          end_date: string | null
          id: string
          is_primary: boolean | null
          notes: string | null
          role_id: string
          start_date: string
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          role_id: string
          start_date?: string
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          role_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "worker_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_attendance: {
        Row: {
          branch_id: string
          break_end: string | null
          break_start: string | null
          clock_in: string
          clock_out: string | null
          created_at: string | null
          employee_id: string
          id: string
          notes: string | null
          status: string | null
          total_break_minutes: number | null
        }
        Insert: {
          branch_id: string
          break_end?: string | null
          break_start?: string | null
          clock_in: string
          clock_out?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          status?: string | null
          total_break_minutes?: number | null
        }
        Update: {
          branch_id?: string
          break_end?: string | null
          break_start?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          status?: string | null
          total_break_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_performance: {
        Row: {
          attendance_score: number | null
          avg_completion_minutes: number | null
          branch_id: string
          created_at: string | null
          efficiency_score: number | null
          employee_id: string
          id: string
          metric_date: string
          quality_score: number | null
          tasks_assigned: number | null
          tasks_completed: number | null
          tasks_late: number | null
          tasks_on_time: number | null
          total_break_minutes: number | null
          total_work_minutes: number | null
        }
        Insert: {
          attendance_score?: number | null
          avg_completion_minutes?: number | null
          branch_id: string
          created_at?: string | null
          efficiency_score?: number | null
          employee_id: string
          id?: string
          metric_date: string
          quality_score?: number | null
          tasks_assigned?: number | null
          tasks_completed?: number | null
          tasks_late?: number | null
          tasks_on_time?: number | null
          total_break_minutes?: number | null
          total_work_minutes?: number | null
        }
        Update: {
          attendance_score?: number | null
          avg_completion_minutes?: number | null
          branch_id?: string
          created_at?: string | null
          efficiency_score?: number | null
          employee_id?: string
          id?: string
          metric_date?: string
          quality_score?: number | null
          tasks_assigned?: number | null
          tasks_completed?: number | null
          tasks_late?: number | null
          tasks_on_time?: number | null
          total_break_minutes?: number | null
          total_work_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_performance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_roles: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          department: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          department?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          department?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      worker_shifts: {
        Row: {
          area: string | null
          branch_id: string
          created_at: string | null
          employee_id: string
          end_time: string
          id: string
          notes: string | null
          role_id: string | null
          shift_date: string
          start_time: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          branch_id: string
          created_at?: string | null
          employee_id: string
          end_time: string
          id?: string
          notes?: string | null
          role_id?: string | null
          shift_date: string
          start_time: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          branch_id?: string
          created_at?: string | null
          employee_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          role_id?: string | null
          shift_date?: string
          start_time?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_shifts_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "worker_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      category_tax_view: {
        Row: {
          category_id: string | null
          category_name: string | null
          group_id: string | null
          group_name: string | null
          is_tax_inclusive: boolean | null
          tax_rates: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "category_tax_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_summary: {
        Row: {
          credit_balance: number | null
          credit_limit: number | null
          credit_status: string | null
          credit_usage_pct: number | null
          customer_id: string | null
          customer_name: string | null
          last_credit_sale_date: string | null
          last_payment_date: string | null
          phone: string | null
          total_credit_sales: number | null
          total_payments: number | null
        }
        Relationships: []
      }
      daily_reconciliation_summary: {
        Row: {
          branch_id: string | null
          closed_shifts: number | null
          day: string | null
          open_shifts: number | null
          total_bank_transfer_sales: number | null
          total_card_sales: number | null
          total_cash_sales: number | null
          total_cheque_sales: number | null
          total_credit_sales: number | null
          total_difference: number | null
          total_mpesa_sales: number | null
          total_opening_float: number | null
          total_over: number | null
          total_shifts: number | null
          total_short: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_summary_view: {
        Row: {
          avg_cents: number | null
          branch_id: string | null
          category_color: string | null
          category_icon: string | null
          category_id: string | null
          category_name: string | null
          expense_count: number | null
          first_date: string | null
          last_date: string | null
          status: string | null
          total_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_analytics: {
        Row: {
          available_stock: number | null
          avg_monthly_sales: number | null
          avg_weekly_sales: number | null
          branch_count: number | null
          brand: string | null
          category_id: string | null
          category_name: string | null
          department: string | null
          lead_time_days: number | null
          margin_cents: number | null
          margin_pct: number | null
          name: string | null
          preferred_supplier_id: string | null
          preferred_supplier_name: string | null
          product_id: string | null
          purchase_price: number | null
          reorder_level: number | null
          safety_stock: number | null
          selling_price: number | null
          sku: string | null
          status: string | null
          stock_status: string | null
          stock_value_cents: number | null
          total_reserved: number | null
          total_stock: number | null
          wholesale_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_summary: {
        Row: {
          balance_due_cents: number | null
          branch_id: string | null
          branch_name: string | null
          branch_name_alias: string | null
          created_at: string | null
          created_by_name: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          display_status: string | null
          due_date: string | null
          id: string | null
          invoice_number: string | null
          issued_date: string | null
          item_count: number | null
          notes: string | null
          paid_amount_cents: number | null
          paid_date: string | null
          status: string | null
          total_amount_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_engine_view: {
        Row: {
          available_stock: number | null
          avg_daily_sales: number | null
          avg_monthly_sales: number | null
          avg_weekly_sales: number | null
          brand: string | null
          category_id: string | null
          category_name: string | null
          current_stock: number | null
          days_until_stockout: number | null
          lead_time_days: number | null
          name: string | null
          preferred_supplier_id: string | null
          preferred_supplier_name: string | null
          priority: string | null
          product_id: string | null
          purchase_price: number | null
          reorder_level: number | null
          reserved_stock: number | null
          safety_stock: number | null
          sku: string | null
          suggested_order_qty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_analytics"
            referencedColumns: ["preferred_supplier_id"]
          },
          {
            foreignKeyName: "products_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_performance_view"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "products_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_void_status: {
        Row: {
          created_at: string | null
          id: string | null
          modification_at: string | null
          payment_method: string | null
          receipt_number: string | null
          return_reason: string | null
          returned_at: string | null
          returned_by_name: string | null
          returned_qty: number | null
          sale_status: string | null
          total_amount: number | null
          void_reason: string | null
          voided_at: string | null
          voided_by_name: string | null
        }
        Relationships: []
      }
      shift_summaries: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          card_sales: number | null
          cash_sales: number | null
          cashier_id: string | null
          cashier_name: string | null
          closed_at: string | null
          closing_counted_cash: number | null
          closing_difference: number | null
          closing_expected_cash: number | null
          id: string | null
          mpesa_sales: number | null
          opened_at: string | null
          opening_float: number | null
          other_sales: number | null
          shift_number: string | null
          status: string | null
          total_sales: number | null
          transaction_count: number | null
          voided_amount: number | null
          voided_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_performance_view: {
        Row: {
          active_products: number | null
          code: string | null
          credit_days: number | null
          credit_limit: number | null
          last_activity: string | null
          late_delivery_pct: number | null
          name: string | null
          outstanding_orders: number | null
          performance_score: number | null
          product_count: number | null
          quality_score: number | null
          rating: number | null
          rejected_deliveries: number | null
          status: string | null
          supplier_id: string | null
          total_orders: number | null
          total_purchase_amount: number | null
        }
        Relationships: []
      }
      tax_group_combined_view: {
        Row: {
          combined_percentage: number | null
          description: string | null
          group_id: string | null
          group_name: string | null
          is_active: boolean | null
          rate_count: number | null
          rates: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      convert_currency: {
        Args: { amount: number; from_curr: string; to_curr: string }
        Returns: number
      }
      emit_automation_event: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_event_type: string
          p_payload?: Json
          p_source?: string
        }
        Returns: string
      }
      exec_sql: { Args: { query: string }; Returns: undefined }
      generate_invoice_number: {
        Args: { p_branch_id: string }
        Returns: string
      }
      get_exchange_rate: {
        Args: { from_curr: string; to_curr: string }
        Returns: number
      }
      get_monthly_expenses: {
        Args: { p_branch_id: string; p_months?: number }
        Returns: {
          expense_count: number
          month: number
          month_name: string
          total_cents: number
          year: number
        }[]
      }
      get_opening_stock: {
        Args: { p_snapshot_date: string }
        Returns: {
          branch_id: string
          product_id: string
          quantity: number
        }[]
      }
      process_automation_event: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_event_type: string
          p_payload?: Json
          p_source?: string
        }
        Returns: string
      }
      receive_stock_transfer: {
        Args: {
          p_items: Json
          p_received_at?: string
          p_received_by: string
          p_transfer_id: string
        }
        Returns: Json
      }
      save_cash_sale_transaction: {
        Args: {
          p_branch_id: string
          p_cashier_id: string
          p_customer_id: string
          p_discount_amount: number
          p_items: Json
          p_notes: string
          p_payment_method: string
          p_payment_status: string
          p_receipt_number: string
          p_sale_id: string
          p_subtotal: number
          p_total_amount: number
          p_written_at: string
        }
        Returns: Json
      }
      search_all: {
        Args: {
          p_entity_types?: string[]
          p_result_limit?: number
          p_search_query: string
        }
        Returns: {
          entity_id: string
          entity_type: string
          metadata: Json
          rank: number
          subtitle: string
          title: string
        }[]
      }
      snapshot_inventory: { Args: never; Returns: number }
      update_customer_credit_balance: {
        Args: { p_amount_cents: number; p_customer_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_subtype:
        | "current_asset"
        | "fixed_asset"
        | "bank"
        | "cash"
        | "accounts_receivable"
        | "inventory_asset"
        | "current_liability"
        | "long_term_liability"
        | "accounts_payable"
        | "tax_liability"
        | "owner_equity"
        | "retained_earnings"
        | "sales_revenue"
        | "other_revenue"
        | "interest_income"
        | "operating_expense"
        | "payroll_expense"
        | "marketing_expense"
        | "utilities_expense"
        | "rent_expense"
        | "insurance_expense"
        | "depreciation_expense"
        | "interest_expense"
        | "cost_of_goods_sold"
      account_type:
        | "asset"
        | "liability"
        | "equity"
        | "revenue"
        | "expense"
        | "cogs"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_subtype: [
        "current_asset",
        "fixed_asset",
        "bank",
        "cash",
        "accounts_receivable",
        "inventory_asset",
        "current_liability",
        "long_term_liability",
        "accounts_payable",
        "tax_liability",
        "owner_equity",
        "retained_earnings",
        "sales_revenue",
        "other_revenue",
        "interest_income",
        "operating_expense",
        "payroll_expense",
        "marketing_expense",
        "utilities_expense",
        "rent_expense",
        "insurance_expense",
        "depreciation_expense",
        "interest_expense",
        "cost_of_goods_sold",
      ],
      account_type: [
        "asset",
        "liability",
        "equity",
        "revenue",
        "expense",
        "cogs",
      ],
    },
  },
} as const

// ── Convenience type aliases ────────────────────────────────────
export type Shift = Database['public']['Tables']['shifts']['Row']
export type Register = Database['public']['Tables']['registers']['Row']
export type CashDrawer = Database['public']['Tables']['cash_drawers']['Row']
export type CashEvent = Database['public']['Tables']['cash_events']['Row']
