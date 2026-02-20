-- ============================================
-- Add card_image_url column to quizzes table
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query

-- 1. Tambahkan kolom card_image_url ke tabel quizzes
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS card_image_url TEXT;

-- 2. Tambahkan index untuk performa query (opsional)
CREATE INDEX IF NOT EXISTS idx_quizzes_card_image_url ON public.quizzes(card_image_url);

-- 3. Tambahkan comment untuk dokumentasi
COMMENT ON COLUMN public.quizzes.card_image_url IS 'URL gambar untuk card pelatihan yang ditampilkan di halaman KMB Learning';
