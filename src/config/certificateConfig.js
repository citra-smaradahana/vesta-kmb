// Konfigurasi Sertifikat - Bisa di-custom sesuai kebutuhan
export const certificateConfig = {
  // Template sertifikat
  template: {
    useTemplate: true, // Set true untuk menggunakan template gambar
    imagePath: "/images/Sertifikat.png", // Path ke template gambar
    // Posisi teks di template (dalam pixel atau persen)
    // Catatan: Posisi ini bisa disesuaikan sesuai template Anda
    // Jarak antar elemen diperbesar agar tidak terlalu rapat
    textPositions: {
      participantName: { x: "50%", y: "33%" }, // Posisi nama peserta
      jabatan: { x: "50%", y: "38%" }, // Posisi jabatan (jarak 7%)
      nrp: { x: "50%", y: "42%" }, // Posisi NRP (jarak 6%)
      trainingTitle: { x: "50%", y: "48%" }, // Posisi training title (jarak 7%)
      quizTitle: { x: "50%", y: "54%" }, // Posisi quiz title (jarak 7%)
      gradeLabel: { x: "50%", y: "59%" }, // Posisi label "Grade"
      gradeValue: { x: "50%", y: "65%" }, // Posisi nilai quiz (jarak 3% dari gradeLabel)
      validLabel: { x: "50cd%", y: "72%" }, // Posisi label "Valid"
      validDate: { x: "50%", y: "75%" }, // Posisi tanggal (jarak 3% dari validLabel)
    },
    // Style teks di template - Ukuran font diperbesar 75% dari sebelumnya
    textStyles: {
      participantName: {
        fontSize: "175px",
        fontWeight: "bold",
        color: "#000000",
        textAlign: "center",
        fontFamily: "Playfair Display, serif",
      },
      jabatan: {
        fontSize: "70px",
        color: "#333333",
        textAlign: "center",
      },
      nrp: {
        fontSize: "70px",
        color: "#333333",
        textAlign: "center",
      },
      trainingTitle: {
        fontSize: "120px",
        fontWeight: "bold",
        color: "#764ba2",
        textAlign: "center",
        fontFamily: "Roboto, sans-serif",
      },
      quizTitle: {
        fontSize: "100px",
        color: "#333333",
        textAlign: "center",
        fontFamily: "Cantata One, serif",
        fontWeight: "bold",
      },
      gradeLabel: {
        fontSize: "65px",
        color: "#000000",
        textAlign: "center",
      },
      gradeValue: {
        fontSize: "175px",
        color: "#000000",
        textAlign: "center",
        fontWeight: "bold",
      },
      validLabel: {
        fontSize: "65px",
        color: "#333333",
        textAlign: "center",
      },
      validDate: {
        fontSize: "65px",
        color: "#333333",
        textAlign: "center",
      },
    },
  },

  // Warna tema sertifikat
  colors: {
    primary: "#667eea", // Warna utama (border, title)
    secondary: "#764ba2", // Warna sekunder (accent)
    text: "#333", // Warna teks utama
    textSecondary: "#666", // Warna teks sekunder
    background: "#ffffff", // Warna background
    backgroundGradient: "#f8f9ff", // Warna background gradient
  },

  // Font
  fonts: {
    title: "Arial, sans-serif",
    body: "Arial, sans-serif",
  },

  // Ukuran font
  fontSizes: {
    logo: "48px",
    title: "36px",
    subtitle: "18px",
    participantName: "32px",
    participantDetails: "14px",
    bodyText: "16px",
    trainingTitle: "24px",
    quizTitle: "18px",
    details: "14px",
    signatureName: "16px",
    signatureTitle: "14px",
  },

  // Border dan padding
  border: {
    width: "5px",
    color: "#667eea",
    radius: "0px", // Border radius untuk sertifikat
    padding: "30px",
  },

  // Logo/Icon
  logo: {
    emoji: "🏆", // Bisa diganti dengan emoji lain atau path ke gambar
    size: "48px",
    useImage: false, // Set true jika ingin menggunakan gambar
    imagePath: "", // Path ke gambar logo jika useImage = true
  },

  // Teks sertifikat (bisa diubah sesuai bahasa/format)
  texts: {
    title: "SERTIFIKAT",
    subtitle: "Sertifikat Penyelesaian Pelatihan",
    statement: "Dengan ini menyatakan bahwa:",
    completion: "telah menyelesaikan pelatihan:",
    // Label untuk Grade (Score)
    gradeLabel: "Grade", // Label yang ditampilkan di baris pertama untuk score

    // Label untuk Valid (Date)
    validLabel: "Valid", // Label yang ditampilkan di baris pertama untuk tanggal
  },

  // Layout
  layout: {
    orientation: "landscape", // 'landscape' atau 'portrait'
    pageSize: "a4", // 'a4', 'letter', dll
    showPercentage: false, // Tampilkan persentase atau tidak
    showJabatan: true, // Tampilkan jabatan atau tidak
    showNRP: true, // Tampilkan NRP atau tidak
  },

  // Signature
  signature: {
    show: false, // Disembunyikan sesuai permintaan user
    name: "",
    title: "",
    position: "right", // 'left', 'center', 'right'
  },
};
