export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          code: string
          name: string
          account_type: string
          parent_id: string | null
          branch_id: string | null
          is_active: boolean
          description: string | null
          opening_balance: number
          current_balance: number
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['accounts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string
          action: string
          resource_type: string | null
          resource_id: string | null
          old_value: Record<string, unknown> | null
          new_value: Record<string, unknown> | null
          branch_id: string | null
          details: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
      }
      automation_rules: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean | null
          priority: number | null
          cooldown_ms: number | null
          max_daily: number | null
          trigger_event: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['automation_rules']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['automation_rules']['Insert']>
      }
      automation_events: {
        Row: {
          id: string
          event_type: string
          source: string | null
          entity_type: string | null
          entity_id: string | null
          payload: Record<string, unknown> | null
          processed: boolean | null
          processed_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['automation_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['automation_events']['Insert']>
      }
      automation_logs: {
        Row: {
          id: string
          rule_id: string | null
          event_id: string | null
          action_type: string
          status: string
          error_msg: string | null
          duration_ms: number | null
          input: Record<string, unknown> | null
          output: Record<string, unknown> | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['automation_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['automation_logs']['Insert']>
      }
      bank_accounts: {
        Row: {
          id: string
          account_id: string
          bank_name: string
          account_name: string
          account_number: string | null
          account_type: string | null
          current_balance: number | null
          opening_balance: number | null
          currency: string | null
          branch_id: string | null
          is_active: boolean | null
          last_reconciled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['bank_accounts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['bank_accounts']['Insert']>
      }
      bank_reconciliations: {
        Row: {
          id: string
          bank_account_id: string
          reconciliation_date: string
          bank_balance: number
          book_balance: number
          difference: number
          status: string | null
          notes: string | null
          created_by: string | null
          completed_by: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['bank_reconciliations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['bank_reconciliations']['Insert']>
      }
      bank_transactions: {
        Row: {
          id: string
          bank_account_id: string
          transaction_date: string
          description: string
          transaction_type: string
          amount: number
          balance_after: number | null
          reference_number: string | null
          is_reconciled: boolean | null
          reconciled_at: string | null
          journal_entry_id: string | null
          branch_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['bank_transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['bank_transactions']['Insert']>
      }
      branches: {
        Row: {
          id: string
          name: string
          code: string
          location: string | null
          is_main: boolean | null
          created_at: string
          phone: string | null
          email: string | null
          latitude: number | null
          longitude: number | null
          open_time: string | null
          close_time: string | null
          tax_id: string | null
          tax_rate: number | null
          manager_id: string | null
          timezone: string | null
          type: string | null
          status: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['branches']['Insert']>
      }
      cash_drawers: {
        Row: {
          id: string
          drawer_name: string
          register_id: string | null
          branch_id: string
          status: string | null
          current_balance: number | null
          expected_balance: number | null
          last_variance: number | null
          last_counted_at: string | null
          last_counted_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['cash_drawers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['cash_drawers']['Insert']>
      }
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          icon: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          type: string
          loyalty_points: number | null
          credit_limit: number | null
          credit_balance: number | null
          created_at: string
          updated_at: string
          tier: string | null
          birthday: string | null
          total_lifetime_spend_cents: number | null
          total_visits: number | null
          last_purchase_date: string | null
          notes: string | null
          tags: string[] | null
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      employee_profiles: {
        Row: {
          id: string
          user_id: string
          employee_id: string | null
          staff_number: string | null
          national_id: string | null
          kra_pin: string | null
          nhif_number: string | null
          nssf_number: string | null
          department_id: string | null
          position: string | null
          hire_date: string | null
          employment_type: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          photo_url: string | null
          digital_signature_url: string | null
          employment_status: string | null
          created_at: string
          updated_at: string
          basic_salary: number | null
          allowances: number | null
        }
        Insert: Omit<Database['public']['Tables']['employee_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['employee_profiles']['Insert']>
      }
      expense_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          color: string | null
          icon: string | null
          sort_order: number | null
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['expense_categories']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['expense_categories']['Insert']>
      }
      expenses: {
        Row: {
          id: string
          branch_id: string
          category_id: string
          amount_cents: number
          description: string
          vendor: string | null
          expense_date: string
          payment_method: string | null
          reference_number: string | null
          receipt_url: string | null
          notes: string | null
          status: string
          approved_by: string | null
          approved_at: string | null
          rejection_reason: string | null
          created_by: string
          is_recurring: boolean | null
          recurring_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
      financial_periods: {
        Row: {
          id: string
          name: string
          period_type: string
          start_date: string
          end_date: string
          status: string | null
          branch_id: string | null
          closed_by: string | null
          closed_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['financial_periods']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['financial_periods']['Insert']>
      }
      inventory: {
        Row: {
          id: string
          product_id: string
          branch_id: string
          quantity: number
          last_counted_at: string | null
          created_at: string
          updated_at: string
          reserved_stock: number | null
        }
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price_cents: number
          total_cents: number
          tax_percent: number | null
          tax_cents: number | null
          sort_order: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoice_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['invoice_items']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          customer_id: string
          branch_id: string
          sale_id: string | null
          total_amount_cents: number
          paid_amount_cents: number
          status: string
          due_date: string
          issued_date: string
          paid_date: string | null
          notes: string | null
          terms: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }
      journal_entries: {
        Row: {
          id: string
          entry_number: string
          entry_date: string
          description: string
          reference_type: string | null
          reference_id: string | null
          period_id: string | null
          branch_id: string | null
          status: string | null
          is_adjusting: boolean | null
          total_debit: number | null
          total_credit: number | null
          posted_by: string | null
          posted_at: string | null
          voided_by: string | null
          voided_at: string | null
          void_reason: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['journal_entries']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['journal_entries']['Insert']>
      }
      journal_entry_lines: {
        Row: {
          id: string
          journal_entry_id: string
          account_id: string
          debit: number | null
          credit: number | null
          description: string | null
          line_number: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['journal_entry_lines']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['journal_entry_lines']['Insert']>
      }
      loyalty_transactions: {
        Row: {
          id: string
          customer_id: string
          type: string
          sale_id: string | null
          points_delta: number
          balance_before: number
          balance_after: number
          reason: string | null
          branch_id: string
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['loyalty_transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['loyalty_transactions']['Insert']>
      }
      mpesa_transactions: {
        Row: {
          id: string
          sale_id: string
          merchant_request_id: string
          checkout_request_id: string
          phone_number: string
          amount: number
          status: string
          mpesa_receipt_number: string | null
          callback_payload: Record<string, unknown> | null
          result_code: number | null
          result_description: string | null
          error_message: string | null
          initiated_at: string
          callback_received_at: string | null
          sale_finalized_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['mpesa_transactions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['mpesa_transactions']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string | null
          event_type: string | null
          reference_type: string | null
          reference_id: string | null
          severity: string | null
          is_read: boolean | null
          read_at: string | null
          action_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      payment_splits: {
        Row: {
          id: string
          sale_id: string
          method: string
          amount: number
          reference: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['payment_splits']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payment_splits']['Insert']>
      }
      payroll_runs: {
        Row: {
          id: string
          name: string
          period_start: string
          period_end: string
          status: string | null
          total_gross: number | null
          total_deductions: number | null
          total_net: number | null
          employee_count: number | null
          processed_by: string | null
          created_by: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['payroll_runs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payroll_runs']['Insert']>
      }
      payslips: {
        Row: {
          id: string
          payroll_run_id: string
          employee_id: string
          user_id: string | null
          period_start: string
          period_end: string
          basic_salary: number
          allowances: number | null
          overtime_pay: number | null
          bonus: number | null
          gross_salary: number
          paye: number | null
          nhif: number | null
          nssf: number | null
          housing_levy: number | null
          other_deductions: number | null
          total_deductions: number | null
          net_salary: number | null
          status: string | null
          created_at: string
          paid_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['payslips']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payslips']['Insert']>
      }
      products: {
        Row: {
          id: string
          sku: string
          name: string
          description: string | null
          category_id: string | null
          purchase_price: number
          selling_price: number
          reorder_level: number
          created_at: string
          updated_at: string
          brand: string | null
          status: string | null
          internal_code: string | null
          manufacturer: string | null
          department: string | null
          subcategory: string | null
          tags: string[] | null
          search_aliases: string[] | null
          qr_code: string | null
          wholesale_price: number | null
          promotion_price: number | null
          staff_price: number | null
          vip_price: number | null
          tax_inclusive_price: number | null
          tax_exclusive_price: number | null
          min_margin_percent: number | null
          max_discount_percent: number | null
          reserved_stock: number | null
          safety_stock: number | null
          lead_time_days: number | null
          preferred_supplier_id: string | null
          weight: number | null
          weight_unit: string | null
          dimensions: string | null
          is_serialized: boolean | null
          is_batch_tracked: boolean | null
          is_expirable: boolean | null
          last_purchase_date: string | null
          last_price_update: string | null
          avg_monthly_sales: number | null
          avg_weekly_sales: number | null
          avg_daily_sales: number | null
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      promotions: {
        Row: {
          id: string
          name: string
          description: string | null
          type: string
          value: number
          scope: string
          applicable_product_ids: string[] | null
          applicable_category_ids: string[] | null
          min_purchase_cents: number | null
          max_discount_cents: number | null
          start_date: string | null
          end_date: string | null
          is_active: boolean | null
          auto_apply: boolean | null
          stackable: boolean | null
          requires_coupon: boolean | null
          bonus_multiplier: number | null
          usage_limit: number | null
          current_usage: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['promotions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['promotions']['Insert']>
      }
      purchase_orders: {
        Row: {
          id: string
          supplier_id: string
          branch_id: string
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          expected_delivery: string | null
          notes: string | null
          created_at: string
          updated_at: string
          po_number: string | null
          warehouse_id: string | null
          buyer_id: string | null
          approver_id: string | null
          submitted_at: string | null
          approved_at: string | null
          ordered_at: string | null
          received_at: string | null
          expected_delivery_date: string | null
          actual_delivery_date: string | null
          actual_cost: number | null
          shipping_cost: number | null
          discount_amount: number | null
          payment_status: string | null
          payment_due_date: string | null
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          urgency: string | null
          shipping_method: string | null
          tracking_number: string | null
          rejection_reason: string | null
        }
        Insert: Omit<Database['public']['Tables']['purchase_orders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>
      }
      purchase_order_items: {
        Row: {
          id: string
          purchase_order_id: string
          product_id: string
          quantity: number
          unit_price: number
          line_total: number
          received_quantity: number
          created_at: string
          batch_number: string | null
          expiry_date: string | null
          discount_percent: number | null
          tax_percent: number | null
          notes: string | null
          warehouse_id: string | null
        }
        Insert: Omit<Database['public']['Tables']['purchase_order_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['purchase_order_items']['Insert']>
      }
      recurring_expenses: {
        Row: {
          id: string
          branch_id: string
          category_id: string
          amount_cents: number
          description: string
          vendor: string | null
          frequency: string
          next_date: string
          end_date: string | null
          payment_method: string | null
          notes: string | null
          is_active: boolean | null
          last_generated_date: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['recurring_expenses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['recurring_expenses']['Insert']>
      }
      return_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          quantity_returned: number
          unit_refund_amount: number
          total_refund: number
          reason: string | null
          created_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['return_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['return_items']['Insert']>
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          quantity: number
          unit_price: number
          discount_percent: number
          line_total: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['sale_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['sale_items']['Insert']>
      }
      sales: {
        Row: {
          id: string
          branch_id: string
          cashier_id: string
          customer_id: string | null
          subtotal: number
          discount_amount: number
          tax_amount: number
          total_amount: number
          payment_method: string
          payment_status: string
          receipt_number: string
          notes: string | null
          sale_status: string | null
          shift_id: string | null
          voided_at: string | null
          void_reason: string | null
          voided_by: string | null
          returned_at: string | null
          returned_qty: number | null
          return_reason: string | null
          returned_by: string | null
          created_at: string
          updated_at: string
          hold_notes: string | null
          returned_amount: number | null
        }
        Insert: Omit<Database['public']['Tables']['sales']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['sales']['Insert']>
      }
      shifts: {
        Row: {
          id: string
          branch_id: string
          cashier_id: string
          shift_number: string
          opened_at: string
          closed_at: string | null
          status: string
          opening_float: number
          closing_notes: string | null
          reopened_by: string | null
          reopened_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['shifts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['shifts']['Insert']>
      }
      stock_movements: {
        Row: {
          id: string
          product_id: string
          branch_id: string
          type: string
          quantity: number
          reference_id: string | null
          notes: string | null
          created_at: string
          reason_category: string | null
          approved_by: string | null
          approved_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['stock_movements']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['stock_movements']['Insert']>
      }
      stock_transfer_items: {
        Row: {
          id: string
          stock_transfer_id: string
          product_id: string
          quantity: number
          received_quantity: number
          created_at: string
          quantity_requested: number | null
          quantity_dispatched: number | null
          quantity_received: number | null
          quantity_damaged: number | null
          variance: number | null
          variance_notes: string | null
          batch_number: string | null
          expiry_date: string | null
          unit_cost: number | null
        }
        Insert: Omit<Database['public']['Tables']['stock_transfer_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['stock_transfer_items']['Insert']>
      }
      stock_transfers: {
        Row: {
          id: string
          from_branch_id: string
          to_branch_id: string
          status: string
          created_at: string
          updated_at: string
          transfer_number: string | null
          from_warehouse_id: string | null
          to_warehouse_id: string | null
          requested_by: string | null
          approved_by: string | null
          driver_name: string | null
          driver_phone: string | null
          vehicle_number: string | null
          expected_arrival: string | null
          actual_arrival: string | null
          dispatched_at: string | null
          arrived_at: string | null
          received_by: string | null
          signature: string | null
          photos: string[] | null
          variance_report: Record<string, unknown> | null
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['stock_transfers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['stock_transfers']['Insert']>
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_person: string | null
          phone: string | null
          email: string | null
          payment_terms: string | null
          balance: number | null
          created_at: string
          updated_at: string
          code: string | null
          company_name: string | null
          address: string | null
          tax_number: string | null
          bank_name: string | null
          bank_account: string | null
          bank_code: string | null
          credit_limit: number | null
          credit_days: number | null
          delivery_days: string | null
          lead_time: number | null
          rating: number | null
          performance_score: number | null
          quality_score: number | null
          late_delivery_pct: number | null
          rejected_deliveries: number | null
          total_purchase_amount: number | null
          total_orders: number | null
          outstanding_orders: number | null
          status: string | null
          website: string | null
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          branch_id: string | null
          role: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      warehouses: {
        Row: {
          id: string
          name: string
          code: string | null
          branch_id: string | null
          address: string | null
          capacity: number | null
          manager_id: string | null
          is_active: boolean | null
          type: string | null
          temperature_zone: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['warehouses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['warehouses']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type Account = Database['public']['Tables']['accounts']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type AutomationRule = Database['public']['Tables']['automation_rules']['Row']
export type AutomationEvent = Database['public']['Tables']['automation_events']['Row']
export type AutomationLog = Database['public']['Tables']['automation_logs']['Row']
export type BankAccount = Database['public']['Tables']['bank_accounts']['Row']
export type BankReconciliation = Database['public']['Tables']['bank_reconciliations']['Row']
export type BankTransaction = Database['public']['Tables']['bank_transactions']['Row']
export type Branch = Database['public']['Tables']['branches']['Row']
export type CashDrawer = Database['public']['Tables']['cash_drawers']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type EmployeeProfile = Database['public']['Tables']['employee_profiles']['Row']
export type ExpenseCategory = Database['public']['Tables']['expense_categories']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type FinancialPeriod = Database['public']['Tables']['financial_periods']['Row']
export type Inventory = Database['public']['Tables']['inventory']['Row']
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type JournalEntry = Database['public']['Tables']['journal_entries']['Row']
export type JournalEntryLine = Database['public']['Tables']['journal_entry_lines']['Row']
export type LoyaltyTransaction = Database['public']['Tables']['loyalty_transactions']['Row']
export type MpesaTransaction = Database['public']['Tables']['mpesa_transactions']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type PaymentSplit = Database['public']['Tables']['payment_splits']['Row']
export type PayrollRun = Database['public']['Tables']['payroll_runs']['Row']
export type Payslip = Database['public']['Tables']['payslips']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Promotion = Database['public']['Tables']['promotions']['Row']
export type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
export type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row']
export type RecurringExpense = Database['public']['Tables']['recurring_expenses']['Row']
export type ReturnItem = Database['public']['Tables']['return_items']['Row']
export type SaleItem = Database['public']['Tables']['sale_items']['Row']
export type Sale = Database['public']['Tables']['sales']['Row']
export type Shift = Database['public']['Tables']['shifts']['Row']
export type StockMovement = Database['public']['Tables']['stock_movements']['Row']
export type StockTransferItem = Database['public']['Tables']['stock_transfer_items']['Row']
export type StockTransfer = Database['public']['Tables']['stock_transfers']['Row']
export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type Warehouse = Database['public']['Tables']['warehouses']['Row']
