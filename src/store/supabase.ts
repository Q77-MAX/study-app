import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://daikrirgnhycnjoztefo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z34IJMSDh5YP9C50Gc8qUQ_hFaPpiYk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
