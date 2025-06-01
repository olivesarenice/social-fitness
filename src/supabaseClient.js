import { createClient } from '@supabase/supabase-js';

// Read Supabase URL and Anon Key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate that environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        "Supabase URL or Anon Key is missing. " +
        "Make sure to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file."
    );
    // You might want to throw an error here or handle it more gracefully
    // For this skeleton, we'll allow the app to load but Supabase features will fail.
}

// Create and export the Supabase client
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Example of how to check if supabase client is initialized
if (supabase) {
    console.log("Supabase client initialized.");
} else {
    console.warn("Supabase client not initialized due to missing environment variables.");
}