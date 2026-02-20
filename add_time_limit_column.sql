-- ============================================
-- Tambahkan Kolom time_limit ke Tabel Quizzes
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query

-- Tambahkan kolom time_limit (dalam menit, nullable)
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS time_limit INTEGER;

-- Verifikasi kolom sudah ditambahkan
-- Setelah menjalankan query, cek di Table Editor
-- Kolom 'time_limit' seharusnya sudah muncul di tabel 'quizzes'
