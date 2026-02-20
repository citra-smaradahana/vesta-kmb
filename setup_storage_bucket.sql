-- ============================================
-- Setup Supabase Storage Bucket untuk Foto User
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query

-- 1. Buat bucket untuk foto user (public bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-photos', 'user-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Hapus policy lama jika ada (untuk menghindari error)
DROP POLICY IF EXISTS "Allow authenticated users to upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon to upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon to read photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon to update photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon to delete photos" ON storage.objects;

-- 3. Buat policy untuk allow upload foto (anon untuk development)
CREATE POLICY "Allow anon to upload photos"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'user-photos');

-- 4. Buat policy untuk allow read foto (public)
CREATE POLICY "Allow public to read photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'user-photos');

-- 5. Buat policy untuk allow update foto (anon untuk development)
CREATE POLICY "Allow anon to update photos"
ON storage.objects
FOR UPDATE
TO anon
USING (bucket_id = 'user-photos')
WITH CHECK (bucket_id = 'user-photos');

-- 6. Buat policy untuk allow delete foto (anon untuk development)
CREATE POLICY "Allow anon to delete photos"
ON storage.objects
FOR DELETE
TO anon
USING (bucket_id = 'user-photos');

-- Catatan:
-- Policy menggunakan 'anon' untuk development (tanpa authentication)
-- Untuk production, ganti 'anon' dengan 'authenticated' dan setup authentication
-- 
-- Setelah menjalankan script ini:
-- 1. Buka Storage di Supabase Dashboard
-- 2. Pastikan bucket 'user-photos' sudah muncul
-- 3. Bucket sudah siap digunakan untuk upload foto
