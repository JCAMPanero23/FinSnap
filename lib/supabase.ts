import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nmelcsnjtrwwclsocbqc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZWxjc25qdHJ3d2Nsc29jYnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzQzOTMsImV4cCI6MjA4MTMxMDM5M30.RH7ffWvshrXB8am2USobTbyVJZdsmOUU8XadONQUPxY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
