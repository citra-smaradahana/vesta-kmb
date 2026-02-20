import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Page.css';

const RiwayatPengerjaan = () => {
  const navigate = useNavigate();
  const [isMobileView, setIsMobileView] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [loading, setLoading] = useState(true);
  const [trainingHistory, setTrainingHistory] = useState([]);

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

  useEffect(() => {
    fetchTrainingHistory();
  }, []);

  const fetchTrainingHistory = async () => {
    try {
      setLoading(true);

      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        setTrainingHistory([]);
        return;
      }

      let participantName = '';
      try {
        const parsedUser = JSON.parse(storedUser);
        participantName = parsedUser?.nama || '';
      } catch (err) {
        console.error('Error parsing user for history:', err);
      }

      if (!participantName) {
        setTrainingHistory([]);
        return;
      }

      const { data, error } = await supabase
        .from('quiz_results')
        .select(`
          completed_at,
          is_passed,
          quizzes (
            training_title
          )
        `)
        .eq('participant_name', participantName)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('Error fetching history:', error);
        setTrainingHistory([]);
        return;
      }

      const historyMap = new Map();
      (data || []).forEach((row) => {
        const trainingTitle = row.quizzes?.training_title;
        if (!trainingTitle) return;

        if (!historyMap.has(trainingTitle)) {
          historyMap.set(trainingTitle, {
            trainingTitle,
            attempts: 0,
            passedCount: 0,
            latestCompletedAt: row.completed_at
          });
        }

        const item = historyMap.get(trainingTitle);
        item.attempts += 1;
        if (row.is_passed) item.passedCount += 1;

        if (new Date(row.completed_at) > new Date(item.latestCompletedAt)) {
          item.latestCompletedAt = row.completed_at;
        }
      });

      const historyList = Array.from(historyMap.values()).sort(
        (a, b) => new Date(b.latestCompletedAt) - new Date(a.latestCompletedAt)
      );
      setTrainingHistory(historyList);
    } catch (err) {
      console.error('Error fetching history page:', err);
      setTrainingHistory([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <h1 className="page-title">Riwayat Pengerjaan</h1>

        {isMobileView && (
          <div style={{ marginBottom: '0.75rem' }}>
            <button type="button" className="btn-view-detail" onClick={() => navigate('/')}>
              Kembali ke Home
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner">⏳</div>
            <p>Memuat riwayat...</p>
          </div>
        ) : trainingHistory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>Belum ada riwayat</h3>
            <p>Riwayat training Anda akan muncul setelah mengerjakan quiz.</p>
          </div>
        ) : (
          <div className="mobile-history-section" style={{ marginTop: 0 }}>
            <div className="mobile-history-list">
              {trainingHistory.map((item) => (
                <div key={item.trainingTitle} className="mobile-history-card">
                  <h4>{item.trainingTitle}</h4>
                  <p>Attempt: {item.attempts}</p>
                  <p>Lulus: {item.passedCount}</p>
                  <p>
                    Terakhir:{' '}
                    {new Date(item.latestCompletedAt).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiwayatPengerjaan;
