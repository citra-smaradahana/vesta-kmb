-- ============================================
-- Setup Tabel Users untuk Management Account
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query

-- 1. Buat tabel users
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  jabatan TEXT,
  site TEXT,
  nrp TEXT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'User' CHECK (role IN ('User', 'Trainer', 'Admin')),
  foto TEXT, -- Base64 atau URL foto profil
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. Buat index untuk performa yang lebih baik
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. Buat policy untuk allow semua operasi (untuk development)
-- PERHATIKAN: Untuk production, buat policy yang lebih ketat!
CREATE POLICY "Allow all operations for users" 
ON public.users
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Verifikasi tabel sudah dibuat
-- Setelah menjalankan query di atas, cek di Table Editor
-- Tabel 'users' seharusnya sudah muncul

