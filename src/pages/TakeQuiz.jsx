import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import Certificate from '../components/Certificate';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { certificateConfig } from '../config/certificateConfig';
import './Page.css';

const TakeQuiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  // Selalu gunakan nama dari user yang login
  const [participantName, setParticipantName] = useState(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const userName = user.nama || user.username || '';
        // Simpan ke localStorage untuk konsistensi
        if (userName) {
          localStorage.setItem('participantName', userName);
        }
        return userName;
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }
    return '';
  });
  const [timeRemaining, setTimeRemaining] = useState(0); // dalam detik
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState(null); // Timestamp saat quiz dimulai
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [originalToShuffledMap, setOriginalToShuffledMap] = useState({}); // Mapping untuk scoring
  const [userData, setUserData] = useState(null); // Data user untuk sertifikat
  const [showCertificate, setShowCertificate] = useState(false); // Tampilkan sertifikat
  const [completionDate, setCompletionDate] = useState(null); // Tanggal penyelesaian

  // Ambil nama peserta dari sumber paling stabil (localStorage -> user login)
  const resolveParticipantName = () => {
    const savedName = localStorage.getItem('participantName')?.trim();
    if (savedName) return savedName;

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const userName = (user.nama || user.username || '').trim();
        if (userName) {
          localStorage.setItem('participantName', userName);
          return userName;
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }

    return '';
  };

  const getTimerStorageKey = (quizId, participantNameValue) => {
    const stableName = (participantNameValue || resolveParticipantName() || 'anonymous').trim().toLowerCase();
    return `quiz_timer_${quizId}_${stableName}`;
  };

  // Fungsi untuk shuffle array (Fisher-Yates algorithm)
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Fungsi untuk shuffle options dan update correctAnswer
  const shuffleQuestionOptions = (question) => {
    const options = [...question.options];
    const correctAnswerIndex = question.correctAnswer;
    
    // Buat array dengan index
    const optionsWithIndex = options.map((option, index) => ({ option, originalIndex: index }));
    
    // Shuffle options
    const shuffledOptionsWithIndex = shuffleArray(optionsWithIndex);
    
    // Cari index baru untuk correctAnswer
    const newCorrectAnswerIndex = shuffledOptionsWithIndex.findIndex(
      item => item.originalIndex === correctAnswerIndex
    );
    
    return {
      ...question,
      options: shuffledOptionsWithIndex.map(item => item.option),
      correctAnswer: newCorrectAnswerIndex
    };
  };

  useEffect(() => {
    const stableName = resolveParticipantName();
    if (stableName) {
      setParticipantName(stableName);
    }

    fetchQuiz();
  }, [id]);

  useEffect(() => {
    // Deteksi keluar dari halaman - hanya saat user benar-benar ingin keluar
    const handleBeforeUnload = (e) => {
      // Hanya tampilkan notifikasi jika quiz sedang berjalan (bukan loading atau hasil)
      if (!showResults && !loading && quiz && quiz.time_limit && quiz.time_limit > 0 && timeRemaining > 0) {
        e.preventDefault();
        e.returnValue = '⚠️ Timer quiz akan tetap berjalan! Apakah Anda yakin ingin keluar?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [showResults, quiz, loading, timeRemaining]);

  // Timer countdown effect dengan persistent timer
  useEffect(() => {
    if (quiz && quiz.time_limit && quiz.time_limit > 0 && quizStartTime && !showResults && !isTimeUp) {
      const storageKey = getTimerStorageKey(id);
      const totalTimeInSeconds = quiz.time_limit * 60;
      
      const timer = setInterval(() => {
        const elapsedTime = Math.floor((Date.now() - quizStartTime) / 1000);
        const remaining = Math.max(0, totalTimeInSeconds - elapsedTime);
        
        if (remaining <= 0) {
          setIsTimeUp(true);
          setTimeRemaining(0);
          localStorage.removeItem(storageKey);
        } else {
          setTimeRemaining(remaining);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quiz, quizStartTime, showResults, isTimeUp, id]);

  // Auto submit ketika waktu habis
  useEffect(() => {
    if (isTimeUp && !showResults && quiz) {
      const autoSubmit = async () => {
        const totalQuestions = shuffledQuestions.length > 0 ? shuffledQuestions.length : quiz.questions.length;
        const calculatedScore = calculateScore();
        const calculatedPercentage = Math.round((calculatedScore / totalQuestions) * 100);
        setScore(calculatedScore);
        setPercentage(calculatedPercentage);
        
        // Simpan hasil ke database
        await saveQuizResult(calculatedScore, calculatedPercentage);
        
        setShowResults(true);
      };
      
      autoSubmit();
    }
  }, [isTimeUp, showResults, quiz]);

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      
      // Wrap dalam try-catch tambahan untuk menangani network error
      let data, error;
      try {
        const result = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', id)
          .single();
        data = result.data;
        error = result.error;
      } catch (fetchError) {
        // Network error atau error lainnya
        console.error('Network error fetching quiz:', fetchError);
        setLoading(false);
        // Redirect tanpa alert
        setTimeout(() => {
          navigate('/kmb-learning');
        }, 100);
        return;
      }

      if (error) {
        console.error('Error fetching quiz:', error);
        // Jangan tampilkan alert yang mengganggu, cukup log error dan redirect
        console.error('Failed to fetch quiz:', error.message || error);
        // Redirect tanpa alert
        setLoading(false);
        setTimeout(() => {
          navigate('/kmb-learning');
        }, 100);
        return;
      } else {
        // Cek batas attempt untuk Post Test (maksimal 2 kali)
        if (data.quiz_type === 'Post Test') {
          const participantNameToCheck = resolveParticipantName() || participantName || '';
          if (participantNameToCheck) {
            try {
              // Cek jumlah attempt Post Test untuk quiz ini
              const { data: postTestResults, error: resultsError } = await supabase
                .from('quiz_results')
                .select('id, is_passed, completed_at')
                .eq('quiz_id', id)
                .eq('participant_name', participantNameToCheck)
                .order('completed_at', { ascending: false });

              if (resultsError) {
                console.error('Error checking post test attempts:', resultsError);
                // Jika error, lanjutkan saja (jangan block user)
              } else if (postTestResults) {
                const attemptCount = postTestResults.length;
                
                // Jika sudah 2 kali attempt, cek apakah keduanya gagal
                if (attemptCount >= 2) {
                  const failedAttempts = postTestResults.filter(r => !r.is_passed).length;
                  
                  if (failedAttempts >= 2) {
                    try {
                      // Lock Post Test - cek apakah ada Pre Test yang lulus setelah attempt terakhir
                      const lastAttemptDate = new Date(postTestResults[0].completed_at);
                      
                      // Cari Pre Test untuk training yang sama
                      const { data: preTestQuiz, error: preTestError } = await supabase
                        .from('quizzes')
                        .select('id')
                        .eq('training_title', data.training_title)
                        .eq('quiz_type', 'Pre Test')
                        .maybeSingle();
                      
                      if (preTestError) {
                        console.error('Error checking pre test:', preTestError);
                        // Jika error, lanjutkan saja
                      } else if (preTestQuiz) {
                        // Cek apakah ada Pre Test yang lulus setelah Post Test terakhir
                        const { data: preTestResults, error: preTestResultsError } = await supabase
                          .from('quiz_results')
                          .select('id, is_passed, completed_at')
                          .eq('quiz_id', preTestQuiz.id)
                          .eq('participant_name', participantNameToCheck)
                          .eq('is_passed', true)
                          .gt('completed_at', lastAttemptDate.toISOString())
                          .order('completed_at', { ascending: false })
                          .limit(1);
                        
                        if (preTestResultsError) {
                          console.error('Error checking pre test results:', preTestResultsError);
                          // Jika error, lanjutkan saja
                        } else if (!preTestResults || preTestResults.length === 0) {
                          // Post Test terkunci - harus mengerjakan Pre Test dulu
                          console.warn('⚠️ Post Test terkunci! User sudah mencoba 2 kali dan gagal.');
                          setLoading(false);
                          setTimeout(() => {
                            navigate('/kmb-learning');
                          }, 100);
                          return;
                        }
                      } else {
                        // Tidak ada Pre Test, tetap lock
                        console.warn('⚠️ Post Test terkunci! User sudah mencoba 2 kali dan gagal.');
                        setLoading(false);
                        setTimeout(() => {
                          navigate('/kmb-learning');
                        }, 100);
                        return;
                      }
                    } catch (lockCheckError) {
                      console.error('Error in lock check:', lockCheckError);
                      // Jika error, lanjutkan saja (jangan block user)
                    }
                  }
                }
              }
            } catch (attemptCheckError) {
              console.error('Error checking attempts:', attemptCheckError);
              // Jika error, lanjutkan saja (jangan block user dari mengerjakan quiz)
            }
          }
        }
        
        // Shuffle questions dan options
        if (data.questions && Array.isArray(data.questions)) {
          // 1. Ambil jumlah soal yang akan ditampilkan (jika ada pengaturan)
          const totalQuestions = data.questions.length;
          const questionsToDisplay = data.questions_to_display && data.questions_to_display > 0 
            ? Math.min(data.questions_to_display, totalQuestions) 
            : totalQuestions;
          
          // 2. Shuffle urutan soal
          const shuffledQuestionsOrder = shuffleArray(data.questions);
          
          // 3. Ambil hanya jumlah soal yang ditentukan (jika ada pengaturan)
          const selectedQuestions = questionsToDisplay < totalQuestions
            ? shuffledQuestionsOrder.slice(0, questionsToDisplay)
            : shuffledQuestionsOrder;
          
          // 4. Shuffle options untuk setiap soal
          const shuffledQuestions = selectedQuestions.map(shuffleQuestionOptions);
          
          // 5. Buat mapping dari shuffled index ke original index untuk scoring
          const mapping = {};
          shuffledQuestions.forEach((shuffledQ, shuffledIndex) => {
            const originalIndex = data.questions.findIndex(
              originalQ => originalQ.question === shuffledQ.question
            );
            mapping[shuffledIndex] = originalIndex;
          });
          
          setShuffledQuestions(shuffledQuestions);
          setOriginalToShuffledMap(mapping);
          
          // Initialize answers object untuk shuffled questions
          const initialAnswers = {};
          shuffledQuestions.forEach((_, index) => {
            initialAnswers[index] = null;
          });
          setAnswers(initialAnswers);
          
          // Set quiz dengan shuffled questions
          setQuiz({
            ...data,
            questions: shuffledQuestions
          });
        } else {
          setQuiz(data);
          setShuffledQuestions([]);
        }
        
        // Initialize timer jika ada time_limit dengan persistent timer
        if (data.time_limit && data.time_limit > 0) {
          const totalTimeInSeconds = data.time_limit * 60;
          const storageKey = getTimerStorageKey(id);
          
          // Cek apakah ada timer yang sedang berjalan
          const savedStartTime = localStorage.getItem(storageKey);
          if (savedStartTime) {
            // Timer sudah berjalan, hitung waktu tersisa
            const startTime = parseInt(savedStartTime);
            const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, totalTimeInSeconds - elapsedTime);
            
            if (remaining > 0) {
              setTimeRemaining(remaining);
              setQuizStartTime(startTime);
              // Jangan tampilkan alert otomatis - hanya tampilkan saat user mencoba keluar
            } else {
              // Waktu sudah habis
              setIsTimeUp(true);
              setTimeRemaining(0);
              localStorage.removeItem(storageKey);
            }
          } else {
            // Timer baru, mulai dari awal
            const startTime = Date.now();
            setQuizStartTime(startTime);
            setTimeRemaining(totalTimeInSeconds);
            localStorage.setItem(storageKey, startTime.toString());
          }
        }
        
        // Pastikan loading di-reset setelah semua proses selesai
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching quiz:', err);
      // Jangan tampilkan alert yang mengganggu, cukup log error dan redirect
      if (err.message && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
        console.error('Network error - mungkin koneksi terputus atau server tidak tersedia');
      }
      // Redirect tanpa alert
      setLoading(false);
      setTimeout(() => {
        navigate('/kmb-learning');
      }, 100);
    } finally {
      // Pastikan loading selalu di-reset, bahkan jika ada error
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex, answerIndex) => {
    setAnswers({
      ...answers,
      [questionIndex]: answerIndex
    });
  };

  const handleNext = () => {
    const totalQuestions = shuffledQuestions.length > 0 ? shuffledQuestions.length : quiz.questions.length;
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = () => {
    setShowConfirmModal(true);
  };

  const handleCloseQuiz = () => {
    if (quiz.time_limit && quiz.time_limit > 0 && timeRemaining > 0) {
      setShowExitModal(true);
    } else {
      navigate('/kmb-learning');
    }
  };

  const handleConfirmSubmit = async () => {
    const totalQuestions = shuffledQuestions.length > 0 ? shuffledQuestions.length : quiz.questions.length;
    const calculatedScore = calculateScore();
    const calculatedPercentage = Math.round((calculatedScore / totalQuestions) * 100);
    setScore(calculatedScore);
    setPercentage(calculatedPercentage);
    
    // Simpan hasil ke database
    await saveQuizResult(calculatedScore, calculatedPercentage);
    
    setShowResults(true);
    setShowConfirmModal(false);
  };

  const calculateScore = () => {
    let correct = 0;
    const questionsToCheck = shuffledQuestions.length > 0 ? shuffledQuestions : quiz.questions;
    questionsToCheck.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correct++;
      }
    });
    return correct;
  };

  const saveQuizResult = async (finalScore, finalPercentage) => {
    try {
      // Get minimum score from quiz, default to 70 if not set
      const minimumScore = quiz.minimum_score || 70;
      const isPassed = finalPercentage >= minimumScore;

      const totalQuestions = shuffledQuestions.length > 0 ? shuffledQuestions.length : quiz.questions.length;
      
      // Selalu gunakan nama dari user yang login
      let finalParticipantName = participantName?.trim();
      
      // Jika state kosong, ambil dari user yang login
      if (!finalParticipantName || finalParticipantName === '') {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            finalParticipantName = (user.nama || user.username || '').trim();
          } catch (err) {
            console.error('Error parsing user data:', err);
          }
        }
      }
      
      // Fallback ke Anonymous jika masih kosong (seharusnya tidak terjadi jika user sudah login)
      if (!finalParticipantName || finalParticipantName === '') {
        finalParticipantName = 'Anonymous';
        console.warn('No user name found, using Anonymous');
      }
      
      // Simpan ke localStorage untuk konsistensi
      localStorage.setItem('participantName', finalParticipantName);
      
      // Hitung expiry_date jika ada masa berlaku sertifikat
      let expiryDate = null;
      if (quiz.certificate_validity_days && quiz.certificate_validity_days > 0 && isPassed && quiz.quiz_type === 'Post Test') {
        const completedDate = new Date();
        expiryDate = new Date(completedDate);
        expiryDate.setDate(expiryDate.getDate() + quiz.certificate_validity_days);
      }

      console.log('Saving quiz result:', {
        quiz_id: parseInt(id),
        participant_name: finalParticipantName,
        score: finalScore,
        percentage: finalPercentage,
        is_passed: isPassed,
        quiz_type: quiz.quiz_type,
        certificate_validity_days: quiz.certificate_validity_days,
        expiry_date: expiryDate ? expiryDate.toISOString() : null,
        participantName_from_state: participantName,
        participantName_from_localStorage: localStorage.getItem('participantName')
      }); // Debug log
      
      const insertData = {
        quiz_id: parseInt(id),
        participant_name: finalParticipantName,
        score: finalScore,
        total_questions: totalQuestions,
        percentage: finalPercentage,
        answers: answers,
        is_passed: isPassed,
        completed_at: new Date().toISOString()
      };

      // Tambahkan expiry_date jika ada
      if (expiryDate) {
        insertData.expiry_date = expiryDate.toISOString();
      }

      const { error } = await supabase
        .from('quiz_results')
        .insert([insertData]);

      const completedDate = new Date().toISOString();
      setCompletionDate(completedDate);

      // Hapus timer dari localStorage setelah quiz selesai
      if (quiz.time_limit && quiz.time_limit > 0) {
        const storageKey = getTimerStorageKey(id, finalParticipantName);
        localStorage.removeItem(storageKey);
      }

      if (error) {
        console.error('Error saving quiz result:', error);
        // Jangan tampilkan error ke user, biarkan hasil tetap ditampilkan
      } else {
        console.log('Quiz result saved successfully');
        
        // Jika Post Test dan lulus, ambil data user untuk sertifikat
        if (quiz.quiz_type === 'Post Test' && isPassed) {
          await fetchUserDataForCertificate();
        }
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchUserDataForCertificate = async () => {
    try {
      // Coba ambil dari localStorage dulu (jika user sudah login)
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          // Ambil data lengkap dari database
          const { data, error } = await supabase
            .from('users')
            .select('nama, jabatan, nrp')
            .eq('username', user.username)
            .maybeSingle();
          
          if (!error && data) {
            setUserData({
              nama: data.nama || participantName,
              jabatan: data.jabatan || '',
              nrp: data.nrp || ''
            });
          } else {
            // Fallback ke participant name
            setUserData({
              nama: participantName || 'Peserta',
              jabatan: '',
              nrp: ''
            });
          }
        } catch (err) {
          console.error('Error parsing user data:', err);
          setUserData({
            nama: participantName || 'Peserta',
            jabatan: '',
            nrp: ''
          });
        }
      } else {
        // Jika tidak ada user login, gunakan participant name
        setUserData({
          nama: participantName || 'Peserta',
          jabatan: '',
          nrp: ''
        });
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setUserData({
        nama: participantName || 'Peserta',
        jabatan: '',
        nrp: ''
      });
    }
  };

  const isAllAnswered = () => {
    const questionsToCheck = shuffledQuestions.length > 0 ? shuffledQuestions : quiz.questions;
    return questionsToCheck.every((_, index) => answers[index] !== null);
  };

  const handleDownloadCertificate = async () => {
    try {
      const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('id-ID', options);
      };

      const displayQuestions = shuffledQuestions.length > 0 ? shuffledQuestions : quiz.questions;
      const totalQuestionsForResults = displayQuestions.length;
      const finalPercentage = Math.round((score / totalQuestionsForResults) * 100);

      // Gunakan konfigurasi dari certificateConfig
      const config = certificateConfig;

      // Jika menggunakan template gambar
      if (config.template.useTemplate && config.template.imagePath) {
        await generateCertificateFromTemplate(config, formatDate, totalQuestionsForResults);
        return;
      }

      // Buat elemen certificate sementara (default method)
      const certificateDiv = document.createElement('div');
      certificateDiv.style.position = 'absolute';
      certificateDiv.style.left = '-9999px';
      certificateDiv.style.width = '297mm';
      certificateDiv.style.height = '210mm';
      certificateDiv.style.background = 'white';
      certificateDiv.style.padding = '20px';
      certificateDiv.style.fontFamily = 'Arial, sans-serif';
      const logoDisplay = config.logo.useImage 
        ? `<img src="${config.logo.imagePath}" style="width: ${config.logo.size}; height: ${config.logo.size};" alt="Logo" />`
        : `<div style="font-size: ${config.logo.size}; margin-bottom: 20px;">${config.logo.emoji}</div>`;

      certificateDiv.innerHTML = `
        <div style="border: ${config.border.width} solid ${config.border.color}; padding: ${config.border.padding}; height: 100%; display: flex; flex-direction: column; justify-content: space-between; text-align: center; border-radius: ${config.border.radius}; background: ${config.colors.background}; font-family: ${config.fonts.body};">
          <div>
            ${logoDisplay}
            <h1 style="font-size: ${config.fontSizes.title}; color: ${config.colors.primary}; margin-bottom: 10px; text-transform: uppercase; font-family: ${config.fonts.title};">${config.texts.title}</h1>
            <p style="font-size: ${config.fontSizes.subtitle}; color: ${config.colors.textSecondary}; margin-bottom: 40px;">${config.texts.subtitle}</p>
          </div>
          
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
            <p style="font-size: ${config.fontSizes.bodyText}; margin-bottom: 20px; color: ${config.colors.text};">${config.texts.statement}</p>
            
            <div style="margin: 30px 0;">
              <p style="font-size: ${config.fontSizes.participantName}; font-weight: bold; color: ${config.colors.text}; margin-bottom: 10px;">${userData?.nama || participantName || 'Peserta'}</p>
              <div style="font-size: ${config.fontSizes.participantDetails}; color: ${config.colors.textSecondary};">
                ${config.layout.showJabatan && userData?.jabatan ? `<p>${userData.jabatan}</p>` : ''}
                ${config.layout.showNRP && userData?.nrp ? `<p>NRP: ${userData.nrp}</p>` : ''}
              </div>
            </div>
            
            <p style="font-size: ${config.fontSizes.bodyText}; margin: 20px 0; color: ${config.colors.text};">${config.texts.completion}</p>
            
            <div style="margin: 20px 0;">
              <p style="font-size: ${config.fontSizes.trainingTitle}; font-weight: bold; color: ${config.colors.secondary}; margin-bottom: 5px;">${quiz.training_title || 'BAIM'}</p>
              <p style="font-size: ${config.fontSizes.quizTitle}; color: ${config.colors.textSecondary};">${quiz.quiz_title || ''}</p>
            </div>
            
            <div style="margin: 30px 0; font-size: ${config.fontSizes.details}; color: ${config.colors.text};">
              <p>${config.texts.scoreLabel} <strong>${finalPercentage}</strong></p>
              <p>${config.texts.dateLabel} <strong>${formatDate(completionDate || new Date().toISOString())}</strong></p>
            </div>
          </div>
          
          ${config.signature.show ? `
          <div style="margin-top: 40px; text-align: ${config.signature.position};">
            <div style="width: 200px; height: 1px; background: ${config.colors.text}; margin: 20px auto;"></div>
            <p style="font-size: ${config.fontSizes.signatureName}; font-weight: bold; margin: 5px 0; color: ${config.colors.text};">${config.signature.name}</p>
            <p style="font-size: ${config.fontSizes.signatureTitle}; color: ${config.colors.textSecondary};">${config.signature.title}</p>
          </div>
          ` : ''}
        </div>
      `;

      document.body.appendChild(certificateDiv);

      // Convert to canvas
      const canvas = await html2canvas(certificateDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      // Remove temporary element
      document.body.removeChild(certificateDiv);

      // Convert canvas to image
      const imgData = canvas.toDataURL('image/png', 1.0);

      // Create PDF
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;
      const xOffset = (pdfWidth - imgScaledWidth) / 2;
      const yOffset = (pdfHeight - imgScaledHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgScaledWidth, imgScaledHeight);
      
      // Generate filename
      const participantNameForFile = (userData?.nama || participantName || 'Peserta').replace(/\s+/g, '_');
      const quizTitleForFile = (quiz.quiz_title || 'Quiz').replace(/\s+/g, '_');
      const filename = `Sertifikat_${participantNameForFile}_${quizTitleForFile}.pdf`;
      
      pdf.save(filename);
      
      console.log('Certificate downloaded successfully');
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Gagal mengunduh sertifikat. Silakan coba lagi.\nError: ' + error.message);
    }
  };

  // Fungsi untuk generate sertifikat dari template gambar
  const generateCertificateFromTemplate = async (config, formatDate, totalQuestionsForResults) => {
    try {
      // Load template image
      const templateImg = new Image();
      templateImg.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        templateImg.onload = resolve;
        templateImg.onerror = () => reject(new Error('Gagal memuat template sertifikat. Pastikan path gambar benar.'));
        templateImg.src = config.template.imagePath;
      });

      // Create canvas dengan ukuran template
      const canvas = document.createElement('canvas');
      canvas.width = templateImg.width;
      canvas.height = templateImg.height;
      const ctx = canvas.getContext('2d');

      // Draw template image
      ctx.drawImage(templateImg, 0, 0);

      // Helper function untuk convert persen ke pixel
      const getPosition = (pos, dimension) => {
        if (typeof pos === 'string' && pos.includes('%')) {
          const percent = parseFloat(pos) / 100;
          return dimension * percent;
        }
        return parseFloat(pos);
      };

      // Helper function untuk draw text dengan alignment
      const drawText = (text, x, y, style) => {
        if (!text) return;
        
        // Gunakan fontFamily dari style jika ada, jika tidak gunakan config.fonts.body
        const fontFamily = style.fontFamily || config.fonts.body;
        ctx.font = `${style.fontWeight || 'normal'} ${style.fontSize} ${fontFamily}`;
        ctx.fillStyle = style.color || config.colors.text;
        ctx.textAlign = style.textAlign || 'center';
        ctx.textBaseline = 'middle';

        // Handle text alignment
        let textX = x;
        if (style.textAlign === 'center') {
          textX = getPosition(x, canvas.width);
        } else if (style.textAlign === 'right') {
          textX = getPosition(x, canvas.width);
        } else {
          textX = getPosition(x, canvas.width);
        }

        const textY = getPosition(y, canvas.height);
        ctx.fillText(text, textX, textY);
      };

      // Draw semua teks sesuai posisi di config
      const positions = config.template.textPositions;
      const styles = config.template.textStyles;

      // Nama peserta
      drawText(
        userData?.nama || participantName || 'Peserta',
        positions.participantName.x,
        positions.participantName.y,
        styles.participantName
      );

      // Jabatan
      if (config.layout.showJabatan && userData?.jabatan) {
        drawText(
          userData.jabatan,
          positions.jabatan.x,
          positions.jabatan.y,
          styles.jabatan
        );
      }

      // NRP
      if (config.layout.showNRP && userData?.nrp) {
        drawText(
          `NRP: ${userData.nrp}`,
          positions.nrp.x,
          positions.nrp.y,
          styles.nrp
        );
      }

      // Training title
      drawText(
        quiz.training_title || 'BAIM',
        positions.trainingTitle.x,
        positions.trainingTitle.y,
        styles.trainingTitle
      );

      // Quiz title
      drawText(
        quiz.quiz_title || '',
        positions.quizTitle.x,
        positions.quizTitle.y,
        styles.quizTitle
      );

      // Score - Format: "Grade" di baris pertama, nilai di baris kedua
      const finalPercentage = Math.round((score / totalQuestionsForResults) * 100);
      // Draw "Grade" menggunakan posisi terpisah
      drawText(
        config.texts.gradeLabel,
        positions.gradeLabel.x,
        positions.gradeLabel.y,
        styles.gradeLabel
      );
      // Draw nilai menggunakan posisi terpisah
      drawText(
        finalPercentage.toString(),
        positions.gradeValue.x,
        positions.gradeValue.y,
        styles.gradeValue
      );

      // Valid Date - Format: "Valid" di baris pertama, "tanggal Pekerjaan until expired date" di baris kedua
      const completedDateStr = formatDate(completionDate || new Date().toISOString());
      let expiryDateToShow = null;
      if (quiz.certificate_validity_days && quiz.certificate_validity_days > 0) {
        const completedDate = completionDate ? new Date(completionDate) : new Date();
        const expiryDate = new Date(completedDate);
        expiryDate.setDate(expiryDate.getDate() + quiz.certificate_validity_days);
        expiryDateToShow = expiryDate.toISOString();
      }
      
      if (expiryDateToShow) {
        const expiryDateStr = formatDate(expiryDateToShow);
        // Draw "Valid" menggunakan posisi terpisah
        drawText(
          config.texts.validLabel,
          positions.validLabel.x,
          positions.validLabel.y,
          styles.validLabel
        );
        // Draw "tanggal Pekerjaan until expired date" menggunakan posisi terpisah
        drawText(
          `${completedDateStr} until ${expiryDateStr}`,
          positions.validDate.x,
          positions.validDate.y,
          styles.validDate
        );
      } else {
        // Jika tidak ada expiry date, hanya tampilkan "Valid" dan tanggal penyelesaian
        drawText(
          config.texts.validLabel,
          positions.validLabel.x,
          positions.validLabel.y,
          styles.validLabel
        );
        drawText(
          completedDateStr,
          positions.validDate.x,
          positions.validDate.y,
          styles.validDate
        );
      }

      // Convert canvas to image
      const imgData = canvas.toDataURL('image/png', 1.0);

      // Create PDF
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;
      const xOffset = (pdfWidth - imgScaledWidth) / 2;
      const yOffset = (pdfHeight - imgScaledHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgScaledWidth, imgScaledHeight);
      
      // Generate filename
      const participantNameForFile = (userData?.nama || participantName || 'Peserta').replace(/\s+/g, '_');
      const quizTitleForFile = (quiz.quiz_title || 'Quiz').replace(/\s+/g, '_');
      const filename = `Sertifikat_${participantNameForFile}_${quizTitleForFile}.pdf`;
      
      pdf.save(filename);
      
      console.log('Certificate downloaded successfully from template');
    } catch (error) {
      console.error('Error generating certificate from template:', error);
      alert('Gagal mengunduh sertifikat dari template.\nError: ' + error.message + '\n\nPastikan:\n1. File template ada di folder public/images/\n2. Path di config sudah benar\n3. Format gambar adalah PNG atau JPG');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="loading-state">
            <div className="loading-spinner">⏳</div>
            <p>Memuat quiz...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz && !loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <h3>Quiz tidak ditemukan atau gagal dimuat</h3>
            <p style={{ marginTop: '0.5rem', color: '#666' }}>
              Silakan coba lagi atau hubungi administrator jika masalah berlanjut.
            </p>
            <button onClick={() => navigate('/kmb-learning')} className="btn-retry">
              Kembali ke KMB Learning
            </button>
          </div>
        </div>
      </div>
    );
  }

  const questionsToDisplay = shuffledQuestions.length > 0 ? shuffledQuestions : quiz.questions;
  const currentQuestion = questionsToDisplay[currentQuestionIndex];
  const totalQuestions = questionsToDisplay.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  if (showResults) {
    const displayQuestions = shuffledQuestions.length > 0 ? shuffledQuestions : quiz.questions;
    const totalQuestionsForResults = displayQuestions.length;
    const percentage = Math.round((score / totalQuestionsForResults) * 100);
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="quiz-results">
            <div className="results-header">
              <h1 className="page-title">Hasil Quiz</h1>
              <h2>{quiz.quiz_title}</h2>
              <p className="quiz-training-title">{quiz.training_title}</p>
            </div>

            <div className="results-score">
              <div className={`score-circle ${percentage >= 70 ? 'pass' : 'fail'}`}>
                <div className="score-number">{score}</div>
                <div className="score-total">/ {totalQuestions}</div>
              </div>
              <div className="score-percentage">{percentage}%</div>
              <div className="score-message">
                {percentage >= 70 ? '🎉 Selamat! Anda Lulus!' : '😔 Belum Lulus, Coba Lagi!'}
              </div>
            </div>

            <div className="results-details">
              <h3>Detail Jawaban</h3>
              {(shuffledQuestions.length > 0 ? shuffledQuestions : quiz.questions).map((question, qIndex) => {
                const userAnswer = answers[qIndex];
                const isCorrect = userAnswer === question.correctAnswer;
                return (
                  <div key={qIndex} className={`result-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                    <div className="result-question-header">
                      <span className="result-question-number">Pertanyaan {qIndex + 1}</span>
                      <span className={`result-status ${isCorrect ? 'correct' : 'incorrect'}`}>
                        {isCorrect ? '✅ Benar' : '❌ Salah'}
                      </span>
                    </div>
                    <p className="result-question-text">{question.question}</p>
                    <div className="result-answers">
                      {question.options.map((option, oIndex) => {
                        const isUserAnswer = userAnswer === oIndex;
                        const isCorrectAnswer = question.correctAnswer === oIndex;
                        return (
                          <div
                            key={oIndex}
                            className={`result-option ${
                              isCorrectAnswer ? 'correct-answer' : ''
                            } ${isUserAnswer && !isCorrectAnswer ? 'wrong-answer' : ''}`}
                          >
                            {isCorrectAnswer && <span className="correct-badge">✓ Jawaban Benar</span>}
                            {isUserAnswer && !isCorrectAnswer && (
                              <span className="wrong-badge">✗ Jawaban Anda</span>
                            )}
                            {option}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="results-actions">
              {quiz.quiz_type === 'Post Test' && percentage >= (quiz.minimum_score || 70) && (
                <button 
                  onClick={handleDownloadCertificate} 
                  className="btn-download-certificate-result"
                >
                  🏆 Download Sertifikat
                </button>
              )}
              <button onClick={() => navigate('/kmb-learning')} className="btn-back-to-quizzes">
                Kembali ke Daftar Quiz
              </button>
              <button onClick={() => window.location.reload()} className="btn-retry-quiz">
                Kerjakan Lagi
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tampilkan sertifikat jika Post Test lulus
  if (showCertificate && quiz && quiz.quiz_type === 'Post Test') {
    const displayQuestions = shuffledQuestions.length > 0 ? shuffledQuestions : quiz.questions;
    const totalQuestionsForResults = displayQuestions.length;
    const finalPercentage = Math.round((score / totalQuestionsForResults) * 100);
    
    if (finalPercentage >= (quiz.minimum_score || 70)) {
      return (
        <div className="page-container">
          <div className="page-content">
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
              <button 
                onClick={() => setShowCertificate(false)} 
                className="btn-back-to-quizzes"
                style={{ marginBottom: '1rem' }}
              >
                ← Kembali ke Hasil Quiz
              </button>
            </div>
            <Certificate
              participantName={userData?.nama || participantName || 'Peserta'}
              jabatan={userData?.jabatan || ''}
              nrp={userData?.nrp || ''}
              trainingTitle={quiz.training_title || 'BAIM'}
              quizTitle={quiz.quiz_title || ''}
              completionDate={completionDate || new Date().toISOString()}
              score={score}
              totalQuestions={totalQuestionsForResults}
              percentage={finalPercentage}
              onDownload={() => {
                console.log('Certificate downloaded');
              }}
            />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="quiz-taking-container">
          {!showResults && (
            <div className="participant-name-section">
              <div className="form-group-modern">
                <label htmlFor="participantName">
                  <span className="label-icon">👤</span>
                  Nama Peserta (otomatis dari akun)
                </label>
                <input
                  type="text"
                  id="participantName"
                  value={participantName}
                  readOnly
                  disabled
                  className="input-modern"
                />
                <p style={{ marginTop: '0.35rem', fontSize: '0.9rem', opacity: 0.8 }}>
                  Gunakan akun login untuk identitas peserta.
                </p>
              </div>
            </div>
          )}
          
          <div className="quiz-header">
            <div className="quiz-header-info">
              <h1 className="quiz-title">{quiz.quiz_title}</h1>
              <p className="quiz-training-title">{quiz.training_title}</p>
            </div>
            {!showResults && (
              <button 
                onClick={handleCloseQuiz}
                className="btn-close-quiz"
              >
                ✕ Tutup
              </button>
            )}
          </div>

          {quiz.time_limit && quiz.time_limit > 0 && (
            <div className="quiz-timer-container">
              <div className={`quiz-timer ${timeRemaining <= 60 ? 'timer-warning' : ''} ${timeRemaining <= 30 ? 'timer-danger' : ''}`}>
                <span className="timer-icon">⏱️</span>
                <span className="timer-text">
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </span>
                {isTimeUp && <span className="timer-up">Waktu Habis!</span>}
              </div>
            </div>
          )}

          <div className="quiz-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-text">
              Pertanyaan {currentQuestionIndex + 1} dari {totalQuestions}
            </div>
          </div>

          <div className="question-container">
            <div className="question-header">
              <span className="question-number">Pertanyaan {currentQuestionIndex + 1}</span>
            </div>
            <h2 className="question-text">{currentQuestion.question}</h2>

            <div className="options-container">
              {currentQuestion.options.map((option, index) => {
                const isSelected = answers[currentQuestionIndex] === index;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleAnswerSelect(currentQuestionIndex, index)}
                    className={`option-button ${isSelected ? 'selected' : ''}`}
                  >
                    <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                    <span className="option-text">{option}</span>
                    {isSelected && <span className="option-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="quiz-navigation">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="btn-nav btn-prev"
            >
              ← Sebelumnya
            </button>
            <div className="nav-info">
              {Object.values(answers).filter(a => a !== null).length} / {totalQuestions} Terjawab
            </div>
            {currentQuestionIndex < totalQuestions - 1 ? (
              <button
                onClick={handleNext}
                className="btn-nav btn-next"
              >
                Selanjutnya →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!isAllAnswered()}
                className="btn-nav btn-submit"
              >
                {isAllAnswered() ? 'Kirim Jawaban ✓' : 'Lengkapi Semua Jawaban'}
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Konfirmasi Kirim Jawaban"
        message="Apakah Anda yakin ingin mengirim jawaban? Setelah mengirim, Anda tidak dapat mengubah jawaban lagi."
        type="confirm"
        onConfirm={handleConfirmSubmit}
        confirmText="Ya, Kirim Jawaban"
        cancelText="Batal"
        showClose={false}
      />

      <Modal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        title="Konfirmasi Keluar Quiz"
        message="Timer quiz akan tetap berjalan. Apakah Anda yakin ingin keluar dari quiz sekarang?"
        type="warning"
        onConfirm={() => navigate('/kmb-learning')}
        confirmText="Ya, Keluar"
        cancelText="Batal"
        showClose={false}
      />
    </div>
  );
};

export default TakeQuiz;

