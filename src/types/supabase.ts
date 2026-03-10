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
          archetype: string;
        };
        Insert: {
          id?: string;
          username: string;
          bio?: string | null;
          archetype?: string;
        };
        Update: {
          id?: string;
          username?: string;
          bio?: string | null;
          archetype?: string;
        };
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: "persona_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "interests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "baf_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
