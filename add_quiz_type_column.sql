-- ============================================
-- Tambahkan Kolom quiz_type ke Tabel Quizzes
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query

-- Tambahkan kolom quiz_type (Pre Test atau Post Test)
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS quiz_type TEXT;

-- Update training_title yang ada menjadi 'BAIM' jika masih menggunakan format lama
UPDATE public.quizzes 
SET training_title = 'BAIM'
WHERE training_title LIKE 'Baim%' OR training_title LIKE 'BAIM%';

-- Verifikasi kolom sudah ditambahkan
-- Setelah menjalankan query, cek di Table Editor
-- Kolom 'quiz_type' seharusnya sudah muncul di tabel 'quizzes'

