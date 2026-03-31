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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          present: boolean
          registration_id: string
          trip_log_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          present?: boolean
          registration_id: string
          trip_log_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          present?: boolean
          registration_id?: string
          trip_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_trip_log_id_fkey"
            columns: ["trip_log_id"]
            isOneToOne: false
            referencedRelation: "trip_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          last_message_at: string | null
          parent_id: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          parent_id: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          parent_id?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
          sender_type: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
          sender_type: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          city: string
          contact_person_name: string
          contact_person_phone: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          location_address: string | null
          logo_url: string | null
          longitude: number | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          city: string
          contact_person_name: string
          contact_person_phone: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_address?: string | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          contact_person_name?: string
          contact_person_phone?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_address?: string | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_accounts: {
        Row: {
          company_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          password_hash: string
          permissions: Json
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          password_hash: string
          permissions?: Json
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          password_hash?: string
          permissions?: Json
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_employees: {
        Row: {
          company_id: string
          company_line_id: string | null
          created_at: string
          department: string | null
          full_name: string
          id: string
          is_active: boolean
          national_id: string | null
          notes: string | null
          phone: string
          pickup_address: string | null
          pickup_latitude: number | null
          pickup_longitude: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          company_line_id?: string | null
          created_at?: string
          department?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          national_id?: string | null
          notes?: string | null
          phone: string
          pickup_address?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_line_id?: string | null
          created_at?: string
          department?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          national_id?: string | null
          notes?: string | null
          phone?: string
          pickup_address?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_employees_company_line_id_fkey"
            columns: ["company_line_id"]
            isOneToOne: false
            referencedRelation: "company_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invoices: {
        Row: {
          company_approval_status: string
          company_approved_at: string | null
          company_approved_by: string | null
          company_comment: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_number: string
          issued_date: string | null
          line_items: Json
          notes: string | null
          paid_date: string | null
          period_end: string
          period_start: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          company_approval_status?: string
          company_approved_at?: string | null
          company_approved_by?: string | null
          company_comment?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number: string
          issued_date?: string | null
          line_items?: Json
          notes?: string | null
          paid_date?: string | null
          period_end: string
          period_start: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          company_approval_status?: string
          company_approved_at?: string | null
          company_approved_by?: string | null
          company_comment?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string
          issued_date?: string | null
          line_items?: Json
          notes?: string | null
          paid_date?: string | null
          period_end?: string
          period_start?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invoices_company_approved_by_fkey"
            columns: ["company_approved_by"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_lines: {
        Row: {
          company_id: string
          created_at: string
          driver_id: string | null
          driver_rate_per_shift: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          number_of_shifts: number
          price_per_shift: number
          route_details: string | null
          shift_times: Json
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          driver_id?: string | null
          driver_rate_per_shift?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          number_of_shifts?: number
          price_per_shift?: number
          route_details?: string | null
          shift_times?: Json
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          driver_id?: string | null
          driver_rate_per_shift?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          number_of_shifts?: number
          price_per_shift?: number
          route_details?: string | null
          shift_times?: Json
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_lines_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_lines_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      company_notifications: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          notification_type: string
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          notification_type: string
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          notification_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_portal_messages: {
        Row: {
          channel_ref_id: string | null
          channel_type: string
          company_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
          sender_name: string
          sender_type: string
        }
        Insert: {
          channel_ref_id?: string | null
          channel_type: string
          company_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
          sender_name: string
          sender_type: string
        }
        Update: {
          channel_ref_id?: string | null
          channel_type?: string
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
          sender_name?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_portal_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          handled_by: string | null
          id: string
          message: string
          name: string
          notes: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          handled_by?: string | null
          id?: string
          message: string
          name: string
          notes?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          handled_by?: string | null
          id?: string
          message?: string
          name?: string
          notes?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_submissions_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          can_send: boolean | null
          conversation_id: string
          created_at: string
          id: string
          participant_ref_id: string | null
          participant_type: string
          user_id: string | null
        }
        Insert: {
          can_send?: boolean | null
          conversation_id: string
          created_at?: string
          id?: string
          participant_ref_id?: string | null
          participant_type: string
          user_id?: string | null
        }
        Update: {
          can_send?: boolean | null
          conversation_id?: string
          created_at?: string
          id?: string
          participant_ref_id?: string | null
          participant_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "unified_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_driver_attendance: {
        Row: {
          attendance_date: string
          company_line_id: string
          created_at: string
          driver_id: string | null
          extra_fee_amount: number
          extra_fee_reason: string | null
          id: string
          is_present: boolean
          notes: string | null
          shift_number: number
          shift_rate: number
          supervisor_id: string | null
        }
        Insert: {
          attendance_date: string
          company_line_id: string
          created_at?: string
          driver_id?: string | null
          extra_fee_amount?: number
          extra_fee_reason?: string | null
          id?: string
          is_present?: boolean
          notes?: string | null
          shift_number?: number
          shift_rate?: number
          supervisor_id?: string | null
        }
        Update: {
          attendance_date?: string
          company_line_id?: string
          created_at?: string
          driver_id?: string | null
          extra_fee_amount?: number
          extra_fee_reason?: string | null
          id?: string
          is_present?: boolean
          notes?: string | null
          shift_number?: number
          shift_rate?: number
          supervisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corporate_driver_attendance_company_line_id_fkey"
            columns: ["company_line_id"]
            isOneToOne: false
            referencedRelation: "company_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corporate_driver_attendance_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corporate_driver_attendance_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_feedback: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          is_from_parent: boolean
          message: string
          registration_id: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          is_from_parent?: boolean
          message: string
          registration_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          is_from_parent?: boolean
          message?: string
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_feedback_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_feedback_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_accounts: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          is_active: boolean
          phone: string
          supervisor_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          is_active?: boolean
          phone: string
          supervisor_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          is_active?: boolean
          phone?: string
          supervisor_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_accounts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_accounts_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          belongs_to: string
          city: string
          created_at: string
          documents_url: string | null
          full_name: string
          id: string
          is_active: boolean
          license_number: string
          phone: string
          updated_at: string
        }
        Insert: {
          belongs_to?: string
          city?: string
          created_at?: string
          documents_url?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          license_number: string
          phone: string
          updated_at?: string
        }
        Update: {
          belongs_to?: string
          city?: string
          created_at?: string
          documents_url?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          license_number?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_notifications: {
        Row: {
          city: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          notification_type: string
          read_by: string[]
          registration_id: string
          title: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          notification_type?: string
          read_by?: string[]
          registration_id: string
          title: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          read_by?: string[]
          registration_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_notifications_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          city: string | null
          created_at: string
          departments: Database["public"]["Enums"]["department"][]
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          departments?: Database["public"]["Enums"]["department"][]
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          departments?: Database["public"]["Enums"]["department"][]
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      homepage_gallery: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      homepage_partners: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      homepage_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      incident_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          reported_by: string | null
          resolved: boolean
          route_id: string | null
          severity: string
          trip_log_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          reported_by?: string | null
          resolved?: boolean
          route_id?: string | null
          severity?: string
          trip_log_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          reported_by?: string | null
          resolved?: boolean
          route_id?: string | null
          severity?: string
          trip_log_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reports_trip_log_id_fkey"
            columns: ["trip_log_id"]
            isOneToOne: false
            referencedRelation: "trip_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      live_trips: {
        Row: {
          completed_at: string | null
          created_at: string
          current_latitude: number | null
          current_longitude: number | null
          driver_id: string | null
          id: string
          last_location_update: string | null
          route_id: string
          started_at: string | null
          started_by: string | null
          status: Database["public"]["Enums"]["trip_status"]
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          driver_id?: string | null
          id?: string
          last_location_update?: string | null
          route_id: string
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          driver_id?: string | null
          id?: string
          last_location_update?: string | null
          route_id?: string
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_trips_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified: boolean | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          verified?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      parent_accounts: {
        Row: {
          city: string
          created_at: string
          emergency_phone: string
          father_phone: string
          has_password: boolean
          id: string
          is_active: boolean
          job: string | null
          mother_phone: string | null
          national_id: string
          parent_name: string
          pickup_latitude: number
          pickup_longitude: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          city: string
          created_at?: string
          emergency_phone: string
          father_phone: string
          has_password?: boolean
          id?: string
          is_active?: boolean
          job?: string | null
          mother_phone?: string | null
          national_id: string
          parent_name: string
          pickup_latitude: number
          pickup_longitude: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          emergency_phone?: string
          father_phone?: string
          has_password?: boolean
          id?: string
          is_active?: boolean
          job?: string | null
          mother_phone?: string | null
          national_id?: string
          parent_name?: string
          pickup_latitude?: number
          pickup_longitude?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_extra_fees: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          fee_type: string
          id: string
          payment_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          fee_type?: string
          id?: string
          payment_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          fee_type?: string
          id?: string
          payment_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_extra_fees_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          paid_date: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          paid_date?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          paid_date?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          car_type: Database["public"]["Enums"]["car_type"]
          created_at: string
          created_by: string | null
          education_department: Database["public"]["Enums"]["education_department"]
          grade: string
          id: string
          parent_id: string
          school_id: string
          status: Database["public"]["Enums"]["registration_status"]
          student_name: string
          student_photo_url: string | null
          updated_at: string
        }
        Insert: {
          car_type: Database["public"]["Enums"]["car_type"]
          created_at?: string
          created_by?: string | null
          education_department: Database["public"]["Enums"]["education_department"]
          grade: string
          id?: string
          parent_id: string
          school_id: string
          status?: Database["public"]["Enums"]["registration_status"]
          student_name?: string
          student_photo_url?: string | null
          updated_at?: string
        }
        Update: {
          car_type?: Database["public"]["Enums"]["car_type"]
          created_at?: string
          created_by?: string | null
          education_department?: Database["public"]["Enums"]["education_department"]
          grade?: string
          id?: string
          parent_id?: string
          school_id?: string
          status?: Database["public"]["Enums"]["registration_status"]
          student_name?: string
          student_photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      route_assignments: {
        Row: {
          created_at: string
          id: string
          pickup_order: number | null
          registration_id: string
          route_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pickup_order?: number | null
          registration_id: string
          route_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pickup_order?: number | null
          registration_id?: string
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_assignments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_assignments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          car_type: Database["public"]["Enums"]["car_type"]
          created_at: string
          driver_id: string | null
          id: string
          is_active: boolean
          max_seats: number
          name: string
          route_data: Json | null
          route_duration_minutes: number | null
          school_id: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          car_type: Database["public"]["Enums"]["car_type"]
          created_at?: string
          driver_id?: string | null
          id?: string
          is_active?: boolean
          max_seats: number
          name: string
          route_data?: Json | null
          route_duration_minutes?: number | null
          school_id: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          car_type?: Database["public"]["Enums"]["car_type"]
          created_at?: string
          driver_id?: string | null
          id?: string
          is_active?: boolean
          max_seats?: number
          name?: string
          route_data?: Json | null
          route_duration_minutes?: number | null
          school_id?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          driver_id: string | null
          id: string
          notes: string | null
          payment_date: string | null
          period_end: string
          period_start: string
          reference_document_url: string | null
          supervisor_id: string | null
          transfer_reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          period_end: string
          period_start: string
          reference_document_url?: string | null
          supervisor_id?: string | null
          transfer_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          period_end?: string
          period_start?: string
          reference_document_url?: string | null
          supervisor_id?: string | null
          transfer_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sensitive_data_access_log: {
        Row: {
          accessed_at: string
          action: string
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string
          action?: string
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string
          action?: string
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_name: string | null
          contract_document_url: string | null
          created_at: string
          driver_id: string | null
          id: string
          id_document_url: string | null
          license_document_url: string | null
          other_documents_urls: Json | null
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          contract_document_url?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          id_document_url?: string | null
          license_document_url?: string | null
          other_documents_urls?: Json | null
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          contract_document_url?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          id_document_url?: string | null
          license_document_url?: string | null
          other_documents_urls?: Json | null
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      student_absences: {
        Row: {
          absence_date: string
          created_at: string
          id: string
          parent_id: string
          reason: string | null
          registration_id: string
        }
        Insert: {
          absence_date: string
          created_at?: string
          id?: string
          parent_id: string
          reason?: string | null
          registration_id: string
        }
        Update: {
          absence_date?: string
          created_at?: string
          id?: string
          parent_id?: string
          reason?: string | null
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_absences_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_absences_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          number_of_installments: number
          registration_id: string
          subscription_type: Database["public"]["Enums"]["subscription_type"]
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          number_of_installments?: number
          registration_id: string
          subscription_type: Database["public"]["Enums"]["subscription_type"]
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          number_of_installments?: number
          registration_id?: string
          subscription_type?: Database["public"]["Enums"]["subscription_type"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisors: {
        Row: {
          belongs_to: string
          city: string
          created_at: string
          documents_url: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string
          updated_at: string
        }
        Insert: {
          belongs_to?: string
          city?: string
          created_at?: string
          documents_url?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          phone: string
          updated_at?: string
        }
        Update: {
          belongs_to?: string
          city?: string
          created_at?: string
          documents_url?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      trip_logs: {
        Row: {
          arrival_time: string | null
          created_at: string
          created_by: string | null
          departure_time: string | null
          id: string
          notes: string | null
          route_id: string
          trip_date: string
        }
        Insert: {
          arrival_time?: string | null
          created_at?: string
          created_by?: string | null
          departure_time?: string | null
          id?: string
          notes?: string | null
          route_id: string
          trip_date: string
        }
        Update: {
          arrival_time?: string | null
          created_at?: string
          created_by?: string | null
          departure_time?: string | null
          id?: string
          notes?: string | null
          route_id?: string
          trip_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_logs_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_notifications: {
        Row: {
          created_at: string
          id: string
          live_trip_id: string
          message: string
          notification_type: Database["public"]["Enums"]["trip_notification_type"]
          read_at: string | null
          registration_id: string | null
          sent_at: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_trip_id: string
          message: string
          notification_type: Database["public"]["Enums"]["trip_notification_type"]
          read_at?: string | null
          registration_id?: string | null
          sent_at?: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          live_trip_id?: string
          message?: string
          notification_type?: Database["public"]["Enums"]["trip_notification_type"]
          read_at?: string | null
          registration_id?: string | null
          sent_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_notifications_live_trip_id_fkey"
            columns: ["live_trip_id"]
            isOneToOne: false
            referencedRelation: "live_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_notifications_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_student_status: {
        Row: {
          arrived_at: string | null
          created_at: string
          dropped_off_at: string | null
          id: string
          live_trip_id: string
          picked_up_at: string | null
          pickup_order: number | null
          registration_id: string
          status: string
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          created_at?: string
          dropped_off_at?: string | null
          id?: string
          live_trip_id: string
          picked_up_at?: string | null
          pickup_order?: number | null
          registration_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          created_at?: string
          dropped_off_at?: string | null
          id?: string
          live_trip_id?: string
          picked_up_at?: string | null
          pickup_order?: number | null
          registration_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_student_status_live_trip_id_fkey"
            columns: ["live_trip_id"]
            isOneToOne: false
            referencedRelation: "live_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_student_status_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_conversations: {
        Row: {
          allow_customer_messages: boolean | null
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string | null
          route_id: string | null
          subject: string | null
          type: Database["public"]["Enums"]["conversation_type"]
          updated_at: string
        }
        Insert: {
          allow_customer_messages?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          route_id?: string | null
          subject?: string | null
          type: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string
        }
        Update: {
          allow_customer_messages?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          route_id?: string | null
          subject?: string | null
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unified_conversations_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          sender_id: string
          sender_name: string | null
          sender_type: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          sender_id: string
          sender_name?: string | null
          sender_type: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          sender_id?: string
          sender_name?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "unified_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "unified_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_send_in_conversation: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      get_user_departments: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["department"][]
      }
      get_user_driver_id: { Args: { _user_id: string }; Returns: string }
      get_user_parent_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_supervisor_id: { Args: { _user_id: string }; Returns: string }
      has_department: {
        Args: {
          _department: Database["public"]["Enums"]["department"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_driver_or_supervisor: { Args: { _user_id: string }; Returns: boolean }
      is_driver_parent: {
        Args: { _parent_id: string; _user_id: string }
        Returns: boolean
      }
      is_driver_registration: {
        Args: { _registration_id: string; _user_id: string }
        Returns: boolean
      }
      is_employee: { Args: { _user_id: string }; Returns: boolean }
      is_parent_route: {
        Args: { _route_id: string; _user_id: string }
        Returns: boolean
      }
      log_sensitive_data_access: {
        Args: { p_record_id: string; p_table_name: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "employee"
      car_type: "ac" | "non_ac"
      conversation_type:
        | "staff_dm"
        | "customer_dm"
        | "route_group"
        | "customer_supervisor"
      department:
        | "customer_support"
        | "operations"
        | "finance"
        | "reports"
        | "operation_companies"
      education_department: "national" | "ig" | "american"
      payment_status: "paid" | "pending" | "overdue"
      registration_status:
        | "pending_fees"
        | "complete"
        | "cancelled"
        | "archived"
      subscription_type: "monthly" | "yearly"
      trip_notification_type:
        | "trip_started"
        | "arriving_soon"
        | "arrived_at_pickup"
        | "picked_up"
        | "arrived_at_school"
        | "trip_completed"
      trip_status: "pending" | "in_progress" | "completed" | "cancelled"
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
      app_role: ["super_admin", "employee"],
      car_type: ["ac", "non_ac"],
      conversation_type: [
        "staff_dm",
        "customer_dm",
        "route_group",
        "customer_supervisor",
      ],
      department: [
        "customer_support",
        "operations",
        "finance",
        "reports",
        "operation_companies",
      ],
      education_department: ["national", "ig", "american"],
      payment_status: ["paid", "pending", "overdue"],
      registration_status: [
        "pending_fees",
        "complete",
        "cancelled",
        "archived",
      ],
      subscription_type: ["monthly", "yearly"],
      trip_notification_type: [
        "trip_started",
        "arriving_soon",
        "arrived_at_pickup",
        "picked_up",
        "arrived_at_school",
        "trip_completed",
      ],
      trip_status: ["pending", "in_progress", "completed", "cancelled"],
    },
  },
} as const
