-- ============================================
-- Tambahkan Kolom target_jabatan ke Tabel Quizzes
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query
-- Copy seluruh script ini dan paste, lalu klik Run

-- Tambahkan kolom target_jabatan (array of text) untuk menyimpan jabatan yang menjadi sasaran quiz
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS target_jabatan TEXT[];

-- Buat index untuk performa yang lebih baik (opsional, untuk query yang menggunakan target_jabatan)
CREATE INDEX IF NOT EXISTS idx_quizzes_target_jabatan ON public.quizzes USING GIN(target_jabatan);

-- Tambahkan komentar untuk dokumentasi
COMMENT ON COLUMN public.quizzes.target_jabatan IS 'Array jabatan yang menjadi sasaran quiz. Jika NULL atau empty, quiz dapat diakses oleh semua user.';

-- Verifikasi kolom sudah ditambahkan
-- Setelah menjalankan query di atas, cek di Table Editor
-- Kolom 'target_jabatan' seharusnya sudah muncul di tabel 'quizzes'
