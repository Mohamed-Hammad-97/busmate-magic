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
      drivers: {
        Row: {
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
      employees: {
        Row: {
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
      parent_accounts: {
        Row: {
          city: string
          created_at: string
          emergency_phone: string
          father_phone: string
          id: string
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
          id?: string
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
          id?: string
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
      payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          paid_date: string | null
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
      get_user_departments: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["department"][]
      }
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
      is_employee: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "employee"
      car_type: "ac" | "non_ac"
      department: "customer_support" | "operations" | "finance" | "reports"
      education_department: "national" | "ig" | "american"
      payment_status: "paid" | "pending" | "overdue"
      registration_status: "pending_fees" | "complete" | "cancelled"
      subscription_type: "monthly" | "yearly"
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
      department: ["customer_support", "operations", "finance", "reports"],
      education_department: ["national", "ig", "american"],
      payment_status: ["paid", "pending", "overdue"],
      registration_status: ["pending_fees", "complete", "cancelled"],
      subscription_type: ["monthly", "yearly"],
    },
  },
} as const
