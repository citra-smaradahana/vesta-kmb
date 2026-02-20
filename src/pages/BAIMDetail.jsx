import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { certificateConfig } from '../config/certificateConfig';
import './Page.css';

const BAIMDetail = () => {
  const { trainingTitle } = useParams();
  const navigate = useNavigate();
  const decodedTrainingTitle = decodeURIComponent(trainingTitle);
  
  const [quizzes, setQuizzes] = useState([]);
  const [progress, setProgress] = useState({}); // { "BAIM 1": { preTestPassed: true, postTestPassed: false } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [participantName, setParticipantName] = useState('');
  const [isMobileView, setIsMobileView] = useState(() => window.matchMedia('(max-width: 768px)').matches);

  useEffect(() => {
    fetchQuizzes();
    fetchProgress();
  }, [decodedTrainingTitle]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleViewportChange = (e) => {
      setIsMobileView(e.matches);
    };

    setIsMobileView(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  // Refresh progress ketika kembali dari quiz (listen untuk focus event)
  useEffect(() => {
    const handleFocus = () => {
      // Refresh progress ketika window mendapat focus (user kembali dari quiz)
      fetchProgress();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Refresh progress ketika participantName berubah
  useEffect(() => {
    if (participantName) {
      fetchProgress();
    }
  }, [participantName]);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('training_title', decodedTrainingTitle)
        .order('quiz_title', { ascending: true })
        .order('quiz_type', { ascending: true });

      if (error) {
        console.error('Error fetching quizzes:', error);
        setError(error.message);
      } else {
        setQuizzes(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Gagal memuat quiz: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    try {
      // Selalu ambil nama dari user yang login
      let participantNameToUse = null;
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          participantNameToUse = user.nama || user.username || null;
          if (participantNameToUse) {
            setParticipantName(participantNameToUse);
            localStorage.setItem('participantName', participantNameToUse);
          }
        } catch (err) {
          console.error('Error parsing user data:', err);
        }
      }
      
      // Fallback ke localStorage jika user tidak ditemukan (seharusnya tidak terjadi)
      if (!participantNameToUse) {
        const savedName = localStorage.getItem('participantName');
        if (savedName) {
          participantNameToUse = savedName;
          setParticipantName(savedName);
        }
      }

      // Normalize nama peserta (trim untuk konsistensi)
      let normalizedName = (participantNameToUse || 'Anonymous').trim();
      
      console.log('Fetching progress for participant:', normalizedName); // Debug log

      // Fetch quiz results untuk cek progress
      // Ambil semua hasil quiz dan filter di client side untuk fleksibilitas
      const { data: allResults, error: fetchError } = await supabase
        .from('quiz_results')
        .select('quiz_id, percentage, is_passed, completed_at, expiry_date, participant_name, quizzes(quiz_title, quiz_type, minimum_score)')
        .order('completed_at', { ascending: false });

      console.log('All quiz results:', allResults?.length || 0, 'total results'); // Debug log
      if (allResults && allResults.length > 0) {
        console.log('Sample participant names in results:', allResults.slice(0, 5).map(r => r.participant_name)); // Debug log
      }

      // Filter di client side untuk case-insensitive matching
      // Juga cek untuk 'Anonymous' jika nama tidak ditemukan
      const results = allResults?.filter(r => {
        const participantNameInResult = (r.participant_name || '').trim();
        const normalizedResultName = participantNameInResult.toLowerCase();
        const normalizedSearchName = normalizedName.toLowerCase();
        
        // Exact match
        if (normalizedResultName === normalizedSearchName) return true;
        
        // Partial match (contains)
        if (normalizedResultName.includes(normalizedSearchName) || 
            normalizedSearchName.includes(normalizedResultName)) return true;
        
        // Jika mencari 'Anonymous', juga cek yang kosong atau null
        if (normalizedSearchName === 'anonymous' && 
            (participantNameInResult === '' || participantNameInResult === 'Anonymous' || !participantNameInResult)) {
          return true;
        }
        
        return false;
      }) || [];

      const error = fetchError;

      console.log('Quiz results found:', results?.length || 0, 'results'); // Debug log
      if (results && results.length > 0) {
        console.log('Sample result:', results[0]); // Debug log
      }

      if (!error && results) {
        const progressData = {};
        
        // Proses Post Test dulu untuk cek expired, baru Pre Test
        // Ini penting agar jika Post Test expired, Pre Test bisa di-reset
        
        // Step 1: Proses Post Test terlebih dahulu
        results.forEach(result => {
          const quiz = result.quizzes;
          if (quiz && quiz.quiz_type === 'Post Test' && quiz.quiz_title) {
            if (!progressData[quiz.quiz_title]) {
              progressData[quiz.quiz_title] = {
                preTestPassed: false,
                postTestPassed: false,
                preTestScore: null,
                postTestScore: null,
                preTestMinScore: null,
                postTestIsExpired: false // Default false (belum ada Post Test atau belum expired)
              };
            }
            
            // Pastikan postTestIsExpired selalu ada (default false)
            if (progressData[quiz.quiz_title].postTestIsExpired === undefined) {
              progressData[quiz.quiz_title].postTestIsExpired = false;
            }
            
            // Ambil hasil terbaru
            if (!progressData[quiz.quiz_title].postTestScore || 
                new Date(result.completed_at) > new Date(progressData[quiz.quiz_title].postTestCompletedAt || 0)) {
              // Cek apakah sertifikat masih valid (belum expired)
              let isStillValid = true;
              if (result.expiry_date) {
                const expiryDate = new Date(result.expiry_date);
                const now = new Date();
                isStillValid = expiryDate > now;
              }
              
              // Jika expired, set postTestPassed = false agar Post Test terkunci
              progressData[quiz.quiz_title].postTestPassed = result.is_passed && isStillValid;
              progressData[quiz.quiz_title].postTestScore = result.percentage;
              progressData[quiz.quiz_title].postTestCompletedAt = result.completed_at;
              progressData[quiz.quiz_title].postTestExpiryDate = result.expiry_date;
              progressData[quiz.quiz_title].postTestIsExpired = !isStillValid;
              
              // Jika sertifikat expired, reset Pre Test juga agar user harus mengulang dari awal
              if (!isStillValid && result.is_passed) {
                progressData[quiz.quiz_title].preTestPassed = false;
                progressData[quiz.quiz_title].preTestScore = null;
              }
            }
          }
        });
        
        // Step 2: Proses Pre Test (setelah Post Test)
        results.forEach(result => {
          const quiz = result.quizzes;
          if (quiz && quiz.quiz_type === 'Pre Test' && quiz.quiz_title) {
            if (!progressData[quiz.quiz_title]) {
              progressData[quiz.quiz_title] = {
                preTestPassed: false,
                postTestPassed: false,
                preTestScore: null,
                postTestScore: null,
                preTestMinScore: null,
                postTestIsExpired: false // Default false (belum ada Post Test atau belum expired)
              };
            }
            
            // Pastikan postTestIsExpired selalu ada (default false jika belum ada Post Test)
            if (progressData[quiz.quiz_title].postTestIsExpired === undefined) {
              progressData[quiz.quiz_title].postTestIsExpired = false;
            }
            
            // Ambil hasil terbaru (sudah di-sort descending)
            const existingScore = progressData[quiz.quiz_title].preTestScore;
            const existingDate = progressData[quiz.quiz_title].preTestCompletedAt;
            const shouldUpdate = !existingScore || 
                new Date(result.completed_at) > new Date(existingDate || 0);
            
            if (shouldUpdate) {
              const postTestExpired = progressData[quiz.quiz_title].postTestIsExpired || false;
              const postTestCompletedAt = progressData[quiz.quiz_title].postTestCompletedAt;
              
              // PERBAIKAN: Jika Post Test expired, cek apakah Pre Test ini dikerjakan SETELAH Post Test expired
              // Jika Pre Test dikerjakan setelah Post Test, maka Pre Test ini valid (user sedang mengulang)
              let preTestIsAfterExpiredPostTest = false;
              if (postTestExpired && postTestCompletedAt) {
                const preTestDate = new Date(result.completed_at);
                const postTestDate = new Date(postTestCompletedAt);
                preTestIsAfterExpiredPostTest = preTestDate > postTestDate;
              }
              
              console.log(`Processing Pre Test for ${quiz.quiz_title}:`, {
                is_passed: result.is_passed,
                score: result.percentage,
                postTestExpired: postTestExpired,
                preTestDate: result.completed_at,
                postTestDate: postTestCompletedAt,
                preTestIsAfterExpiredPostTest: preTestIsAfterExpiredPostTest,
                willSetPreTestPassed: (!postTestExpired || preTestIsAfterExpiredPostTest) && result.is_passed,
                currentPreTestPassed: progressData[quiz.quiz_title].preTestPassed
              }); // Debug log
              
              // Set Pre Test jika:
              // 1. Post Test tidak expired, ATAU
              // 2. Post Test expired TAPI Pre Test ini dikerjakan SETELAH Post Test (user sedang mengulang)
              if (!postTestExpired || preTestIsAfterExpiredPostTest) {
                progressData[quiz.quiz_title].preTestPassed = result.is_passed;
                progressData[quiz.quiz_title].preTestScore = result.percentage;
                progressData[quiz.quiz_title].preTestMinScore = quiz.minimum_score || 70;
                progressData[quiz.quiz_title].preTestCompletedAt = result.completed_at;
                
                console.log(`✅ Pre Test SET for ${quiz.quiz_title}:`, {
                  passed: result.is_passed,
                  score: result.percentage,
                  reason: preTestIsAfterExpiredPostTest ? 'Pre Test after expired Post Test' : 'No expired Post Test'
                }); // Debug log
              } else {
                console.log(`❌ Pre Test NOT SET (Post Test expired and Pre Test is older) for ${quiz.quiz_title}`); // Debug log
              }
              
              console.log(`Pre Test progress for ${quiz.quiz_title} after update:`, {
                passed: progressData[quiz.quiz_title].preTestPassed,
                score: progressData[quiz.quiz_title].preTestScore,
                minScore: quiz.minimum_score || 70,
                postTestExpired: postTestExpired
              }); // Debug log
            }
          }
        });
        
        console.log('Final progress data:', progressData); // Debug log
        console.log('Progress keys:', Object.keys(progressData)); // Debug log
        setProgress(progressData);
      } else if (error) {
        console.error('Error fetching progress:', error);
      } else {
        console.log('No results found for participant:', normalizedName);
      }
    } catch (err) {
      console.error('Error fetching progress:', err);
    }
  };

  const getQuestionCount = (questions) => {
    if (!questions || !Array.isArray(questions)) return 0;
    return questions.length;
  };

  const getQuestionsToDisplayCount = (quiz) => {
    const totalQuestions = getQuestionCount(quiz?.questions);
    if (totalQuestions === 0) return 0;

    const configuredCount = Number(quiz?.questions_to_display);
    if (Number.isFinite(configuredCount) && configuredCount > 0) {
      return Math.min(configuredCount, totalQuestions);
    }

    return totalQuestions;
  };

  // Group quizzes by BAIM number
  const groupedQuizzes = quizzes.reduce((acc, quiz) => {
    const baimNumber = quiz.quiz_title; // e.g., "BAIM 1"
    if (!acc[baimNumber]) {
      acc[baimNumber] = {
        preTest: null,
        postTest: null
      };
    }
    if (quiz.quiz_type === 'Pre Test') {
      acc[baimNumber].preTest = quiz;
    } else if (quiz.quiz_type === 'Post Test') {
      acc[baimNumber].postTest = quiz;
    }
    return acc;
  }, {});

  const baimNumbers = Object.keys(groupedQuizzes).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''));
    const numB = parseInt(b.replace(/\D/g, ''));
    return numA - numB;
  });

  const handleStartQuiz = async (quiz, baimNumber) => {
    // Jika Post Test, cek apakah Pre Test sudah passed (hanya jika ada Pre Test)
    if (quiz.quiz_type === 'Post Test') {
      // Cek apakah ada Pre Test untuk BAIM ini
      const hasPreTest = groupedQuizzes[baimNumber]?.preTest && getQuestionCount(groupedQuizzes[baimNumber].preTest.questions) > 0;
      
      // Jika tidak ada Pre Test, langsung izinkan akses Post Test
      if (!hasPreTest) {
        console.log('No Pre Test found for', baimNumber, '- allowing direct Post Test access');
        // Pastikan nama peserta sudah diambil dari user login
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            const userName = user.nama || user.username || '';
            if (userName) {
              setParticipantName(userName);
              localStorage.setItem('participantName', userName);
            }
          } catch (err) {
            console.error('Error parsing user data:', err);
          }
        }
        // Navigate ke quiz langsung
        navigate(`/take-quiz/${quiz.id}`);
        return;
      }
      
      // Ambil nama peserta dari user yang login
      let participantNameToCheck = participantName;
      if (!participantNameToCheck) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            participantNameToCheck = user.nama || user.username || 'Anonymous';
            setParticipantName(participantNameToCheck);
            localStorage.setItem('participantName', participantNameToCheck);
          } catch (err) {
            console.error('Error parsing user data:', err);
            participantNameToCheck = 'Anonymous';
          }
        } else {
          participantNameToCheck = localStorage.getItem('participantName') || 'Anonymous';
        }
      }
      const normalizedName = participantNameToCheck.trim();

      // Cek batas attempt untuk Post Test (maksimal 2 kali)
      if (normalizedName && normalizedName !== 'Anonymous') {
        const { data: postTestResults, error: resultsError } = await supabase
          .from('quiz_results')
          .select('id, is_passed, completed_at')
          .eq('quiz_id', quiz.id)
          .eq('participant_name', normalizedName)
          .order('completed_at', { ascending: false });

        if (!resultsError && postTestResults) {
          const attemptCount = postTestResults.length;
          
          // Jika sudah 2 kali attempt, cek apakah keduanya gagal
          if (attemptCount >= 2) {
            const failedAttempts = postTestResults.filter(r => !r.is_passed).length;
            
            if (failedAttempts >= 2) {
              // Lock Post Test - cek apakah ada Pre Test yang lulus setelah attempt terakhir
              const lastAttemptDate = new Date(postTestResults[0].completed_at);
              
              // Cari Pre Test untuk training yang sama
              const { data: preTestQuiz, error: preTestError } = await supabase
                .from('quizzes')
                .select('id')
                .eq('training_title', quiz.training_title)
                .eq('quiz_title', baimNumber)
                .eq('quiz_type', 'Pre Test')
                .maybeSingle();
              
              if (!preTestError && preTestQuiz) {
                // Cek apakah ada Pre Test yang lulus setelah Post Test terakhir
                const { data: preTestResults, error: preTestResultsError } = await supabase
                  .from('quiz_results')
                  .select('id, is_passed, completed_at')
                  .eq('quiz_id', preTestQuiz.id)
                  .eq('participant_name', normalizedName)
                  .eq('is_passed', true)
                  .gt('completed_at', lastAttemptDate.toISOString())
                  .order('completed_at', { ascending: false })
                  .limit(1);
                
                if (preTestResultsError || !preTestResults || preTestResults.length === 0) {
                  // Post Test terkunci - harus mengerjakan Pre Test dulu
                  setShowModal(true);
                  setModalContent({
                    type: 'error',
                    title: 'Post Test Terkunci',
                    message: '⚠️ Post Test terkunci! Anda sudah mencoba 2 kali dan gagal. Silakan kerjakan Pre Test terlebih dahulu untuk membuka Post Test kembali.',
                  });
                  return;
                }
              } else if (hasPreTest) {
                // Ada Pre Test tapi tidak ditemukan di database
                setShowModal(true);
                setModalContent({
                  type: 'error',
                  title: 'Post Test Terkunci',
                  message: '⚠️ Post Test terkunci! Anda sudah mencoba 2 kali dan gagal. Silakan kerjakan Pre Test terlebih dahulu untuk membuka Post Test kembali.',
                });
                return;
              }
            }
          }
        }
      }

      // Jika ada Pre Test, cek apakah Pre Test sudah passed
      // Refresh progress dulu untuk memastikan data terbaru
      await fetchProgress();
      
      // Tunggu sebentar untuk state update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('Checking Post Test access for:', baimNumber, 'Participant:', normalizedName); // Debug log
      
      // Fetch progress lagi untuk mendapatkan state terbaru dengan query langsung
      const { data: allLatestResults, error: latestFetchError } = await supabase
        .from('quiz_results')
        .select('quiz_id, percentage, is_passed, completed_at, expiry_date, participant_name, quizzes(quiz_title, quiz_type, minimum_score)')
        .order('completed_at', { ascending: false });

      // Filter di client side untuk case-insensitive matching
      const latestResults = allLatestResults?.filter(r => {
        const participantNameInResult = (r.participant_name || '').trim();
        return participantNameInResult.toLowerCase() === normalizedName.toLowerCase() ||
               participantNameInResult.toLowerCase().includes(normalizedName.toLowerCase()) ||
               normalizedName.toLowerCase().includes(participantNameInResult.toLowerCase());
      }) || [];

      const latestError = latestFetchError;

      console.log('Latest results for Post Test check:', latestResults?.length || 0); // Debug log

      if (!latestError && latestResults) {
        // Cari hasil Pre Test terbaru untuk BAIM ini
        const preTestResult = latestResults.find(r => 
          r.quizzes?.quiz_title === baimNumber && 
          r.quizzes?.quiz_type === 'Pre Test'
        );

        // Cek juga hasil Post Test untuk melihat apakah sertifikat expired
        const postTestResult = latestResults.find(r => 
          r.quizzes?.quiz_title === baimNumber && 
          r.quizzes?.quiz_type === 'Post Test'
        );

        // Jika sertifikat Post Test expired, maka Pre Test dan Post Test harus diulang
        let shouldRequirePreTest = true;
        if (postTestResult && postTestResult.is_passed && postTestResult.expiry_date) {
          const expiryDate = new Date(postTestResult.expiry_date);
          const now = new Date();
          if (expiryDate > now) {
            // Sertifikat masih valid, tidak perlu ulang Pre Test
            shouldRequirePreTest = false;
          }
        }

        console.log('Pre Test result found:', preTestResult ? {
          passed: preTestResult.is_passed,
          score: preTestResult.percentage,
          minScore: preTestResult.quizzes?.minimum_score
        } : 'Not found'); // Debug log
        console.log('Post Test result found:', postTestResult ? {
          passed: postTestResult.is_passed,
          score: postTestResult.percentage,
          expiry_date: postTestResult.expiry_date,
          is_expired: postTestResult.expiry_date ? new Date(postTestResult.expiry_date) <= new Date() : false
        } : 'Not found'); // Debug log

        if (shouldRequirePreTest && (!preTestResult || !preTestResult.is_passed)) {
          const minScore = preTestResult?.quizzes?.minimum_score || 70;
          const actualScore = preTestResult?.percentage || 0;
          setShowModal(true);
          setModalContent({
            type: 'warning',
            title: 'Pre Test Belum Selesai',
            message: `Anda harus menyelesaikan Pre Test untuk ${baimNumber} terlebih dahulu dengan nilai minimum ${minScore}% sebelum dapat mengerjakan Post Test.${preTestResult ? ` Skor Anda: ${actualScore}%` : ''}`,
          });
          return;
        }
      } else {
        // Jika tidak ada data, cek dari state progress
        const currentProgress = progress[baimNumber];
        console.log('Using state progress:', currentProgress); // Debug log
        if (!currentProgress || !currentProgress.preTestPassed) {
          setShowModal(true);
          setModalContent({
            type: 'warning',
            title: 'Pre Test Belum Selesai',
            message: `Anda harus menyelesaikan Pre Test untuk ${baimNumber} terlebih dahulu dengan nilai minimum ${currentProgress?.preTestMinScore || 70}% sebelum dapat mengerjakan Post Test.`,
          });
          return;
        }
      }
    }

    // Pastikan nama peserta sudah diambil dari user login
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const userName = user.nama || user.username || '';
        if (userName) {
          setParticipantName(userName);
          localStorage.setItem('participantName', userName);
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }
    
    // Navigate ke quiz
    navigate(`/take-quiz/${quiz.id}`);
  };

  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({
    type: 'info',
    title: '',
    message: '',
  });
  const [showStartQuizModal, setShowStartQuizModal] = useState(false);
  const [pendingQuizStart, setPendingQuizStart] = useState(null);

  const handleQuizCardClick = (quiz, baimNumber, canAccessPostTest = true) => {
    if (quiz.quiz_type === 'Post Test' && !canAccessPostTest) {
      handleStartQuiz(quiz, baimNumber);
      return;
    }

    const questionCount = getQuestionsToDisplayCount(quiz);
    const timeInfo = quiz.time_limit ? `${quiz.time_limit} menit` : 'Tanpa batas waktu';
    setPendingQuizStart({ quiz, baimNumber });
    setShowStartQuizModal(true);
    setModalContent({
      type: 'confirm',
      title: `${quiz.quiz_type} - ${baimNumber}`,
      message: `Jumlah soal: ${questionCount}\nWaktu pengerjaan: ${timeInfo}\n\nApakah Anda siap mengerjakan quiz ini?`,
    });
  };

  const getProgressPercentage = () => {
    if (baimNumbers.length === 0) return 0;
    const completedCount = baimNumbers.filter(baim => {
      const prog = progress[baim];
      return prog && prog.preTestPassed && prog.postTestPassed;
    }).length;
    return Math.round((completedCount / baimNumbers.length) * 100);
  };

  // Fungsi untuk download sertifikat dari Card BAIM
  const handleDownloadCertificate = async (baimNumber) => {
    try {
      // Ambil nama peserta dari user yang login
      let participantNameToUse = participantName;
      if (!participantNameToUse) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            participantNameToUse = user.nama || user.username || 'Anonymous';
          } catch (err) {
            console.error('Error parsing user data:', err);
            participantNameToUse = 'Anonymous';
          }
        } else {
          participantNameToUse = localStorage.getItem('participantName') || 'Anonymous';
        }
      }
      
      const normalizedName = participantNameToUse.trim();

      // Fetch quiz data untuk post test dari BAIM ini
      const { data: postTestQuiz, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('training_title', decodedTrainingTitle)
        .eq('quiz_title', baimNumber)
        .eq('quiz_type', 'Post Test')
        .single();

      if (quizError || !postTestQuiz) {
        alert('Gagal memuat data quiz. Silakan coba lagi.');
        console.error('Error fetching quiz:', quizError);
        return;
      }

      // Fetch quiz result terbaru untuk post test ini
      const { data: allResults, error: resultsError } = await supabase
        .from('quiz_results')
        .select('*, quizzes(quiz_title, quiz_type)')
        .eq('quiz_id', postTestQuiz.id)
        .order('completed_at', { ascending: false });

      if (resultsError) {
        alert('Gagal memuat hasil quiz. Silakan coba lagi.');
        console.error('Error fetching quiz results:', resultsError);
        return;
      }

      // Filter hasil untuk participant name (case-insensitive)
      const participantResults = allResults?.filter(r => {
        const participantNameInResult = (r.participant_name || '').trim();
        return participantNameInResult.toLowerCase() === normalizedName.toLowerCase() ||
               participantNameInResult.toLowerCase().includes(normalizedName.toLowerCase()) ||
               normalizedName.toLowerCase().includes(participantNameInResult.toLowerCase());
      }) || [];

      // Ambil hasil terbaru yang lulus dan masih valid (belum expired)
      const now = new Date();
      const passedResult = participantResults.find(r => {
        if (!r.is_passed) return false;
        // Jika ada expiry_date, cek apakah masih valid
        if (r.expiry_date) {
          const expiryDate = new Date(r.expiry_date);
          return expiryDate > now;
        }
        // Jika tidak ada expiry_date, berarti tidak ada masa berlaku, selalu valid
        return true;
      });

      if (!passedResult) {
        alert('Anda belum menyelesaikan Post Test, belum lulus, atau sertifikat sudah expired. Silakan selesaikan Post Test terlebih dahulu.');
        return;
      }

      // Fetch user data untuk sertifikat
      let userDataForCert = null;
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          const { data, error: userError } = await supabase
            .from('users')
            .select('nama, jabatan, nrp')
            .eq('username', user.username)
            .maybeSingle();
          
          if (!userError && data) {
            userDataForCert = {
              nama: data.nama || participantNameToUse,
              jabatan: data.jabatan || '',
              nrp: data.nrp || ''
            };
          } else {
            userDataForCert = {
              nama: participantNameToUse,
              jabatan: '',
              nrp: ''
            };
          }
        } catch (err) {
          console.error('Error parsing user data:', err);
          userDataForCert = {
            nama: participantNameToUse,
            jabatan: '',
            nrp: ''
          };
        }
      } else {
        userDataForCert = {
          nama: participantNameToUse,
          jabatan: '',
          nrp: ''
        };
      }

      // Generate sertifikat
      const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('id-ID', options);
      };

      const config = certificateConfig;

      // Jika menggunakan template gambar
      if (config.template.useTemplate && config.template.imagePath) {
        await generateCertificateFromTemplate(
          config,
          formatDate,
          passedResult,
          postTestQuiz,
          userDataForCert,
          participantNameToUse
        );
        return;
      }

      // Default method (seharusnya tidak digunakan jika template aktif)
      alert('Template sertifikat tidak ditemukan. Silakan hubungi administrator.');
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Gagal mengunduh sertifikat. Silakan coba lagi.\nError: ' + error.message);
    }
  };

  // Fungsi untuk generate sertifikat dari template gambar
  const generateCertificateFromTemplate = async (
    config,
    formatDate,
    quizResult,
    quiz,
    userData,
    participantName
  ) => {
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
      // Draw "Grade" menggunakan posisi terpisah
      drawText(
        config.texts.gradeLabel,
        positions.gradeLabel.x,
        positions.gradeLabel.y,
        styles.gradeLabel
      );
      // Draw nilai menggunakan posisi terpisah
      drawText(
        quizResult.percentage.toString(),
        positions.gradeValue.x,
        positions.gradeValue.y,
        styles.gradeValue
      );

      // Valid Date - Format: "Valid" di baris pertama, "tanggal Pekerjaan until expired date" di baris kedua
      const completedDateStr = formatDate(quizResult.completed_at || new Date().toISOString());
      
      if (quizResult.expiry_date) {
        const expiryDateStr = formatDate(quizResult.expiry_date);
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

      // Signature tidak ditampilkan (config.signature.show = false)

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

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="training-detail-container">
          <div className="training-detail-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            {isMobileView && (
              <button 
                onClick={() => navigate('/kmb-learning')}
                className="btn-back"
                style={{ padding: '0.5rem 1rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                ← Kembali
              </button>
            )}
            <h1 className="page-title">{decodedTrainingTitle}</h1>
          </div>
          
          <div className="progress-overview" style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            color: 'white',
            marginBottom: '2rem'
          }}>
            <div className="training-progress-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Progress Pelatihan</h3>
              <button 
                onClick={fetchProgress}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                title="Refresh Progress"
              >
                🔄 Refresh
              </button>
            </div>
            <div className="training-progress-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: '8px', height: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ 
                  background: 'white', 
                  height: '100%', 
                  width: `${getProgressPercentage()}%`, 
                  transition: 'width 0.3s ease',
                  borderRadius: '8px'
                }}></div>
              </div>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{getProgressPercentage()}%</span>
            </div>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
              {baimNumbers.filter(baim => {
                const prog = progress[baim];
                return prog && prog.preTestPassed && prog.postTestPassed;
              }).length} dari {baimNumbers.length} materi selesai
            </p>
            {participantName && (
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.8 }}>
                Peserta: {participantName}
              </p>
            )}
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner">⏳</div>
              <p>Memuat materi pelatihan...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <div className="error-icon">⚠️</div>
              <h3>Terjadi Kesalahan</h3>
              <p>{error}</p>
              <button onClick={fetchQuizzes} className="btn-retry">
                Coba Lagi
              </button>
            </div>
          ) : baimNumbers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <h3>Belum ada materi tersedia</h3>
              <p>Silakan buat quiz baru di menu Input Quiz</p>
            </div>
          ) : (
            <div className="baim-grid">
            {baimNumbers.map((baimNumber) => {
              const { preTest, postTest } = groupedQuizzes[baimNumber];
              const hasPreTest = preTest && getQuestionCount(preTest.questions) > 0;
              const hasPostTest = postTest && getQuestionCount(postTest.questions) > 0;
              const baimProgress = progress[baimNumber] || {};
              // Pastikan kita menggunakan quiz_title yang sama dari database
              // baimNumber adalah quiz_title dari groupedQuizzes, yang harus match dengan key di progress
              // Jika tidak ada Pre Test, Post Test bisa langsung diakses
              const canAccessPostTest = !hasPreTest || baimProgress.preTestPassed;
              
              // Debug log untuk troubleshooting
              console.log(`BAIM ${baimNumber} progress check:`, {
                baimNumber,
                preTestPassed: baimProgress.preTestPassed,
                postTestPassed: baimProgress.postTestPassed,
                postTestIsExpired: baimProgress.postTestIsExpired,
                canAccessPostTest,
                progressExists: !!baimProgress,
                allProgressKeys: Object.keys(progress),
                progressValue: baimProgress
              });

              // Format display: split jika ada "INTRODUCTION" atau "SURFACE" atau subtitle lainnya
              const formatBaimTitle = (title) => {
                // Handle BAIM 1: "BAIM 1 INTRODUCTION TO EXPLOSIVE"
                if (title.includes(' INTRODUCTION')) {
                  const parts = title.split(' INTRODUCTION');
                  return {
                    main: parts[0], // "BAIM 1"
                    subtitle: 'INTRODUCTION' + (parts[1] || '') // "INTRODUCTION TO EXPLOSIVE"
                  };
                }
                // Handle BAIM 2: "BAIM 2 SURFACE BULK EXPLOSIVES"
                if (title.includes(' SURFACE')) {
                  const parts = title.split(' SURFACE');
                  return {
                    main: parts[0], // "BAIM 2"
                    subtitle: 'SURFACE' + (parts[1] || '') // "SURFACE BULK EXPLOSIVES"
                  };
                }
                // Default: tidak ada subtitle
                return { main: title, subtitle: null };
              };

              const titleParts = formatBaimTitle(baimNumber);

              return (
                <div key={baimNumber} className="baim-card">
                  <div className="baim-card-header">
                    <div className="baim-title-container">
                      <h2 className="baim-title">{titleParts.main}</h2>
                      {titleParts.subtitle && (
                        <p className="baim-subtitle">{titleParts.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <div className="baim-card-body">
                    {/* Tombol Download Sertifikat - Selalu tampil, disabled jika Post Test belum selesai atau expired */}
                    <div style={{ 
                      marginBottom: isMobileView ? '0.6rem' : '1rem',
                      padding: '1rem', 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <button
                        onClick={() => handleDownloadCertificate(baimNumber)}
                        disabled={!baimProgress.postTestPassed || baimProgress.postTestIsExpired}
                        style={{
                          background: 'white',
                          color: '#667eea',
                          border: 'none',
                          padding: isMobileView ? '0.45rem 0.6rem' : '0.75rem 1.5rem',
                          borderRadius: '8px',
                          fontSize: isMobileView ? '0.72rem' : '1rem',
                          fontWeight: '600',
                          cursor: (!baimProgress.postTestPassed || baimProgress.postTestIsExpired) ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: isMobileView ? '0.3rem' : '0.5rem',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          opacity: (!baimProgress.postTestPassed || baimProgress.postTestIsExpired) ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!(!baimProgress.postTestPassed || baimProgress.postTestIsExpired)) {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        }}
                      >
                        <span>🏆</span>
                        <span>{isMobileView ? 'Sertifikat' : 'Download Sertifikat'}</span>
                      </button>
                    </div>
                    <div 
                      className="quiz-types-container"
                      style={{
                        gridTemplateColumns: hasPreTest ? '1fr 1fr' : '1fr'
                      }}
                    >
                      {/* Hanya tampilkan Pre Test jika ada */}
                      {hasPreTest && (
                        <div
                          className={`quiz-type-card pre-test ${baimProgress.preTestPassed ? 'completed' : ''} ${isMobileView ? 'mobile-minimal' : ''}`}
                          onClick={() => handleQuizCardClick(preTest, baimNumber, true)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="quiz-type-header">
                            <span className="quiz-type-icon">📝</span>
                            <h3>Pre Test</h3>
                          </div>
                        </div>
                      )}

                      {hasPostTest ? (
                        <div 
                          className={`quiz-type-card post-test ${!canAccessPostTest ? 'locked' : ''} ${baimProgress.postTestPassed ? 'completed' : ''} ${isMobileView ? 'mobile-minimal' : ''}`}
                          onClick={canAccessPostTest ? () => handleQuizCardClick(postTest, baimNumber, canAccessPostTest) : undefined}
                          style={{
                            gridColumn: !hasPreTest ? '1 / -1' : 'auto',
                            cursor: canAccessPostTest ? 'pointer' : 'not-allowed',
                            opacity: canAccessPostTest ? 1 : 0.6
                          }}
                        >
                          <div className="quiz-type-header">
                            <span className="quiz-type-icon">✅</span>
                            <h3>Post Test</h3>
                          </div>
                        </div>
                      ) : (
                        <div className="quiz-type-card empty">
                          <div className="quiz-type-header">
                            <span className="quiz-type-icon">✅</span>
                            <h3>Post Test</h3>
                          </div>
                          <p className="quiz-empty-message">Belum tersedia</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={() => setShowModal(false)}
        title={modalContent.title}
        message={modalContent.message}
        type={modalContent.type}
        showCancel={false}
        confirmText="OK"
        showClose={false}
      />

      <Modal
        isOpen={showStartQuizModal}
        onClose={() => {
          setShowStartQuizModal(false);
          setPendingQuizStart(null);
        }}
        onConfirm={async () => {
          if (!pendingQuizStart) return;
          await handleStartQuiz(pendingQuizStart.quiz, pendingQuizStart.baimNumber);
          setPendingQuizStart(null);
        }}
        title={modalContent.title}
        message={modalContent.message}
        type="confirm"
        showCancel={true}
        confirmText="Ya, Mulai"
        cancelText="Batal"
        showClose={false}
      />
    </div>
  );
};

export default BAIMDetail;

