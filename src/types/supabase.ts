export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          bio: string | null;
        };
        Insert: {
          id?: string;
          username: string;
          bio?: string | null;
        };
        Update: {
          id?: string;
          username?: string;
          bio?: string | null;
        };
      };
      persona_stats: {
        Row: {
          user_id: string;
          category: string;
          value: Json;
          last_updated: string;
        };
        Insert: {
          user_id: string;
          category: string;
          value?: Json;
          last_updated?: string;
        };
        Update: {
          user_id?: string;
          category?: string;
          value?: Json;
          last_updated?: string;
        };
      };
      interests: {
        Row: {
          user_id: string;
          platform: string;
          ref_id: string;
          weight: number;
        };
        Insert: {
          user_id: string;
          platform: string;
          ref_id: string;
          weight?: number;
        };
        Update: {
          user_id?: string;
          platform?: string;
          ref_id?: string;
          weight?: number;
        };
      };
      baf_history: {
        Row: {
          id: string;
          user_id: string;
          suggestion: string;
          outcome: "accepted" | "rejected";
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          suggestion: string;
          outcome: "accepted" | "rejected";
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          suggestion?: string;
          outcome?: "accepted" | "rejected";
          reason?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
