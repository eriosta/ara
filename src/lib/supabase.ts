import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          goal_rvu_per_day: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          goal_rvu_per_day?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          goal_rvu_per_day?: number
          created_at?: string
          updated_at?: string
        }
      }
      rvu_records: {
        Row: {
          id: string
          user_id: string
          dictation_datetime: string
          exam_description: string
          wrvu_estimate: number
          modality: string | null
          exam_type: string | null
          body_part: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          dictation_datetime: string
          exam_description: string
          wrvu_estimate: number
          modality?: string | null
          exam_type?: string | null
          body_part?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          dictation_datetime?: string
          exam_description?: string
          wrvu_estimate?: number
          modality?: string | null
          exam_type?: string | null
          body_part?: string | null
          created_at?: string
        }
      }
    }
  }
}

// SQL to create tables in Supabase:
/*
-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  goal_rvu_per_day NUMERIC DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create RVU records table
CREATE TABLE rvu_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  dictation_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  exam_description TEXT NOT NULL,
  wrvu_estimate NUMERIC NOT NULL,
  modality TEXT,
  exam_type TEXT,
  body_part TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rvu_records ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies for rvu_records
CREATE POLICY "Users can view own records" ON rvu_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records" ON rvu_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own records" ON rvu_records
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own records" ON rvu_records
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
*/

