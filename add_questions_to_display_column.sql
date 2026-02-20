-- ============================================
-- Tambahkan Kolom questions_to_display ke Tabel quizzes
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query

-- Tambahkan kolom questions_to_display
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS questions_to_display INTEGER;

-- Tambahkan komentar untuk dokumentasi
COMMENT ON COLUMN public.quizzes.questions_to_display IS 'Jumlah soal yang akan ditampilkan saat quiz dikerjakan. Jika NULL atau 0, semua soal dari bank soal akan ditampilkan.';

-- Catatan:
-- - Jika questions_to_display NULL atau 0, semua soal akan ditampilkan
-- - Jika questions_to_display > 0, hanya jumlah tersebut yang akan ditampilkan (diacak dari bank soal)
-- - Nilai tidak boleh melebihi jumlah total soal di bank soal


