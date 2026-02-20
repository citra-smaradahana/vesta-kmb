-- ============================================
-- Tambahkan Masa Berlaku Sertifikat
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query
-- Copy seluruh script ini dan paste, lalu klik Run

-- 1. Tambahkan kolom certificate_validity_days di tabel quizzes
-- Masa berlaku sertifikat dalam hari (dapat di-set per quiz)
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS certificate_validity_days INTEGER;

-- 2. Tambahkan kolom expiry_date di tabel quiz_results
-- Tanggal kadaluarsa sertifikat (dihitung dari completed_at + certificate_validity_days)
ALTER TABLE public.quiz_results 
ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE;

-- 3. Buat index untuk performa yang lebih baik
CREATE INDEX IF NOT EXISTS idx_quiz_results_expiry_date ON public.quiz_results(expiry_date);

-- 4. Tambahkan komentar untuk dokumentasi
COMMENT ON COLUMN public.quizzes.certificate_validity_days IS 'Masa berlaku sertifikat dalam hari. NULL berarti tidak ada masa berlaku.';
COMMENT ON COLUMN public.quiz_results.expiry_date IS 'Tanggal kadaluarsa sertifikat (dihitung dari completed_at + certificate_validity_days dari quiz). NULL berarti tidak ada masa berlaku.';

