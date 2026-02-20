-- ============================================
-- SQL Script Lengkap untuk Update Tabel Quizzes
-- ============================================
-- Jalankan script ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query
-- 
-- Script ini akan:
-- 1. Menambahkan kolom quiz_type jika belum ada
-- 2. Menambahkan kolom time_limit jika belum ada
-- 3. Update data yang sudah ada (training_title menjadi 'BAIM')
-- 4. Membuat index untuk performa yang lebih baik
-- ============================================

-- Step 1: Tambahkan kolom quiz_type jika belum ada
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS quiz_type TEXT;

-- Step 2: Tambahkan kolom time_limit jika belum ada
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS time_limit INTEGER;

-- Step 3: Update training_title yang sudah ada menjadi 'BAIM'
-- (Hanya update jika berbeda dari 'BAIM')
UPDATE public.quizzes 
SET training_title = 'BAIM'
WHERE training_title IS DISTINCT FROM 'BAIM'
   OR training_title IS NULL;

-- Step 4: Update quiz_title yang menggunakan format lama (Baim 1, baim 1, dll) menjadi format baru (BAIM 1)
UPDATE public.quizzes 
SET quiz_title = 'BAIM ' || SUBSTRING(quiz_title FROM '[0-9]+')
WHERE quiz_title ~* '^baim\s*[0-9]+'
   AND quiz_title NOT LIKE 'BAIM %';

-- Step 5: Set default quiz_type untuk data yang sudah ada (jika null)
-- HATI-HATI: Ini akan set semua quiz yang null menjadi 'Pre Test'
-- Anda mungkin perlu mengupdate manual sesuai kebutuhan
-- UPDATE public.quizzes 
-- SET quiz_type = 'Pre Test'
-- WHERE quiz_type IS NULL;
-- (Baris di atas di-comment, uncomment jika perlu)

-- Step 6: Buat index untuk performa query yang lebih baik
CREATE INDEX IF NOT EXISTS idx_quizzes_training_title ON public.quizzes(training_title);
CREATE INDEX IF NOT EXISTS idx_quizzes_quiz_title ON public.quizzes(quiz_title);
CREATE INDEX IF NOT EXISTS idx_quizzes_quiz_type ON public.quizzes(quiz_type);
CREATE INDEX IF NOT EXISTS idx_quizzes_training_quiz_type ON public.quizzes(training_title, quiz_title, quiz_type);

-- Step 7: Verifikasi struktur tabel
-- Setelah menjalankan script, cek di Table Editor untuk memastikan:
-- - Kolom 'quiz_type' sudah ada (TEXT, nullable)
-- - Kolom 'time_limit' sudah ada (INTEGER, nullable)
-- - Kolom 'training_title' sudah terupdate menjadi 'BAIM'
-- - Data quiz_title sudah dalam format 'BAIM 1', 'BAIM 2', dll

-- ============================================
-- CATATAN PENTING:
-- ============================================
-- 1. Script ini AMAN untuk dijalankan berulang kali (menggunakan IF NOT EXISTS)
-- 2. Pastikan backup data Anda sebelum menjalankan UPDATE
-- 3. Setelah menjalankan, pastikan untuk:
--    - Mengisi quiz_type untuk setiap quiz (Pre Test atau Post Test)
--    - Memverifikasi bahwa training_title sudah menjadi 'BAIM'
--    - Memverifikasi bahwa quiz_title sudah dalam format 'BAIM 1' sampai 'BAIM 9'
-- ============================================

