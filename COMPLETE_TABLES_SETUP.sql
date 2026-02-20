-- ============================================
-- Setup Lengkap Semua Tabel untuk KMB Learning
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query
-- Copy seluruh script ini dan paste di SQL Editor, lalu klik Run

-- ============================================
-- 1. TABEL USERS (Management Account)
-- ============================================
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

-- Index untuk tabel users
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);

-- Enable RLS untuk users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy untuk users (untuk development)
DROP POLICY IF EXISTS "Allow all operations for users" ON public.users;
CREATE POLICY "Allow all operations for users" 
ON public.users
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- 2. TABEL QUIZZES (jika belum ada, update jika sudah ada)
-- ============================================
-- Pastikan kolom-kolom berikut ada di tabel quizzes
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS quiz_type TEXT;

ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS time_limit INTEGER;

ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS minimum_score INTEGER DEFAULT 70;

ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS questions_to_display INTEGER;

-- Update training_title menjadi 'BAIM' jika belum
UPDATE public.quizzes 
SET training_title = 'BAIM'
WHERE training_title IS DISTINCT FROM 'BAIM'
   OR training_title IS NULL;

-- Index untuk quizzes (jika belum ada)
CREATE INDEX IF NOT EXISTS idx_quizzes_training_title ON public.quizzes(training_title);
CREATE INDEX IF NOT EXISTS idx_quizzes_quiz_title ON public.quizzes(quiz_title);
CREATE INDEX IF NOT EXISTS idx_quizzes_quiz_type ON public.quizzes(quiz_type);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON public.quizzes(created_at DESC);

-- Enable RLS untuk quizzes (jika belum)
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Policy untuk quizzes (untuk development)
DROP POLICY IF EXISTS "Allow all operations for quizzes" ON public.quizzes;
CREATE POLICY "Allow all operations for quizzes" 
ON public.quizzes
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- 3. TABEL QUIZ_RESULTS (jika belum ada)
-- ============================================
CREATE TABLE IF NOT EXISTS public.quiz_results (
  id BIGSERIAL PRIMARY KEY,
  quiz_id BIGINT NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL DEFAULT 'Anonymous',
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  answers JSONB NOT NULL,
  is_passed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk quiz_results
CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_id ON public.quiz_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_participant_name ON public.quiz_results(participant_name);
CREATE INDEX IF NOT EXISTS idx_quiz_results_completed_at ON public.quiz_results(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_is_passed ON public.quiz_results(is_passed);

-- Enable RLS untuk quiz_results
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

-- Policy untuk quiz_results (untuk development)
DROP POLICY IF EXISTS "Allow all operations for quiz_results" ON public.quiz_results;
CREATE POLICY "Allow all operations for quiz_results" 
ON public.quiz_results
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- VERIFIKASI
-- ============================================
-- Setelah menjalankan script ini, cek di Table Editor:
-- 1. Tabel 'users' seharusnya sudah muncul
-- 2. Tabel 'quizzes' seharusnya memiliki kolom: quiz_type, time_limit, minimum_score, questions_to_display
-- 3. Tabel 'quiz_results' seharusnya sudah muncul
-- 
-- Untuk melihat struktur tabel:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'users';
--
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'quizzes';
--
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'quiz_results';

