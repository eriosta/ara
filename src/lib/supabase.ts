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
          data_sharing_consent: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          goal_rvu_per_day?: number
          data_sharing_consent?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          goal_rvu_per_day?: number
          data_sharing_consent?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      upload_history: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_path: string
          file_size: number | null
          records_imported: number | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          records_imported?: number | null
          uploaded_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          records_imported?: number | null
          uploaded_at?: string
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
  data_sharing_consent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- If migrating existing table, run:
-- ALTER TABLE profiles ADD COLUMN data_sharing_consent BOOLEAN DEFAULT false;

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (user_id, dictation_datetime) -- Prevent duplicate records
);

-- If migrating existing table, add the constraint:
-- ALTER TABLE rvu_records ADD CONSTRAINT unique_user_datetime UNIQUE (user_id, dictation_datetime);

-- Create upload history table (stores references to uploaded files)
CREATE TABLE upload_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  records_imported INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rvu_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;

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

-- Policies for upload_history
CREATE POLICY "Users can view own uploads" ON upload_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own uploads" ON upload_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploads" ON upload_history
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, data_sharing_consent)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'data_sharing_consent')::boolean, false)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- STORAGE: Create bucket for file uploads
-- Run in Supabase Dashboard > Storage > Create bucket named 'uploads'
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('uploads', 'uploads', false);

-- Storage policies: users can only access their own folder (userId as folder name)
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
*/

