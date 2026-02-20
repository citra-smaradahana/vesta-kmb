-- ============================================
-- SQL MINIMAL - COPY INI SAJA
-- ============================================
-- Jalankan di Supabase SQL Editor

-- Tambahkan kolom quiz_type
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS quiz_type TEXT;

-- Tambahkan kolom time_limit
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS time_limit INTEGER;

-- Update training_title menjadi 'BAIM'
UPDATE public.quizzes 
SET training_title = 'BAIM'
WHERE training_title IS DISTINCT FROM 'BAIM'
   OR training_title IS NULL;

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Buat policy (jika belum ada)
DROP POLICY IF EXISTS "Allow all operations for quizzes" ON public.quizzes;

CREATE POLICY "Allow all operations for quizzes" 
ON public.quizzes
FOR ALL
USING (true)
WITH CHECK (true);

