import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://tcefyhuikcifryreyrbc.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_Rd3DItWgFjV5VwHhovGu-Q_2yftr3Ft";

// Supabase client sudah dikonfigurasi dengan publishable API key

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
