# Panduan Menggunakan Template Sertifikat

## Cara Menggunakan Template Sertifikat

### 1. Siapkan Template Gambar

- Format: PNG atau JPG
- Ukuran: Disarankan 297mm x 210mm (A4 landscape) atau proporsi yang sesuai
- Resolusi: Minimal 300 DPI untuk kualitas baik
- Letakkan file di folder: `public/images/`
- Contoh nama file: `certificate-template.png`

### 2. Edit Konfigurasi

Buka file `src/config/certificateConfig.js` dan ubah:

```javascript
template: {
  useTemplate: true,  // Ubah menjadi true
  imagePath: '/images/certificate-template.png',  // Path ke template Anda
  // ...
}
```

### 3. Atur Posisi Teks

Sesuaikan posisi teks sesuai template Anda. Posisi bisa dalam:

- **Persen (%)**: `'50%'` = tengah
- **Pixel**: `'100'` = 100 pixel dari kiri/atas

```javascript
textPositions: {
  participantName: { x: '50%', y: '40%' },  // Nama peserta di tengah, 40% dari atas
  jabatan: { x: '50%', y: '45%' },
  nrp: { x: '50%', y: '50%' },
  trainingTitle: { x: '50%', y: '55%' },
  quizTitle: { x: '50%', y: '60%' },
  score: { x: '50%', y: '65%' },
  date: { x: '50%', y: '70%' },
  trainerName: { x: '80%', y: '85%' },     // Trainer di kanan
  trainerTitle: { x: '80%', y: '90%' }
}
```

### 4. Atur Style Teks

Sesuaikan ukuran, warna, dan style teks:

```javascript
textStyles: {
  participantName: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center'
  },
  // ... dll
}
```

## Cara Menentukan Posisi Teks

### Metode 1: Menggunakan Tool Online

1. Buka template di image editor (Photoshop, GIMP, atau online editor)
2. Lihat koordinat X dan Y dari area yang ingin diisi
3. Konversi ke persen: `(koordinat / ukuran total) * 100%`

### Metode 2: Trial and Error

1. Mulai dengan posisi tengah: `x: '50%', y: '50%'`
2. Download sertifikat dan lihat hasilnya
3. Sesuaikan posisi sedikit demi sedikit
4. Ulangi sampai posisi pas

### Contoh Posisi:

- **Tengah horizontal**: `x: '50%'`
- **Kiri**: `x: '20%'`
- **Kanan**: `x: '80%'`
- **Atas**: `y: '20%'`
- **Tengah vertikal**: `y: '50%'`
- **Bawah**: `y: '80%'`

## Tips

1. **Ukuran Font**: Sesuaikan dengan template

   - Nama peserta biasanya lebih besar (28-36px)
   - Detail biasanya lebih kecil (12-16px)

2. **Warna Teks**: Pilih warna yang kontras dengan background template

   - Background terang → teks gelap (`#333`, `#000`)
   - Background gelap → teks terang (`#fff`, `#f0f0f0`)

3. **Alignment**:

   - `'center'` untuk teks di tengah
   - `'left'` untuk teks di kiri
   - `'right'` untuk teks di kanan

4. **Test**: Selalu test setelah mengubah posisi/style

## Contoh Konfigurasi Lengkap

```javascript
template: {
  useTemplate: true,
  imagePath: '/images/certificate-template.png',
  textPositions: {
    participantName: { x: '50%', y: '35%' },
    jabatan: { x: '50%', y: '42%' },
    nrp: { x: '50%', y: '48%' },
    trainingTitle: { x: '50%', y: '55%' },
    quizTitle: { x: '50%', y: '60%' },
    score: { x: '50%', y: '65%' },
    date: { x: '50%', y: '70%' },
    trainerName: { x: '75%', y: '82%' },
    trainerTitle: { x: '75%', y: '87%' }
  },
  textStyles: {
    participantName: {
      fontSize: '36px',
      fontWeight: 'bold',
      color: '#1a1a1a',
      textAlign: 'center'
    },
    jabatan: {
      fontSize: '16px',
      color: '#555',
      textAlign: 'center'
    },
    // ... dll
  }
}
```

## Troubleshooting

**Problem**: Template tidak muncul

- **Solusi**: Pastikan file ada di `public/images/` dan path benar

**Problem**: Teks tidak di posisi yang benar

- **Solusi**: Sesuaikan nilai x dan y di `textPositions`

**Problem**: Teks terlalu besar/kecil

- **Solusi**: Ubah `fontSize` di `textStyles`

**Problem**: Teks tidak terlihat

- **Solusi**: Ubah `color` menjadi warna yang kontras dengan background

**Problem**: CORS error

- **Solusi**: Pastikan gambar di folder `public/` bukan di folder lain

