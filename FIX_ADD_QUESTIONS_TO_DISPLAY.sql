-- ============================================
-- TAMBAHKAN KOLOM questions_to_display
-- ============================================
-- ERROR: column quizzes.questions_to_display does not exist
-- SOLUSI: Jalankan SQL ini di Supabase SQL Editor
-- ============================================

-- Tambahkan kolom questions_to_display
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS questions_to_display INTEGER;

-- Verifikasi kolom sudah ditambahkan
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'quizzes' 
AND column_name = 'questions_to_display';

-- Jika query di atas mengembalikan 1 baris, berarti kolom sudah berhasil ditambahkan!


