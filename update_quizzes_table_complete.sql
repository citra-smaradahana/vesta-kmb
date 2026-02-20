-- ============================================
-- SQL SCRIPT LENGKAP UNTUK UPDATE TABEL QUIZZES
-- ============================================
-- Script ini akan:
-- 1. Menambahkan kolom quiz_type (Pre Test/Post Test)
-- 2. Menambahkan kolom time_limit (waktu pengerjaan dalam menit)
-- 3. Update training_title menjadi 'BAIM' untuk semua data
-- 4. Membuat index untuk performa query
-- 5. Memastikan RLS policy sudah ada
-- ============================================
-- INSTRUKSI:
-- 1. Buka Supabase Dashboard: https://supabase.com/dashboard
-- 2. Pilih project Anda
-- 3. Klik menu "SQL Editor" di sidebar
-- 4. Klik "New query"
-- 5. Copy-paste seluruh script ini
-- 6. Klik "Run" atau tekan Ctrl+Enter
-- ============================================

-- ============================================
-- STEP 1: Tambahkan kolom quiz_type
-- ============================================
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS quiz_type TEXT;

-- ============================================
-- STEP 2: Tambahkan kolom time_limit
-- ============================================
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS time_limit INTEGER;

-- ============================================
-- STEP 3: Update training_title menjadi 'BAIM'
-- ============================================
-- Update semua training_title yang berbeda dari 'BAIM' menjadi 'BAIM'
UPDATE public.quizzes 
SET training_title = 'BAIM'
WHERE training_title IS DISTINCT FROM 'BAIM'
   OR training_title IS NULL;

-- ============================================
-- STEP 4: Normalisasi quiz_title ke format 'BAIM 1' - 'BAIM 9'
-- ============================================
-- Update quiz_title yang menggunakan format lama (Baim 1, baim 1, dll)
UPDATE public.quizzes 
SET quiz_title = 'BAIM ' || TRIM(SUBSTRING(quiz_title FROM '[0-9]+'))
WHERE quiz_title ~* '^baim\s*[0-9]+'
   AND quiz_title NOT LIKE 'BAIM %';

-- ============================================
-- STEP 5: Buat Index untuk Performa Query
-- ============================================
-- Index untuk training_title
CREATE INDEX IF NOT EXISTS idx_quizzes_training_title 
ON public.quizzes(training_title);

-- Index untuk quiz_title
CREATE INDEX IF NOT EXISTS idx_quizzes_quiz_title 
ON public.quizzes(quiz_title);

-- Index untuk quiz_type
CREATE INDEX IF NOT EXISTS idx_quizzes_quiz_type 
ON public.quizzes(quiz_type);

-- Index composite untuk query yang sering digunakan
CREATE INDEX IF NOT EXISTS idx_quizzes_training_quiz_type 
ON public.quizzes(training_title, quiz_title, quiz_type);

-- Index untuk created_at (jika belum ada)
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at 
ON public.quizzes(created_at DESC);

-- ============================================
-- STEP 6: Pastikan RLS Policy Sudah Ada
-- ============================================
-- Enable Row Level Security
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Drop policy lama jika ada (untuk menghindari duplikasi)
DROP POLICY IF EXISTS "Allow all operations for quizzes" ON public.quizzes;

-- Buat policy baru untuk allow semua operasi (untuk development)
-- PERHATIKAN: Untuk production, buat policy yang lebih ketat!
CREATE POLICY "Allow all operations for quizzes" 
ON public.quizzes
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- STEP 7: Verifikasi Struktur Tabel
-- ============================================
-- Query untuk melihat struktur tabel setelah update
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'quizzes'
ORDER BY ordinal_position;

-- ============================================
-- STEP 8: Verifikasi Data
-- ============================================
-- Query untuk melihat data yang sudah diupdate
SELECT 
    id,
    training_title,
    quiz_title,
    quiz_type,
    time_limit,
    jsonb_array_length(questions) as jumlah_soal,
    created_at
FROM public.quizzes
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- CATATAN PENTING:
-- ============================================
-- 1. Script ini AMAN untuk dijalankan berulang kali
--    (menggunakan IF NOT EXISTS dan IF EXISTS)
--
-- 2. Setelah menjalankan script, pastikan untuk:
--    a. Mengisi quiz_type untuk setiap quiz yang sudah ada
--       (Pre Test atau Post Test)
--    b. Memverifikasi training_title sudah menjadi 'BAIM'
--    c. Memverifikasi quiz_title sudah dalam format 'BAIM 1' sampai 'BAIM 9'
--
-- 3. Untuk mengisi quiz_type pada data yang sudah ada:
--    UPDATE public.quizzes 
--    SET quiz_type = 'Pre Test'  -- atau 'Post Test'
--    WHERE id = [ID_QUIZ];
--
-- 4. Struktur tabel final:
--    - id (BIGSERIAL PRIMARY KEY)
--    - training_title (TEXT) -> selalu 'BAIM'
--    - quiz_title (TEXT) -> 'BAIM 1' sampai 'BAIM 9'
--    - quiz_type (TEXT) -> 'Pre Test' atau 'Post Test'
--    - questions (JSONB) -> array pertanyaan
--    - time_limit (INTEGER) -> waktu pengerjaan dalam menit (nullable)
--    - created_at (TIMESTAMP WITH TIME ZONE)
-- ============================================

