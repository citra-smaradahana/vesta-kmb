-- ============================================
-- Setup Tabel Quizzes untuk KMB Learning System
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query

-- 1. Buat tabel quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
  id BIGSERIAL PRIMARY KEY,
  training_title TEXT NOT NULL,
  quiz_title TEXT NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Buat index untuk performa yang lebih baik
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON public.quizzes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quizzes_training_title ON public.quizzes(training_title);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- 4. Buat policy untuk allow semua operasi (untuk development)
-- PERHATIKAN: Untuk production, buat policy yang lebih ketat!
CREATE POLICY "Allow all operations for quizzes" 
ON public.quizzes
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Verifikasi tabel sudah dibuat
-- Setelah menjalankan query di atas, cek di Table Editor
-- Tabel 'quizzes' seharusnya sudah muncul

