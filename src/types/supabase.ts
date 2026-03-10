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
          persona_embedding: string | null;
        };
        Insert: {
          id?: string;
          username: string;
          bio?: string | null;
          archetype?: string;
          persona_embedding?: string | null;
        };
        Update: {
          id?: string;
          username?: string;
          bio?: string | null;
          archetype?: string;
          persona_embedding?: string | null;
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
          embedding: string | null;
        };
        Insert: {
          user_id: string;
          platform: string;
          ref_id: string;
          weight?: number;
          embedding?: string | null;
        };
        Update: {
          user_id?: string;
          platform?: string;
          ref_id?: string;
          weight?: number;
          embedding?: string | null;
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
          archetype: string | null;
          source: string | null;
          embedding: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          suggestion: string;
          outcome: "accepted" | "rejected";
          reason?: string | null;
          archetype?: string | null;
          source?: string | null;
          embedding?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          suggestion?: string;
          outcome?: "accepted" | "rejected";
          reason?: string | null;
          archetype?: string | null;
          source?: string | null;
          embedding?: string | null;
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
      suggestion_pool: {
        Row: {
          id: string;
          content_text: string;
          category: string;
          platform: string;
          url: string;
          embedding: string | null;
          times_shown: number;
          times_accepted: number;
          times_rejected: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_text: string;
          category: string;
          platform?: string;
          url?: string;
          embedding?: string | null;
          times_shown?: number;
          times_accepted?: number;
          times_rejected?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          content_text?: string;
          category?: string;
          platform?: string;
          url?: string;
          embedding?: string | null;
          times_shown?: number;
          times_accepted?: number;
          times_rejected?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_suggestions: {
        Args: {
          query_embedding: string;
          match_count?: number;
          match_threshold?: number;
        };
        Returns: Array<{
          id: string;
          content_text: string;
          category: string;
          platform: string;
          url: string;
          times_shown: number;
          times_accepted: number;
          times_rejected: number;
          similarity: number;
        }>;
      };
      fetch_popular_suggestions: {
        Args: {
          fetch_count?: number;
        };
        Returns: Array<{
          id: string;
          content_text: string;
          category: string;
          platform: string;
          url: string;
          times_shown: number;
          times_accepted: number;
          times_rejected: number;
        }>;
      };
      update_pool_engagement: {
        Args: {
          p_pool_id: string;
          p_outcome: string;
        };
        Returns: undefined;
      };
      nudge_persona_embedding: {
        Args: {
          p_user_id: string;
          suggestion_emb: string;
          learning_rate?: number;
          direction?: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
