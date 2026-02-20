import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import Modal from "../components/Modal";
import Cropper from 'react-easy-crop';
import "./Page.css";

const InputQuiz = () => {
  const quizTypeOptions = ["Pre Test", "Post Test"];

  // State untuk quiz info
  const [trainingTitle, setTrainingTitle] = useState(""); // Judul pelatihan (dapat diisi)
  const [selectedBaim, setSelectedBaim] = useState(""); // Quiz Title (judul quiz)
  const [selectedQuizType, setSelectedQuizType] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [minimumScore, setMinimumScore] = useState("70"); // Default 70%
  const [questionsToDisplay, setQuestionsToDisplay] = useState(""); // Jumlah soal yang ditampilkan
  const [certificateValidityDays, setCertificateValidityDays] = useState(""); // Masa berlaku sertifikat dalam hari
  const [selectedQuizId, setSelectedQuizId] = useState(null);
  const [targetJabatan, setTargetJabatan] = useState([]); // Array jabatan yang menjadi sasaran quiz
  const [availableJabatan, setAvailableJabatan] = useState([]); // Daftar jabatan yang tersedia dari users
  
  // State untuk card image
  const [cardImage, setCardImage] = useState(null); // File object
  const [cardImagePreview, setCardImagePreview] = useState(null); // Preview URL
  const [cardImageUrl, setCardImageUrl] = useState(""); // URL dari database
  
  // State untuk crop image
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // State untuk soal
  const [questions, setQuestions] = useState([
    { question: "", options: ["", "", "", ""], correctAnswer: 0 },
  ]);

  // State untuk quiz yang sudah ada
  const [existingQuizzes, setExistingQuizzes] = useState([]);
  const [existingQuestions, setExistingQuestions] = useState([]);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  
  // State untuk training titles yang sudah ada
  const [existingTrainingTitles, setExistingTrainingTitles] = useState([]);
  const [showNewTrainingTitleInput, setShowNewTrainingTitleInput] = useState(false);
  
  // State untuk quiz titles yang sudah ada untuk training title yang dipilih
  const [existingQuizTitles, setExistingQuizTitles] = useState([]);
  const [showNewQuizTitleInput, setShowNewQuizTitleInput] = useState(false);
  
  // State untuk filter di mode edit
  const [selectedTrainingTitleForEdit, setSelectedTrainingTitleForEdit] = useState("");
  const [filteredQuizzesForEdit, setFilteredQuizzesForEdit] = useState([]);

  // State untuk UI
  const [mode, setMode] = useState("new"); // 'new' untuk quiz baru, 'edit' untuk edit quiz
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({
    type: "info",
    title: "",
    message: "",
  });
  const bulkExcelInputRef = useRef(null);
  const modalAutoCloseTimerRef = useRef(null);

  const clearModalAutoCloseTimer = () => {
    if (modalAutoCloseTimerRef.current) {
      clearTimeout(modalAutoCloseTimerRef.current);
      modalAutoCloseTimerRef.current = null;
    }
  };

  const closeModal = () => {
    clearModalAutoCloseTimer();
    setShowModal(false);
  };

  // Fetch existing quizzes
  useEffect(() => {
    fetchExistingQuizzes();
    fetchAvailableJabatan();
  }, []);

  // Refresh jabatan setiap 30 detik untuk update dari penambahan akun
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAvailableJabatan();
    }, 30000); // Refresh setiap 30 detik
    return () => clearInterval(interval);
  }, []);

  // Fetch available jabatan from users table
  const fetchAvailableJabatan = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('jabatan')
        .not('jabatan', 'is', null);

      if (error) {
        console.error('Error fetching jabatan:', error);
      } else {
        // Extract unique jabatan
        const uniqueJabatan = [...new Set((data || [])
          .map(u => u.jabatan)
          .filter(Boolean)
          .sort())];
        setAvailableJabatan(uniqueJabatan);
      }
    } catch (err) {
      console.error('Error fetching jabatan:', err);
    }
  };

  const fetchExistingQuizzes = async () => {
    try {
      setLoading(true);
      // Query semua quiz tanpa filter training_title (tanpa card_image_url untuk menghindari error jika kolom belum ada)
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, training_title, quiz_title, quiz_type, questions, time_limit, minimum_score, target_jabatan")
        .order("created_at", { ascending: false });
      
      // Try to select optional columns separately if they exist
      let dataWithDisplay = data;
      if (data && data.length > 0) {
        try {
          // Try to select optional columns (questions_to_display, certificate_validity_days, card_image_url, target_jabatan)
          const { data: dataWithColumn, error: columnError } = await supabase
            .from("quizzes")
            .select("id, questions_to_display, certificate_validity_days, card_image_url, target_jabatan")
            .order("created_at", { ascending: false });
          
          if (!columnError && dataWithColumn) {
            // Merge optional columns into data
            dataWithDisplay = data.map(q => {
              const withColumn = dataWithColumn.find(d => d.id === q.id);
              return { 
                ...q, 
                questions_to_display: withColumn?.questions_to_display || null,
                certificate_validity_days: withColumn?.certificate_validity_days || null,
                card_image_url: withColumn?.card_image_url || null,
                target_jabatan: withColumn?.target_jabatan || null
              };
            });
          } else {
            // If error, set default values for optional columns
          dataWithDisplay = data.map(q => ({ 
            ...q, 
            questions_to_display: null,
            certificate_validity_days: null,
            card_image_url: null,
            target_jabatan: null
          }));
          }
        } catch (err) {
          // Column doesn't exist, continue without it
          console.log("Optional columns not found, continuing without them:", err.message);
          dataWithDisplay = data.map(q => ({ 
            ...q, 
            questions_to_display: null,
            certificate_validity_days: null,
            card_image_url: null,
            target_jabatan: null
          }));
        }
      }

      if (error) {
        console.error("Error fetching quizzes:", error);
        showModalMessage("error", "Error", "Gagal memuat daftar quiz: " + error.message);
        setExistingQuizzes([]);
      } else {
        // Tidak perlu filter, tampilkan semua quiz
        const filteredData = dataWithDisplay || data || [];
        // Sort manual
        filteredData.sort((a, b) => {
          const trainingTitleA = a.training_title || "";
          const trainingTitleB = b.training_title || "";
          if (trainingTitleA !== trainingTitleB) {
            return trainingTitleA.localeCompare(trainingTitleB);
          }
          const titleA = a.quiz_title || "";
          const titleB = b.quiz_title || "";
          if (titleA !== titleB) {
            return titleA.localeCompare(titleB);
          }
          const typeA = a.quiz_type || "";
          const typeB = b.quiz_type || "";
          return typeA.localeCompare(typeB);
        });
        setExistingQuizzes(filteredData);
        
        // Extract unique training titles
        const uniqueTitles = [...new Set((dataWithDisplay || data || [])
          .map(q => q.training_title)
          .filter(Boolean)
          .sort())];
        setExistingTrainingTitles(uniqueTitles);
      }
    } catch (err) {
      console.error("Error:", err);
      showModalMessage("error", "Error", "Terjadi kesalahan saat memuat daftar quiz");
      setExistingQuizzes([]);
    } finally {
      setLoading(false);
    }
  };

  const showModalMessage = (type, title, message, options = {}) => {
    const shouldAutoClose = options.autoClose ?? type === "success";
    const autoCloseMs = options.autoCloseMs ?? 2500;

    clearModalAutoCloseTimer();
    setModalContent({ type, title, message });
    setShowModal(true);

    if (shouldAutoClose) {
      modalAutoCloseTimerRef.current = setTimeout(() => {
        setShowModal(false);
        modalAutoCloseTimerRef.current = null;
      }, autoCloseMs);
    }
  };

  useEffect(() => {
    return () => {
      clearModalAutoCloseTimer();
    };
  }, []);

  const handleSelectQuiz = async (quizId) => {
    const quiz = existingQuizzes.find((q) => q.id === quizId);
    if (quiz) {
      setSelectedQuizId(quiz.id);
      const trainingTitleValue = quiz.training_title || "";
      setTrainingTitle(trainingTitleValue);
      setSelectedBaim(quiz.quiz_title);
      setSelectedTrainingTitleForEdit(trainingTitleValue); // Set filter training title untuk edit mode
      setSelectedQuizType(quiz.quiz_type || "");
      setTimeLimit(quiz.time_limit ? quiz.time_limit.toString() : "");
      setMinimumScore(quiz.minimum_score ? quiz.minimum_score.toString() : "70");
      setQuestionsToDisplay(quiz.questions_to_display ? quiz.questions_to_display.toString() : "");
      setCertificateValidityDays(quiz.certificate_validity_days ? quiz.certificate_validity_days.toString() : "");
      setCardImageUrl(quiz.card_image_url || "");
      setCardImagePreview(quiz.card_image_url || null);
      setCardImage(null);
      setExistingQuestions(Array.isArray(quiz.questions) ? quiz.questions : []);
      setShowNewTrainingTitleInput(false);
      setShowNewQuizTitleInput(false);
      setMode("edit");
      setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0 }]);
      setEditingQuestionIndex(null);
      // Set target jabatan dari quiz
      if (quiz.target_jabatan) {
        setTargetJabatan(Array.isArray(quiz.target_jabatan) ? quiz.target_jabatan : []);
      } else {
        setTargetJabatan([]);
      }
      // Fetch quiz titles untuk training title yang dipilih (untuk display)
      if (trainingTitleValue) {
        await fetchQuizTitlesForTraining(trainingTitleValue);
        // Update filtered quizzes untuk edit mode
        const filteredQuizzes = existingQuizzes.filter(q => q.training_title === trainingTitleValue);
        // Sort by quiz_title, then by quiz_type
        filteredQuizzes.sort((a, b) => {
          const titleA = a.quiz_title || "";
          const titleB = b.quiz_title || "";
          if (titleA !== titleB) {
            return titleA.localeCompare(titleB);
          }
          const typeA = a.quiz_type || "";
          const typeB = b.quiz_type || "";
          return typeA.localeCompare(typeB);
        });
        setFilteredQuizzesForEdit(filteredQuizzes);
        setSelectedTrainingTitleForEdit(trainingTitleValue);
      }
    }
  };

  const handleNewQuiz = () => {
    setSelectedQuizId(null);
    setTrainingTitle("");
    setSelectedBaim("");
    setSelectedQuizType("");
    setTimeLimit("");
    setMinimumScore("70");
    setQuestionsToDisplay("");
    setCertificateValidityDays("");
    setCardImage(null);
    setCardImagePreview(null);
    setCardImageUrl("");
    setExistingQuestions([]);
    setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0 }]);
    setEditingQuestionIndex(null);
    setShowNewTrainingTitleInput(false);
    setShowNewQuizTitleInput(false);
    setExistingQuizTitles([]);
    setSelectedTrainingTitleForEdit("");
    setFilteredQuizzesForEdit([]);
    setTargetJabatan([]);
    setMode("new");
    // Reset file input
    const fileInput = document.getElementById('card-image-input');
    if (fileInput) {
      fileInput.value = '';
    }
  };
  
  // Handler untuk select training title dari dropdown
  const handleTrainingTitleSelect = async (e) => {
    const value = e.target.value;
    if (value === "__NEW__") {
      // User memilih "Tambah Baru..."
      setShowNewTrainingTitleInput(true);
      setTrainingTitle("");
      setExistingQuizTitles([]);
      setSelectedBaim("");
      setShowNewQuizTitleInput(false);
      // Reset foto card karena training title baru
      setCardImageUrl("");
      setCardImagePreview(null);
      setCardImage(null);
    } else {
      setTrainingTitle(value);
      setShowNewTrainingTitleInput(false);
      // Fetch quiz titles yang sudah ada untuk training title ini (termasuk foto card)
      await fetchQuizTitlesForTraining(value);
    }
  };
  
  // Fetch quiz titles untuk training title tertentu
  const fetchQuizTitlesForTraining = async (trainingTitle) => {
    if (!trainingTitle || trainingTitle.trim() === "") {
      setExistingQuizTitles([]);
      setCardImageUrl(""); // Reset foto ketika training title kosong
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select("quiz_title, card_image_url")
        .eq("training_title", trainingTitle)
        .order("quiz_title", { ascending: true });
      
      if (error) {
        console.error("Error fetching quiz titles:", error);
        setExistingQuizTitles([]);
        setCardImageUrl("");
      } else {
        // Extract unique quiz titles
        const uniqueQuizTitles = [...new Set((data || [])
          .map(q => q.quiz_title)
          .filter(Boolean)
          .sort())];
        setExistingQuizTitles(uniqueQuizTitles);
        
        // Ambil foto card dari quiz pertama yang punya card_image_url untuk training title ini
        const quizWithImage = (data || []).find(q => q.card_image_url && q.card_image_url.trim() !== "");
        if (quizWithImage && mode === "new") {
          setCardImageUrl(quizWithImage.card_image_url);
          setCardImagePreview(quizWithImage.card_image_url);
        } else if (mode === "new") {
          setCardImageUrl("");
          setCardImagePreview(null);
        }
        
        // Jika hanya ada 1 quiz title, auto-select
        if (uniqueQuizTitles.length === 1 && mode === "new") {
          setSelectedBaim(uniqueQuizTitles[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching quiz titles:", err);
      setExistingQuizTitles([]);
      setCardImageUrl("");
    }
  };
  
  // Handler untuk select quiz title dari dropdown
  const handleQuizTitleSelect = (e) => {
    const value = e.target.value;
    if (value === "__NEW__") {
      // User memilih "Tambah Baru..."
      setShowNewQuizTitleInput(true);
      setSelectedBaim("");
    } else {
      setSelectedBaim(value);
      setShowNewQuizTitleInput(false);
    }
  };
  
  // Handler untuk toggle jabatan (multi-select)
  const handleToggleJabatan = (jabatan) => {
    setTargetJabatan(prev => {
      if (prev.includes(jabatan)) {
        return prev.filter(j => j !== jabatan);
      } else {
        return [...prev, jabatan];
      }
    });
  };
  
  // Handler untuk select training title di mode edit
  const handleTrainingTitleSelectForEdit = async (e) => {
    const value = e.target.value;
    setSelectedTrainingTitleForEdit(value);
    setFilteredQuizzesForEdit([]);
    setSelectedQuizId(null);
    
    if (value && value.trim() !== "") {
      // Filter quiz berdasarkan training title yang dipilih
      const filteredQuizzes = existingQuizzes.filter(
        q => q.training_title === value
      );
      // Sort by quiz_title, then by quiz_type
      filteredQuizzes.sort((a, b) => {
        const titleA = a.quiz_title || "";
        const titleB = b.quiz_title || "";
        if (titleA !== titleB) {
          return titleA.localeCompare(titleB);
        }
        const typeA = a.quiz_type || "";
        const typeB = b.quiz_type || "";
        return typeA.localeCompare(typeB);
      });
      setFilteredQuizzesForEdit(filteredQuizzes);
    }
  };
  
  // Handler untuk select quiz di mode edit (menggunakan quiz.id)
  const handleQuizSelectForEdit = async (e) => {
    const quizId = parseInt(e.target.value);
    if (!quizId || !selectedTrainingTitleForEdit) {
      setSelectedQuizId(null);
      return;
    }
    
    // Cari quiz berdasarkan ID
    const quiz = existingQuizzes.find(q => q.id === quizId);
    
    if (quiz) {
      await handleSelectQuiz(quiz.id);
    }
  };
  
  // Effect untuk fetch quiz titles ketika training title berubah (hanya untuk mode new)
  useEffect(() => {
    if (trainingTitle && trainingTitle.trim() !== "" && mode === "new" && !showNewTrainingTitleInput) {
      fetchQuizTitlesForTraining(trainingTitle);
    } else if (!trainingTitle || trainingTitle.trim() === "") {
      setExistingQuizTitles([]);
      setSelectedBaim("");
      setShowNewQuizTitleInput(false);
      // Reset foto card ketika training title kosong (hanya di mode new)
      if (mode === "new") {
        setCardImageUrl("");
        setCardImagePreview(null);
        setCardImage(null);
      }
    }
  }, [trainingTitle, mode, showNewTrainingTitleInput]);
  
  // Handler untuk klik foto untuk upload baru
  const handleImageClick = () => {
    const fileInput = document.getElementById('card-image-input');
    if (fileInput) {
      fileInput.click();
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question: "", options: ["", "", "", ""], correctAnswer: 0 },
    ]);
  };

  const downloadBulkTemplate = async () => {
    try {
      const XLSXModule = await import("xlsx");
      const XLSX = XLSXModule.default || XLSXModule;

      const templateRows = [
        {
          question: "Apa kepanjangan K3?",
          option_1: "Keselamatan dan Kesehatan Kerja",
          option_2: "Keamanan dan Kualitas Kerja",
          option_3: "Keselamatan Kerja dan Kinerja",
          option_4: "Kesehatan Kerja dan Kinerja",
          correct_answer: 1,
          explanation: "K3 adalah Keselamatan dan Kesehatan Kerja."
        },
        {
          question: "APD wajib digunakan ketika?",
          option_1: "Saat bekerja di area berisiko",
          option_2: "Saat istirahat",
          option_3: "Saat rapat",
          option_4: "Saat makan siang",
          correct_answer: 1,
          explanation: ""
        }
      ];

      const instructionRows = [
        {
          aturan: "Isi 1 baris = 1 soal.",
          keterangan: "Gunakan sheet bernama Questions."
        },
        {
          aturan: "Kolom wajib: question, option_1..option_4, correct_answer.",
          keterangan: "correct_answer harus angka 1 sampai 4."
        },
        {
          aturan: "Kolom explanation opsional.",
          keterangan: "Abaikan jika tidak dibutuhkan."
        }
      ];

      const wb = XLSX.utils.book_new();
      const wsQuestions = XLSX.utils.json_to_sheet(templateRows);
      const wsInstructions = XLSX.utils.json_to_sheet(instructionRows);

      XLSX.utils.book_append_sheet(wb, wsQuestions, "Questions");
      XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
      XLSX.writeFile(wb, "Template_Bulk_Soal_Quiz.xlsx");
    } catch (err) {
      console.error("Error creating bulk template:", err);
      showModalMessage("error", "Error", "Gagal membuat template Excel. Silakan coba lagi.");
    }
  };

  const triggerBulkUpload = () => {
    bulkExcelInputRef.current?.click();
  };

  const normalizeBulkRow = (row) => {
    const normalized = {};
    Object.keys(row || {}).forEach((key) => {
      const normalizedKey = key.toString().trim().toLowerCase();
      normalized[normalizedKey] = row[key];
    });
    return normalized;
  };

  const parseBulkCorrectAnswer = (value) => {
    if (value === null || value === undefined || value === "") return NaN;
    const parsed = parseInt(String(value).trim(), 10);
    return Number.isNaN(parsed) ? NaN : parsed;
  };

  const handleBulkExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const XLSXModule = await import("xlsx");
      const XLSX = XLSXModule.default || XLSXModule;
      const fileBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { type: "array" });
      const sheetName = workbook.SheetNames.includes("Questions")
        ? "Questions"
        : workbook.SheetNames[0];

      if (!sheetName) {
        showModalMessage("error", "Validasi Error", "File Excel tidak memiliki sheet yang bisa dibaca.");
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (!rows || rows.length === 0) {
        showModalMessage("error", "Validasi Error", "Template kosong. Silakan isi minimal 1 soal.");
        return;
      }

      const parsedQuestions = [];
      const errors = [];

      rows.forEach((row, idx) => {
        const rowNumber = idx + 2;
        const normalized = normalizeBulkRow(row);

        const questionText = String(normalized.question || "").trim();
        const option1 = String(normalized.option_1 || "").trim();
        const option2 = String(normalized.option_2 || "").trim();
        const option3 = String(normalized.option_3 || "").trim();
        const option4 = String(normalized.option_4 || "").trim();
        const parsedCorrect = parseBulkCorrectAnswer(normalized.correct_answer);

        if (!questionText) {
          errors.push(`Baris ${rowNumber}: question wajib diisi.`);
          return;
        }

        const options = [option1, option2, option3, option4];
        if (options.some((opt) => !opt)) {
          errors.push(`Baris ${rowNumber}: option_1 sampai option_4 wajib diisi.`);
          return;
        }

        if (parsedCorrect < 1 || parsedCorrect > 4) {
          errors.push(`Baris ${rowNumber}: correct_answer harus angka 1-4.`);
          return;
        }

        parsedQuestions.push({
          question: questionText,
          options,
          correctAnswer: parsedCorrect - 1
        });
      });

      if (errors.length > 0) {
        const previewErrors = errors.slice(0, 5).join("\n");
        const suffix = errors.length > 5 ? `\n...dan ${errors.length - 5} error lainnya.` : "";
        showModalMessage(
          "error",
          "Validasi Bulk Upload Gagal",
          `${previewErrors}${suffix}`
        );
        return;
      }

      if (parsedQuestions.length === 0) {
        showModalMessage("error", "Validasi Error", "Tidak ada soal valid di file Excel.");
        return;
      }

      const isDefaultSingleEmpty =
        questions.length === 1 &&
        !questions[0].question.trim() &&
        questions[0].options.every((opt) => !opt.trim());

      const mergedQuestions = isDefaultSingleEmpty
        ? parsedQuestions
        : [...questions, ...parsedQuestions];

      setQuestions(mergedQuestions);
      showModalMessage(
        "success",
        "Bulk Upload Berhasil",
        `${parsedQuestions.length} soal berhasil dimuat dari Excel.`
      );
    } catch (err) {
      console.error("Error processing bulk Excel upload:", err);
      showModalMessage(
        "error",
        "Error",
        "Gagal membaca file Excel. Pastikan format sesuai template."
      );
    } finally {
      e.target.value = "";
    }
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    const updated = [...questions];
    updated[questionIndex].options[optionIndex] = value;
    setQuestions(updated);
  };

  const handleEditExistingQuestion = (questionIndex) => {
    const question = existingQuestions[questionIndex];
    if (question) {
      const questionCopy = {
        question: question.question,
        options: [...question.options],
        correctAnswer: question.correctAnswer,
      };
      setQuestions([questionCopy]);
      setEditingQuestionIndex(questionIndex);
      // Scroll to form
      setTimeout(() => {
        document.querySelector(".questions-section")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const handleUpdateExistingQuestion = async () => {
    if (editingQuestionIndex === null || !selectedQuizId) return;

    const question = questions[0];
    if (!question.question.trim() || question.options.some((opt) => !opt.trim())) {
      showModalMessage("error", "Validasi Error", "Mohon lengkapi pertanyaan dan semua pilihan jawaban!");
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedQuestions = [...existingQuestions];
      updatedQuestions[editingQuestionIndex] = question;

      const { error } = await supabase
        .from("quizzes")
        .update({ questions: updatedQuestions })
        .eq("id", selectedQuizId);

      if (error) {
        showModalMessage("error", "Error", "Gagal mengupdate soal: " + error.message);
      } else {
        showModalMessage("success", "Berhasil", "Soal berhasil diupdate!");
        setExistingQuestions(updatedQuestions);
        setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0 }]);
        setEditingQuestionIndex(null);
        fetchExistingQuizzes();
      }
    } catch (err) {
      showModalMessage("error", "Error", "Terjadi kesalahan saat mengupdate soal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExistingQuestion = async (questionIndex) => {
    if (!selectedQuizId) return;

    const question = existingQuestions[questionIndex];
    if (!question) return;

    setModalContent({
      type: "confirm",
      title: "Hapus Soal",
      message: `Apakah Anda yakin ingin menghapus soal:\n"${question.question}"\n\nTindakan ini tidak dapat dibatalkan!`,
    });
    setShowModal(true);

    // Store question index for deletion
    const deleteQuestion = async () => {
      try {
        const updatedQuestions = existingQuestions.filter((_, index) => index !== questionIndex);

        const { error } = await supabase
          .from("quizzes")
          .update({ questions: updatedQuestions })
          .eq("id", selectedQuizId);

        if (error) {
          showModalMessage("error", "Error", "Gagal menghapus soal: " + error.message);
        } else {
          showModalMessage("success", "Berhasil", "Soal berhasil dihapus!");
          setExistingQuestions(updatedQuestions);
          fetchExistingQuizzes();
        }
      } catch (err) {
        showModalMessage("error", "Error", "Terjadi kesalahan saat menghapus soal");
      }
    };

    // We'll handle this in modal confirm
    window.deleteQuestionConfirm = deleteQuestion;
  };

  // Fungsi untuk upload card image ke Supabase Storage
  const uploadCardImageToStorage = async (file, quizId) => {
    try {
      // Generate unique filename
      const fileName = quizId 
        ? `training-card-${quizId}-${Date.now()}.${file.name.split('.').pop()}`
        : `training-card-${Date.now()}.${file.name.split('.').pop()}`;
      const filePath = `training-cards/${fileName}`;

      // Upload to Supabase Storage (bucket: training-cards, atau gunakan user-photos jika belum ada bucket)
      const { data, error } = await supabase.storage
        .from('user-photos') // Sementara gunakan bucket yang sama, bisa dibuat bucket baru nanti
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (error) {
        console.error('Error uploading card image:', error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-photos')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error in uploadCardImageToStorage:', error);
      throw error;
    }
  };

  // Handler untuk select image
  // Helper functions untuk crop
  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    // Set canvas size to match cropped area (1:1)
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCardImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showModalMessage('error', 'Error', 'File harus berupa gambar!');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showModalMessage('error', 'Error', 'Ukuran file maksimal 5MB!');
        return;
      }
      // Buka modal crop
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result);
        setShowCropModal(true);
      });
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleCropComplete = async () => {
    try {
      if (!croppedAreaPixels || !imageSrc) return;

      // Get cropped blob
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      
      // Convert blob to File object
      const croppedFile = new File([croppedBlob], 'card-image.jpg', { type: 'image/jpeg' });
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(croppedBlob);
      
      // Set state
      setCardImage(croppedFile);
      setCardImagePreview(previewUrl);
      
      // Close modal
      setShowCropModal(false);
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch (error) {
      console.error('Error cropping image:', error);
      showModalMessage('error', 'Error', 'Gagal memproses foto: ' + error.message);
    }
  };

  // Handler untuk remove image
  const handleRemoveCardImage = () => {
    setCardImage(null);
    setCardImagePreview(null);
    if (mode === "new") {
      setCardImageUrl("");
    }
    // Reset file input
    const fileInput = document.getElementById('card-image-input');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleDeleteQuiz = () => {
    if (!selectedQuizId) {
      console.log("No quiz selected");
      return;
    }

    const selectedQuiz = existingQuizzes.find((q) => q.id === selectedQuizId);
    if (!selectedQuiz) {
      console.log("Quiz not found");
      return;
    }

    console.log("Setting up delete quiz modal for:", selectedQuiz.quiz_title);

    setModalContent({
      type: "confirm",
      title: "Hapus Quiz",
      message: `Apakah Anda yakin ingin menghapus quiz:\n"${selectedQuiz.quiz_title} - ${selectedQuiz.quiz_type}"\n\nSemua soal dan data quiz ini akan dihapus permanen!\nTindakan ini tidak dapat dibatalkan!`,
    });
    setShowModal(true);

    // Store delete function
    const deleteQuiz = async () => {
      try {
        console.log("Deleting quiz with ID:", selectedQuizId);
        setIsSubmitting(true);
        const { error } = await supabase
          .from("quizzes")
          .delete()
          .eq("id", selectedQuizId);

        if (error) {
          console.error("Error deleting quiz:", error);
          showModalMessage("error", "Error", "Gagal menghapus quiz: " + error.message);
        } else {
          console.log("Quiz deleted successfully");
          showModalMessage("success", "Berhasil", "Quiz berhasil dihapus!");
          // Reset form
          setSelectedQuizId(null);
          setTrainingTitle("");
          setSelectedBaim("");
          setSelectedQuizType("");
          setTimeLimit("");
          setMinimumScore("70");
          setCertificateValidityDays("");
          setCardImage(null);
          setCardImagePreview(null);
          setCardImageUrl("");
          setExistingQuestions([]);
          setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0 }]);
          setEditingQuestionIndex(null);
          fetchExistingQuizzes();
        }
      } catch (err) {
        console.error("Exception deleting quiz:", err);
        showModalMessage("error", "Error", "Terjadi kesalahan saat menghapus quiz");
      } finally {
        setIsSubmitting(false);
      }
    };

    // Store for modal confirm
    window.deleteQuizConfirm = deleteQuiz;
    console.log("Delete quiz function stored");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validasi
      if (!trainingTitle || !trainingTitle.trim()) {
        showModalMessage("error", "Validasi Error", "Mohon isi Judul Pelatihan!");
        setIsSubmitting(false);
        return;
      }

      if (!selectedBaim || !selectedBaim.trim()) {
        showModalMessage("error", "Validasi Error", "Mohon isi Judul Quiz!");
        setIsSubmitting(false);
        return;
      }

      if (!selectedQuizType) {
        showModalMessage("error", "Validasi Error", "Mohon pilih Tipe Quiz!");
        setIsSubmitting(false);
        return;
      }

      if (questions.length === 0) {
        showModalMessage("error", "Validasi Error", "Mohon tambahkan minimal 1 pertanyaan!");
        setIsSubmitting(false);
        return;
      }

      // Validasi semua pertanyaan
      const allQuestionsValid = questions.every(
        (q) => q.question.trim() !== "" && q.options.every((opt) => opt.trim() !== "")
      );

      if (!allQuestionsValid) {
        showModalMessage("error", "Validasi Error", "Mohon lengkapi semua pertanyaan dan pilihan jawaban!");
        setIsSubmitting(false);
        return;
      }

      if (mode === "edit" && selectedQuizId) {
        // Update quiz yang sudah ada - tambahkan soal baru
        const quiz = existingQuizzes.find((q) => q.id === selectedQuizId);
        if (quiz) {
          const existingQuestions = Array.isArray(quiz.questions) ? quiz.questions : [];
          const updatedQuestions = [...existingQuestions, ...questions];

          // Upload card image jika ada gambar baru
          let uploadedImageUrl = cardImageUrl;
          if (cardImage) {
            try {
              uploadedImageUrl = await uploadCardImageToStorage(cardImage, selectedQuizId);
            } catch (error) {
              showModalMessage("error", "Error", "Gagal mengupload foto card: " + error.message);
              setIsSubmitting(false);
              return;
            }
          }

          const updateData = {
            questions: updatedQuestions,
          };

          if (timeLimit) {
            updateData.time_limit = parseInt(timeLimit);
          }

          if (minimumScore) {
            const parsedScore = parseInt(minimumScore);
            if (!isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100) {
              updateData.minimum_score = parsedScore;
            }
          }
          if (questionsToDisplay) {
            const parsedDisplay = parseInt(questionsToDisplay);
            if (!isNaN(parsedDisplay) && parsedDisplay > 0) {
              updateData.questions_to_display = parsedDisplay;
            }
          }
          if (uploadedImageUrl) {
            updateData.card_image_url = uploadedImageUrl;
          }
          
          // Tambahkan target_jabatan jika ada
          if (targetJabatan.length > 0) {
            updateData.target_jabatan = targetJabatan;
          } else {
            updateData.target_jabatan = null;
          }

          const { error } = await supabase
            .from("quizzes")
            .update(updateData)
            .eq("id", selectedQuizId);

          if (error) {
            showModalMessage("error", "Error", "Gagal menambahkan soal: " + error.message);
          } else {
            showModalMessage("success", "Berhasil", `Berhasil menambahkan ${questions.length} soal!`);
            setExistingQuestions(updatedQuestions);
            if (uploadedImageUrl) {
              setCardImageUrl(uploadedImageUrl);
              setCardImagePreview(uploadedImageUrl);
            }
            setCardImage(null);
            setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0 }]);
            fetchExistingQuizzes();
          }
        }
      } else {
        // Cek apakah quiz dengan training_title, quiz_title dan tipe yang sama sudah ada
        const { data: existingQuizData, error: checkError } = await supabase
          .from("quizzes")
          .select("*")
          .eq("training_title", trainingTitle.trim())
          .eq("quiz_title", selectedBaim.trim())
          .eq("quiz_type", selectedQuizType)
          .maybeSingle();

        const existingQuiz = existingQuizData && !checkError ? existingQuizData : null;

        if (existingQuiz) {
          // Quiz sudah ada, tambahkan soal ke quiz tersebut
          const existingQuestions = Array.isArray(existingQuiz.questions) ? existingQuiz.questions : [];
          const updatedQuestions = [...existingQuestions, ...questions];

          // Upload card image jika ada gambar baru
          let uploadedImageUrl = existingQuiz.card_image_url || cardImageUrl;
          if (cardImage) {
            try {
              uploadedImageUrl = await uploadCardImageToStorage(cardImage, existingQuiz.id);
            } catch (error) {
              showModalMessage("error", "Error", "Gagal mengupload foto card: " + error.message);
              setIsSubmitting(false);
              return;
            }
          }

          const updateData = {
            questions: updatedQuestions,
            training_title: trainingTitle.trim(),
          };

          if (timeLimit) {
            updateData.time_limit = parseInt(timeLimit);
          }

          if (minimumScore) {
            const parsedScore = parseInt(minimumScore);
            if (!isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100) {
              updateData.minimum_score = parsedScore;
            }
          }
          if (questionsToDisplay) {
            const parsedDisplay = parseInt(questionsToDisplay);
            if (!isNaN(parsedDisplay) && parsedDisplay > 0) {
              updateData.questions_to_display = parsedDisplay;
            }
          }
          if (certificateValidityDays) {
            const parsedDays = parseInt(certificateValidityDays);
            if (!isNaN(parsedDays) && parsedDays > 0) {
              updateData.certificate_validity_days = parsedDays;
            }
          }
          if (uploadedImageUrl) {
            updateData.card_image_url = uploadedImageUrl;
          }
          
          // Tambahkan target_jabatan jika ada
          if (targetJabatan.length > 0) {
            updateData.target_jabatan = targetJabatan;
          } else {
            updateData.target_jabatan = null;
          }

          const { error } = await supabase
            .from("quizzes")
            .update(updateData)
            .eq("id", existingQuiz.id);

          if (error) {
            showModalMessage("error", "Error", "Gagal menambahkan soal: " + error.message);
          } else {
            showModalMessage("success", "Berhasil", `Berhasil menambahkan ${questions.length} soal ke quiz yang sudah ada!`);
            setSelectedQuizId(existingQuiz.id);
            setExistingQuestions(updatedQuestions);
            setCardImageUrl(uploadedImageUrl);
            setCardImagePreview(uploadedImageUrl || null);
            setCardImage(null);
            setShowNewTrainingTitleInput(false);
            setShowNewQuizTitleInput(false);
            setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0 }]);
            setMode("edit");
            // Set target jabatan dari existing quiz
            if (existingQuiz.target_jabatan) {
              setTargetJabatan(Array.isArray(existingQuiz.target_jabatan) ? existingQuiz.target_jabatan : []);
            } else {
              setTargetJabatan([]);
            }
            // Fetch quizzes untuk update dropdown training titles dan quiz titles
            await fetchExistingQuizzes();
            // Refresh quiz titles untuk training title yang dipilih
            if (trainingTitle && trainingTitle.trim() !== "") {
              await fetchQuizTitlesForTraining(trainingTitle);
            }
          }
        } else {
          // Buat quiz baru
          // Upload card image jika ada
          let uploadedImageUrl = cardImageUrl;
          if (cardImage) {
            try {
              // Upload image, tapi belum ada quiz ID, jadi gunakan timestamp
              uploadedImageUrl = await uploadCardImageToStorage(cardImage, null);
            } catch (error) {
              showModalMessage("error", "Error", "Gagal mengupload foto card: " + error.message);
              setIsSubmitting(false);
              return;
            }
          }

          const insertData = {
            training_title: trainingTitle.trim(),
            quiz_title: selectedBaim.trim(),
            questions: questions,
          };

          // Hanya tambahkan quiz_type jika kolomnya ada di database
          if (selectedQuizType) {
            insertData.quiz_type = selectedQuizType;
          }

          // Hanya tambahkan time_limit jika ada nilai
          if (timeLimit && timeLimit.trim() !== "") {
            const parsedTime = parseInt(timeLimit);
            if (!isNaN(parsedTime) && parsedTime > 0) {
              insertData.time_limit = parsedTime;
            }
          }

          // Tambahkan minimum_score
          if (minimumScore && minimumScore.trim() !== "") {
            const parsedScore = parseInt(minimumScore);
            if (!isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100) {
              insertData.minimum_score = parsedScore;
            }
          }

          // Tambahkan questions_to_display
          if (questionsToDisplay && questionsToDisplay.trim() !== "") {
            const parsedDisplay = parseInt(questionsToDisplay);
            if (!isNaN(parsedDisplay) && parsedDisplay > 0) {
              insertData.questions_to_display = parsedDisplay;
            }
          }

          // Tambahkan certificate_validity_days
          if (certificateValidityDays && certificateValidityDays.trim() !== "") {
            const parsedDays = parseInt(certificateValidityDays);
            if (!isNaN(parsedDays) && parsedDays > 0) {
              insertData.certificate_validity_days = parsedDays;
            }
          }

          // Tambahkan card_image_url jika ada
          if (uploadedImageUrl) {
            insertData.card_image_url = uploadedImageUrl;
          }
          
          // Tambahkan target_jabatan jika ada
          if (targetJabatan.length > 0) {
            insertData.target_jabatan = targetJabatan;
          }

          const { data, error } = await supabase
            .from("quizzes")
            .insert([insertData])
            .select();

          if (error) {
            showModalMessage("error", "Error", "Gagal menyimpan quiz: " + error.message);
          } else {
            showModalMessage("success", "Berhasil", "Quiz berhasil dibuat!");
            const newQuizId = data[0].id;
            
            // Re-upload image dengan quiz ID yang benar jika perlu
            if (cardImage && uploadedImageUrl) {
              try {
                const newImageUrl = await uploadCardImageToStorage(cardImage, newQuizId);
                // Update quiz dengan URL yang benar
                await supabase
                  .from("quizzes")
                  .update({ card_image_url: newImageUrl })
                  .eq("id", newQuizId);
                setCardImageUrl(newImageUrl);
              } catch (error) {
                console.error("Error re-uploading image with quiz ID:", error);
              }
            }
            
            setSelectedQuizId(newQuizId);
            setExistingQuestions(questions);
            setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0 }]);
            setCardImage(null);
            setCardImagePreview(uploadedImageUrl || null);
            setShowNewTrainingTitleInput(false);
            setShowNewQuizTitleInput(false);
            setMode("edit");
            // Set target jabatan dari quiz yang baru dibuat
            if (data && data[0] && data[0].target_jabatan) {
              setTargetJabatan(Array.isArray(data[0].target_jabatan) ? data[0].target_jabatan : []);
            } else {
              setTargetJabatan([]);
            }
            // Fetch quizzes untuk update dropdown training titles dan quiz titles
            await fetchExistingQuizzes();
            // Refresh quiz titles untuk training title yang dipilih
            if (trainingTitle && trainingTitle.trim() !== "") {
              await fetchQuizTitlesForTraining(trainingTitle);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error:", err);
      showModalMessage("error", "Error", "Terjadi kesalahan saat menyimpan quiz");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTimeLimit = async () => {
    if (!selectedQuizId) {
      showModalMessage("error", "Error", "Pilih quiz terlebih dahulu!");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({
          time_limit: timeLimit ? parseInt(timeLimit) : null,
        })
        .eq("id", selectedQuizId);

      if (error) {
        showModalMessage("error", "Error", "Gagal mengupdate waktu: " + error.message);
      } else {
        showModalMessage("success", "Berhasil", "Waktu quiz berhasil diupdate!");
        fetchExistingQuizzes();
      }
    } catch (err) {
      showModalMessage("error", "Error", "Terjadi kesalahan saat mengupdate waktu");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateQuestionsToDisplay = async () => {
    if (!selectedQuizId) {
      showModalMessage("error", "Error", "Pilih quiz terlebih dahulu!");
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedDisplay = questionsToDisplay ? parseInt(questionsToDisplay) : null;
      if (questionsToDisplay && (isNaN(parsedDisplay) || parsedDisplay <= 0)) {
        showModalMessage("error", "Validasi Error", "Jumlah soal yang ditampilkan harus angka positif!");
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from("quizzes")
        .update({ questions_to_display: parsedDisplay })
        .eq("id", selectedQuizId);

      if (error) {
        showModalMessage("error", "Error", "Gagal mengupdate jumlah soal yang ditampilkan: " + error.message);
      } else {
        showModalMessage("success", "Berhasil", "Jumlah soal yang ditampilkan berhasil diupdate!");
        fetchExistingQuizzes();
      }
    } catch (err) {
      showModalMessage("error", "Error", "Terjadi kesalahan saat mengupdate jumlah soal yang ditampilkan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMinimumScore = async () => {
    if (!selectedQuizId) {
      showModalMessage("error", "Error", "Pilih quiz terlebih dahulu!");
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedScore = parseInt(minimumScore, 10);
      if (minimumScore === "" || isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100) {
        showModalMessage("error", "Validasi Error", "Minimum nilai lulus harus angka 0-100!");
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from("quizzes")
        .update({ minimum_score: parsedScore })
        .eq("id", selectedQuizId);

      if (error) {
        showModalMessage("error", "Error", "Gagal mengupdate minimum nilai lulus: " + error.message);
      } else {
        showModalMessage("success", "Berhasil", "Minimum nilai lulus berhasil diupdate!");
        fetchExistingQuizzes();
      }
    } catch (err) {
      showModalMessage("error", "Error", "Terjadi kesalahan saat mengupdate minimum nilai lulus");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCertificateValidityDays = async () => {
    if (!selectedQuizId) {
      showModalMessage("error", "Error", "Pilih quiz terlebih dahulu!");
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedDays = certificateValidityDays ? parseInt(certificateValidityDays) : null;
      if (certificateValidityDays && (isNaN(parsedDays) || parsedDays <= 0)) {
        showModalMessage("error", "Validasi Error", "Masa berlaku sertifikat harus angka positif!");
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from("quizzes")
        .update({ certificate_validity_days: parsedDays })
        .eq("id", selectedQuizId);

      if (error) {
        showModalMessage("error", "Error", "Gagal mengupdate masa berlaku sertifikat: " + error.message);
      } else {
        showModalMessage("success", "Berhasil", "Masa berlaku sertifikat berhasil diupdate!");
        fetchExistingQuizzes();
      }
    } catch (err) {
      showModalMessage("error", "Error", "Terjadi kesalahan saat mengupdate masa berlaku sertifikat");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalConfirm = () => {
    console.log("Modal confirm clicked, type:", modalContent.type);
    if (modalContent.type === "confirm") {
      if (window.deleteQuestionConfirm) {
        console.log("Executing deleteQuestionConfirm");
        window.deleteQuestionConfirm();
        window.deleteQuestionConfirm = null;
      }
      if (window.deleteQuizConfirm) {
        console.log("Executing deleteQuizConfirm");
        window.deleteQuizConfirm();
        window.deleteQuizConfirm = null;
      }
    }
    closeModal();
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <h1 className="page-title">Input Quiz</h1>

        <div className="quiz-management-container">
          {/* Mode Selector */}
          <div className="form-section">
            <div className="section-title">
              <span className="section-icon">📋</span>
              <h2>Mode</h2>
            </div>
            <div className="mode-selector">
              <button
                type="button"
                onClick={handleNewQuiz}
                className={`mode-button ${mode === "new" ? "active" : ""}`}
              >
                <span className="mode-icon">➕</span>
                Quiz Baru
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("edit");
                  // Reset filter state saat switch ke edit mode
                  setSelectedTrainingTitleForEdit("");
                  setFilteredQuizzesForEdit([]);
                  setSelectedQuizId(null);
                  setTargetJabatan([]);
                }}
                className={`mode-button ${mode === "edit" ? "active" : ""}`}
              >
                <span className="mode-icon">✏️</span>
                Edit Quiz
              </button>
            </div>
          </div>

          {/* Select Quiz untuk Edit Mode */}
          {mode === "edit" && (
            <div className="form-section">
              <div className="section-title">
                <span className="section-icon">📚</span>
                <h2>Pilih Quiz untuk Diedit</h2>
              </div>
              <div className="form-row">
                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">🎓</span>
                    Judul Pelatihan
                  </label>
                  <select
                    value={selectedTrainingTitleForEdit || ""}
                    onChange={handleTrainingTitleSelectForEdit}
                    className="input-modern select-modern"
                  >
                    <option value="">Pilih Judul Pelatihan</option>
                    {existingTrainingTitles.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                  <small className="form-hint">Pilih judul pelatihan terlebih dahulu</small>
                </div>
                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">📝</span>
                    Judul Quiz
                  </label>
                  <select
                    value={selectedQuizId || ""}
                    onChange={handleQuizSelectForEdit}
                    disabled={!selectedTrainingTitleForEdit || filteredQuizzesForEdit.length === 0}
                    className="input-modern select-modern"
                  >
                    <option value="">Pilih Judul Quiz</option>
                    {filteredQuizzesForEdit.map((quiz) => {
                      const questionCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
                      return (
                        <option key={quiz.id} value={quiz.id}>
                          {quiz.quiz_title} - {quiz.quiz_type || ''} ({questionCount} soal)
                        </option>
                      );
                    })}
                  </select>
                  <small className="form-hint">
                    {!selectedTrainingTitleForEdit 
                      ? "Pilih Judul Pelatihan terlebih dahulu"
                      : filteredQuizzesForEdit.length === 0
                      ? "Tidak ada quiz untuk pelatihan ini"
                      : "Pilih judul quiz yang ingin diedit"}
                  </small>
                </div>
              </div>

              {/* Info Quiz yang Dipilih */}
              {mode === "edit" && selectedQuizId && (
                <div className="selected-quiz-info" style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  color: 'white',
                  marginTop: '1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Quiz yang Dipilih:</h3>
                    <button
                      type="button"
                      onClick={handleDeleteQuiz}
                      disabled={isSubmitting}
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSubmitting) {
                          e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                      }}
                    >
                      🗑️ Hapus Quiz
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
                      {(() => {
                        // Format display: split jika ada "INTRODUCTION"
                        if (selectedBaim.includes('INTRODUCTION')) {
                          const parts = selectedBaim.split(' INTRODUCTION');
                          return (
                            <>
                              <span>{parts[0]}</span>
                              <br />
                              <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>
                                INTRODUCTION{parts[1] || ''}
                              </span>
                            </>
                          );
                        }
                        return selectedBaim;
                      })()}
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
                      {selectedQuizType} • Minimum Score: {minimumScore}%
                      {timeLimit && ` • Waktu: ${timeLimit} menit`}
                      {questionsToDisplay && ` • Tampilkan: ${questionsToDisplay} soal`}
                      {!questionsToDisplay && existingQuestions.length > 0 && ` • Total: ${existingQuestions.length} soal (semua ditampilkan)`}
                      {certificateValidityDays && ` • Masa berlaku sertifikat: ${certificateValidityDays} hari`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Quiz Info */}
          <form onSubmit={handleSubmit} className="quiz-form-modern">
            <div className="form-section">
              <div className="section-title">
                <span className="section-icon">📋</span>
                <h2>Informasi Quiz</h2>
              </div>

              <div className="form-row">
                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">🎓</span>
                    Judul Pelatihan
                  </label>
                  {showNewTrainingTitleInput ? (
                    <>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <input
                          type="text"
                          value={trainingTitle}
                          onChange={(e) => setTrainingTitle(e.target.value)}
                          placeholder="Masukkan judul pelatihan baru"
                          required={mode === "new"}
                          disabled={mode === "edit" && selectedQuizId}
                          className="input-modern"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewTrainingTitleInput(false);
                            setTrainingTitle("");
                          }}
                          className="btn-update-time"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          Batal
                        </button>
                      </div>
                      <small className="form-hint">Masukkan judul pelatihan baru (contoh: BAIM, Safety Training, dll)</small>
                    </>
                  ) : (
                    <>
                      <select
                        value={trainingTitle || ""}
                        onChange={handleTrainingTitleSelect}
                        required={mode === "new"}
                        disabled={mode === "edit" && selectedQuizId}
                        className="input-modern select-modern"
                      >
                        <option value="">Pilih Judul Pelatihan</option>
                        {existingTrainingTitles.map((title) => (
                          <option key={title} value={title}>
                            {title}
                          </option>
                        ))}
                        {mode === "new" && <option value="__NEW__">➕ Tambah Baru...</option>}
                      </select>
                      <small className="form-hint">Pilih judul pelatihan yang sudah ada atau tambah baru</small>
                    </>
                  )}
                </div>

                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">📝</span>
                    Judul Quiz
                  </label>
                  {!trainingTitle || trainingTitle.trim() === "" ? (
                    <>
                      <input
                        type="text"
                        value={selectedBaim}
                        onChange={(e) => setSelectedBaim(e.target.value)}
                        placeholder="Pilih Judul Pelatihan terlebih dahulu"
                        required={mode === "new"}
                        disabled={true}
                        className="input-modern"
                        style={{ background: "#f3f4f6", cursor: "not-allowed" }}
                      />
                      <small className="form-hint">Pilih Judul Pelatihan terlebih dahulu</small>
                    </>
                  ) : showNewQuizTitleInput ? (
                    <>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <input
                          type="text"
                          value={selectedBaim}
                          onChange={(e) => setSelectedBaim(e.target.value)}
                          placeholder="Masukkan judul quiz baru"
                          required={mode === "new"}
                          disabled={mode === "edit" && selectedQuizId}
                          className="input-modern"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewQuizTitleInput(false);
                            setSelectedBaim("");
                          }}
                          className="btn-update-time"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          Batal
                        </button>
                      </div>
                      <small className="form-hint">Masukkan judul quiz baru untuk pelatihan "{trainingTitle}"</small>
                    </>
                  ) : existingQuizTitles.length > 0 ? (
                    <>
                      <select
                        value={selectedBaim || ""}
                        onChange={handleQuizTitleSelect}
                        required={mode === "new"}
                        disabled={mode === "edit" && selectedQuizId}
                        className="input-modern select-modern"
                      >
                        <option value="">Pilih Judul Quiz</option>
                        {existingQuizTitles.map((quizTitle) => (
                          <option key={quizTitle} value={quizTitle}>
                            {quizTitle}
                          </option>
                        ))}
                        {mode === "new" && <option value="__NEW__">➕ Tambah Baru...</option>}
                      </select>
                      <small className="form-hint">Pilih judul quiz yang sudah ada atau tambah baru untuk pelatihan "{trainingTitle}"</small>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={selectedBaim}
                        onChange={(e) => setSelectedBaim(e.target.value)}
                        placeholder="Contoh: BAIM 1 INTRODUCTION TO EXPLOSIVE"
                        required={mode === "new"}
                        disabled={mode === "edit" && selectedQuizId}
                        className="input-modern"
                      />
                      <small className="form-hint">Masukkan judul quiz baru untuk pelatihan "{trainingTitle}"</small>
                    </>
                  )}
                </div>

                {/* Foto untuk Card Pelatihan */}
                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">🖼️</span>
                    Foto untuk Card Pelatihan
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {cardImagePreview || cardImageUrl ? (
                      <>
                        <div style={{ position: "relative", width: "100%", maxWidth: "300px" }}>
                          <img
                            src={cardImagePreview || cardImageUrl}
                            alt="Card preview"
                            onClick={mode === "edit" && selectedQuizId ? handleImageClick : undefined}
                            style={{
                              width: "100%",
                              height: "auto",
                              borderRadius: "8px",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                              cursor: mode === "edit" && selectedQuizId ? "pointer" : "default",
                              transition: "opacity 0.3s ease",
                              opacity: mode === "new" ? 0.7 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (mode === "edit" && selectedQuizId) {
                                e.target.style.opacity = "0.8";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (mode === "edit" && selectedQuizId) {
                                e.target.style.opacity = "1";
                              }
                            }}
                          />
                          {/* Tombol hapus hanya muncul di mode Edit */}
                          {mode === "edit" && selectedQuizId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCardImage();
                              }}
                              style={{
                                position: "absolute",
                                top: "8px",
                                right: "8px",
                                background: "rgba(255, 0, 0, 0.8)",
                                color: "white",
                                border: "none",
                                borderRadius: "50%",
                                width: "32px",
                                height: "32px",
                                cursor: "pointer",
                                fontSize: "18px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 10,
                              }}
                            >
                              ×
                            </button>
                          )}
                          {/* Overlay "Klik untuk ganti foto" hanya muncul di mode Edit */}
                          {mode === "edit" && selectedQuizId && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: "8px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: "rgba(0, 0, 0, 0.7)",
                                color: "white",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                pointerEvents: "none",
                              }}
                            >
                              Klik untuk ganti foto
                            </div>
                          )}
                          {/* Overlay "Tidak dapat diubah" di mode New - hanya untuk foto dari quiz yang sudah ada */}
                          {mode === "new" && cardImageUrl && !cardImagePreview && !cardImage && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: "8px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: "rgba(0, 0, 0, 0.7)",
                                color: "white",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                pointerEvents: "none",
                              }}
                            >
                              Foto dari pelatihan ini (Edit Quiz untuk mengubah)
                            </div>
                          )}
                        </div>
                        {/* Tombol Ubah Foto untuk mode New - hanya muncul jika ada foto yang diupload (bukan dari quiz yang sudah ada) */}
                        {mode === "new" && (cardImagePreview || cardImage) && !cardImageUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              const fileInput = document.getElementById('card-image-input-new');
                              if (fileInput) {
                                fileInput.click();
                              }
                            }}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "#667eea",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "0.9rem",
                              fontWeight: "500",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              width: "fit-content",
                            }}
                          >
                            <span>🔄</span>
                            Ubah Foto
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Input file hanya muncul jika belum ada foto atau di mode Edit */}
                        {(mode === "edit" && selectedQuizId) || (!cardImageUrl && mode === "new") ? (
                          <input
                            id={mode === "new" ? "card-image-input-new" : "card-image-input"}
                            type="file"
                            accept="image/*"
                            onChange={handleCardImageSelect}
                            className="input-modern"
                            style={{ padding: "0.75rem", display: "block" }}
                            disabled={mode === "new" && cardImageUrl ? true : false}
                          />
                        ) : null}
                      </>
                    )}
                    {/* Hidden input untuk klik pada foto (hanya di mode Edit) */}
                    {mode === "edit" && selectedQuizId && (cardImagePreview || cardImageUrl) ? (
                      <input
                        id="card-image-input"
                        type="file"
                        accept="image/*"
                        onChange={handleCardImageSelect}
                        style={{ display: "none" }}
                      />
                    ) : null}
                    {/* Hidden input untuk ubah foto di mode New */}
                    {mode === "new" && (cardImagePreview || cardImage) && !cardImageUrl && (
                      <input
                        id="card-image-input-new"
                        type="file"
                        accept="image/*"
                        onChange={handleCardImageSelect}
                        style={{ display: "none" }}
                      />
                    )}
                  </div>
                  <small className="form-hint">
                    {mode === "new" && cardImageUrl && !cardImagePreview && !cardImage
                      ? "Foto ini dari pelatihan yang dipilih. Untuk mengubah foto, gunakan mode Edit Quiz."
                      : mode === "new" && (cardImagePreview || cardImage)
                      ? "Klik tombol 'Ubah Foto' untuk mengganti foto yang sudah diupload (maksimal 5MB). Format: JPG, PNG, dll."
                      : mode === "edit" && selectedQuizId
                      ? (cardImagePreview || cardImageUrl
                          ? "Klik foto untuk mengganti (maksimal 5MB). Format: JPG, PNG, dll."
                          : "Upload foto yang akan digunakan pada card pelatihan (maksimal 5MB). Format: JPG, PNG, dll.")
                      : "Upload foto yang akan digunakan pada card pelatihan (maksimal 5MB). Format: JPG, PNG, dll."}
                  </small>
                </div>

                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">📋</span>
                    Tipe Quiz
                  </label>
                  <select
                    value={selectedQuizType}
                    onChange={(e) => setSelectedQuizType(e.target.value)}
                    required={mode === "new"}
                    disabled={mode === "edit" && selectedQuizId}
                    className="input-modern select-modern"
                  >
                    <option value="">Pilih Tipe</option>
                    {quizTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sasaran Quiz (Jabatan) */}
                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">🎯</span>
                    Sasaran Quiz (Jabatan)
                  </label>
                  {availableJabatan.length === 0 ? (
                    <>
                      <input
                        type="text"
                        value=""
                        placeholder="Tidak ada jabatan tersedia"
                        disabled
                        className="input-modern"
                        style={{ background: "#f3f4f6", cursor: "not-allowed" }}
                      />
                      <small className="form-hint">
                        Tambahkan user dengan jabatan terlebih dahulu.
                      </small>
                    </>
                  ) : (
                    <>
                      <select
                        value=""
                        onChange={(e) => {
                          const selectedJabatan = e.target.value;
                          if (selectedJabatan && !targetJabatan.includes(selectedJabatan)) {
                            setTargetJabatan([...targetJabatan, selectedJabatan]);
                            e.target.value = ""; // Reset dropdown
                          }
                        }}
                        disabled={mode === "edit" && selectedQuizId}
                        className="input-modern select-modern"
                        style={{ width: '100%' }}
                      >
                        <option value="">Pilih Jabatan</option>
                        {availableJabatan
                          .filter(jabatan => !targetJabatan.includes(jabatan))
                          .map((jabatan) => (
                            <option key={jabatan} value={jabatan}>
                              {jabatan}
                            </option>
                          ))}
                      </select>
                      <small className="form-hint">
                        Pilih jabatan dari dropdown untuk menambahkannya ke sasaran quiz.
                      </small>
                      {targetJabatan.length > 0 && (
                        <div className="selected-jabatan-container" style={{ marginTop: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: '#333' }}>
                            Jabatan yang Dipilih:
                          </label>
                          <div className="selected-jabatan-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', minHeight: '50px', maxHeight: '200px', overflowY: 'auto' }}>
                            {targetJabatan.map((jabatan) => (
                              <span
                                key={jabatan}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  padding: '0.5rem 0.75rem',
                                  background: '#667eea',
                                  color: 'white',
                                  borderRadius: '6px',
                                  fontSize: '0.9rem',
                                  fontWeight: '500',
                                }}
                              >
                                {jabatan}
                                {!(mode === "edit" && selectedQuizId) && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleJabatan(jabatan)}
                                    style={{
                                      background: 'rgba(255, 255, 255, 0.3)',
                                      border: 'none',
                                      borderRadius: '50%',
                                      width: '20px',
                                      height: '20px',
                                      cursor: 'pointer',
                                      color: 'white',
                                      fontSize: '14px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 0,
                                      lineHeight: 1,
                                    }}
                                    title="Hapus"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">⏱️</span>
                    Batas Waktu (Menit)
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="number"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                      placeholder="Contoh: 30"
                      min="1"
                      className="input-modern"
                    />
                    {mode === "edit" && selectedQuizId && (
                      <button
                        type="button"
                        onClick={handleUpdateTimeLimit}
                        className="btn-update-time"
                        disabled={isSubmitting}
                      >
                        💾 Update
                      </button>
                      )}
                  </div>
                  <small className="form-hint">Kosongkan jika tidak ada batas waktu</small>
                </div>

                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">📊</span>
                    Minimum Nilai Lulus (%)
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="number"
                      value={minimumScore}
                      onChange={(e) => setMinimumScore(e.target.value)}
                      placeholder="Contoh: 70"
                      min="0"
                      max="100"
                      required={mode === "new"}
                      className="input-modern"
                    />
                    {mode === "edit" && selectedQuizId && (
                      <button
                        type="button"
                        onClick={handleUpdateMinimumScore}
                        className="btn-update-time"
                        disabled={isSubmitting}
                      >
                        💾 Update
                      </button>
                    )}
                  </div>
                  <small className="form-hint">Nilai minimum yang harus dicapai untuk lulus (0-100)</small>
                </div>

                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">📚</span>
                    Jumlah Soal yang Ditampilkan
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="number"
                      value={questionsToDisplay}
                      onChange={(e) => setQuestionsToDisplay(e.target.value)}
                      placeholder="Kosongkan = semua soal"
                      min="1"
                      className="input-modern"
                    />
                    {mode === "edit" && selectedQuizId && (
                      <button
                        type="button"
                        onClick={handleUpdateQuestionsToDisplay}
                        className="btn-update-time"
                        disabled={isSubmitting}
                      >
                        💾 Update
                      </button>
                    )}
                  </div>
                  <small className="form-hint">
                    Jumlah soal yang akan ditampilkan saat quiz dikerjakan (kosongkan untuk menampilkan semua soal dari bank soal)
                  </small>
                </div>

                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">📜</span>
                    Masa Berlaku Sertifikat (Hari)
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="number"
                      value={certificateValidityDays}
                      onChange={(e) => setCertificateValidityDays(e.target.value)}
                      placeholder="Contoh: 365 (1 tahun)"
                      min="1"
                      className="input-modern"
                    />
                    {mode === "edit" && selectedQuizId && (
                      <button
                        type="button"
                        onClick={handleUpdateCertificateValidityDays}
                        className="btn-update-time"
                        disabled={isSubmitting}
                      >
                        💾 Update
                      </button>
                    )}
                  </div>
                  <small className="form-hint">
                    Masa berlaku sertifikat dalam hari sejak tanggal penyelesaian quiz. Kosongkan jika sertifikat tidak memiliki masa berlaku. Hanya berlaku untuk Post Test yang lulus.
                  </small>
                </div>
              </div>
            </div>

            {/* Existing Questions untuk Edit Mode */}
            {mode === "edit" && selectedQuizId && existingQuestions.length > 0 && (
              <div className="form-section">
                <div className="section-title">
                  <span className="section-icon">📋</span>
                  <h2>Soal yang Sudah Ada ({existingQuestions.length} soal)</h2>
                </div>
                <div className="existing-questions-container">
                  {existingQuestions.map((q, qIndex) => (
                    <div key={qIndex} className="existing-question-card">
                      <div className="existing-question-header">
                        <div className="existing-question-number">
                          <span>Soal {qIndex + 1}</span>
                        </div>
                        <div className="existing-question-actions">
                          <button
                            type="button"
                            onClick={() => handleEditExistingQuestion(qIndex)}
                            className="btn-edit-question"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExistingQuestion(qIndex)}
                            className="btn-delete-question"
                          >
                            🗑️ Hapus
                          </button>
                        </div>
                      </div>
                      <p className="existing-question-text">{q.question}</p>
                      <div className="existing-options-list">
                        {q.options.map((option, oIndex) => (
                          <div
                            key={oIndex}
                            className={`existing-option ${
                              q.correctAnswer === oIndex ? "correct" : ""
                            }`}
                          >
                            <span className="option-letter-small">
                              {String.fromCharCode(65 + oIndex)}
                            </span>
                            <span className="option-text-small">{option}</span>
                            {q.correctAnswer === oIndex && (
                              <span className="correct-badge-small">✓ Benar</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Questions Section */}
            <div className="form-section questions-section">
              <div className="section-title">
                <span className="section-icon">❓</span>
                <h2>
                  {editingQuestionIndex !== null
                    ? `Edit Soal ${editingQuestionIndex + 1}`
                    : "Tambah Soal Baru"}
                </h2>
                {editingQuestionIndex === null && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={downloadBulkTemplate}
                      className="btn-update-time"
                    >
                      📥 Download Template Excel
                    </button>
                    <button
                      type="button"
                      onClick={triggerBulkUpload}
                      className="btn-update-time"
                    >
                      📤 Upload Bulk Excel
                    </button>
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="btn-add-modern"
                    >
                      <span className="btn-icon">➕</span>
                      Tambah Soal
                    </button>
                    <input
                      ref={bulkExcelInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleBulkExcelUpload}
                      style={{ display: "none" }}
                    />
                  </div>
                )}
                {editingQuestionIndex !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0 }]);
                      setEditingQuestionIndex(null);
                    }}
                    className="btn-cancel-edit"
                  >
                    <span className="btn-icon">✕</span>
                    Batal Edit
                  </button>
                )}
              </div>

              <div className="questions-container">
                {questions.map((q, qIndex) => (
                  <div key={qIndex} className="question-card-modern">
                    <div className="question-header">
                      <div className="question-number">
                        <span>Soal {qIndex + 1}</span>
                      </div>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIndex)}
                          className="btn-remove"
                          title="Hapus soal"
                        >
                          🗑️
                        </button>
                      )}
                    </div>

                    <div className="form-group-modern">
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => updateQuestion(qIndex, "question", e.target.value)}
                        placeholder="Masukkan pertanyaan di sini..."
                        required
                        className="input-modern question-input"
                      />
                    </div>

                    <div className="options-group-modern">
                      <label className="options-label">
                        <span className="label-icon">🔘</span>
                        Pilihan Jawaban (Pilih jawaban yang benar)
                      </label>
                      <div className="options-grid">
                        {q.options.map((option, oIndex) => (
                          <div
                            key={oIndex}
                            className={`option-card ${
                              q.correctAnswer === oIndex ? "correct" : ""
                            }`}
                          >
                            <label className="option-radio-label">
                              <input
                                type="radio"
                                name={`correct-${qIndex}`}
                                checked={q.correctAnswer === oIndex}
                                onChange={() => updateQuestion(qIndex, "correctAnswer", oIndex)}
                                className="option-radio"
                              />
                              <span className="radio-custom"></span>
                              <span className="option-label-text">Jawaban Benar</span>
                            </label>
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                              placeholder={`Pilihan ${oIndex + 1}`}
                              required
                              className="input-modern option-input"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="form-actions">
              {editingQuestionIndex !== null ? (
                <button
                  type="button"
                  onClick={handleUpdateExistingQuestion}
                  className="btn-submit-modern"
                  disabled={isSubmitting}
                >
                  <span className="btn-icon">💾</span>
                  {isSubmitting ? "Mengupdate..." : "Update Soal"}
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn-submit-modern"
                  disabled={isSubmitting}
                >
                  <span className="btn-icon">💾</span>
                  {isSubmitting
                    ? "Menyimpan..."
                    : mode === "edit"
                    ? "Tambahkan Soal"
                    : "Simpan Quiz"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        onConfirm={handleModalConfirm}
        title={modalContent.title}
        message={modalContent.message}
        type={modalContent.type}
        showCancel={modalContent.type === "confirm"}
        confirmText={modalContent.type === "confirm" ? "Ya, Hapus" : "OK"}
        cancelText="Batal"
        showClose={false}
      />

      {/* Crop Modal */}
      {showCropModal && imageSrc && (
        <div className="crop-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <div className="crop-modal-container" style={{
            background: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div className="crop-modal-header" style={{
              padding: '1rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Crop Foto (1:1)</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setImageSrc(null);
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0.25rem 0.5rem',
                }}
              >
                ✕
              </button>
            </div>
            <div className="crop-modal-body" style={{
              padding: '1rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: '400px',
            }}>
              <div className="crop-container" style={{
                position: 'relative',
                width: '100%',
                height: '400px',
                background: '#000',
                borderRadius: '8px',
                overflow: 'hidden',
              }}>
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="crop-controls" style={{
                marginTop: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                }}>
                  Zoom:
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    style={{
                      flex: 1,
                      maxWidth: '200px',
                    }}
                  />
                  <span>{zoom.toFixed(1)}x</span>
                </label>
              </div>
            </div>
            <div className="crop-modal-footer" style={{
              padding: '1rem',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setImageSrc(null);
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  color: '#333',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCropComplete}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                }}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InputQuiz;
