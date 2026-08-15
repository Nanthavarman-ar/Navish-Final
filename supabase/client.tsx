import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, projectId, publicAnonKey } from './info';

export const supabase = createClient(supabaseUrl, publicAnonKey);

export { projectId, publicAnonKey };
