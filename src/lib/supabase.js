import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Credenciales del proyecto Los Altos (Supabase)
const supabaseUrl = 'https://ywmvdhzbyouobrofxsin.supabase.co';
const supabaseAnonKey = 'sb_publishable_QhgjyY_RFc2P0RBcWe1XOA__REqQsjK';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
