# Setup Supabase Database

## Membuat Tabel Quizzes

Untuk aplikasi ini berfungsi, Anda perlu membuat tabel `quizzes` di Supabase. Ikuti langkah berikut:

### 1. Buka Supabase Dashboard
- Login ke https://supabase.com/dashboard
- Pilih project Anda

### 2. Buka SQL Editor
- Klik menu "SQL Editor" di sidebar kiri
- Klik "New query"

### 3. Jalankan Query Berikut

```sql
-- Buat tabel quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id BIGSERIAL PRIMARY KEY,
  training_title TEXT NOT NULL,
  quiz_title TEXT NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buat index untuk performa yang lebih baik
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quizzes_training_title ON quizzes(training_title);

-- Set Row Level Security (RLS) - untuk sementara disable untuk testing
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Buat policy untuk allow semua operasi (untuk development)
-- PERHATIKAN: Ini hanya untuk development! Untuk production, buat policy yang lebih ketat
CREATE POLICY "Allow all operations for quizzes" ON quizzes
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 4. Verifikasi Tabel
- Setelah menjalankan query, buka menu "Table Editor"
- Pastikan tabel `quizzes` sudah muncul
- Tabel siap digunakan!

## Struktur Data

### Tabel: quizzes
- `id` (BIGSERIAL) - Primary key, auto increment
- `training_title` (TEXT) - Judul pelatihan (Baim 1-9)
- `quiz_title` (TEXT) - Judul quiz
- `questions` (JSONB) - Array pertanyaan dalam format JSON
- `created_at` (TIMESTAMP) - Waktu pembuatan quiz

### Format Questions (JSONB)
```json
[
  {
    "question": "Pertanyaan 1?",
    "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
    "correctAnswer": 0
  },
  {
    "question": "Pertanyaan 2?",
    "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
    "correctAnswer": 2
  }
]
```

## Catatan Keamanan

Untuk production, pastikan untuk:
1. Membuat policy RLS yang lebih ketat
2. Hanya allow authenticated users untuk insert/update
3. Public users hanya bisa read

