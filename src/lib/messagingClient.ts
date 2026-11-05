import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { supabase } from '@/lib/supabase';

type MessagingFunctions = {
  messaging_people: {
    Args: never;
    Returns: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      avatar_url: string | null;
    }[];
  };
  messaging_open_direct: {
    Args: {
      p_other: string;
    };
    Returns: string;
  };
  messaging_open_course: {
    Args: {
      p_course: string;
    };
    Returns: string;
  };
};

type MessagingDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & MessagingFunctions;
  };
};

export const messagingClient =
  supabase as unknown as SupabaseClient<MessagingDatabase>;