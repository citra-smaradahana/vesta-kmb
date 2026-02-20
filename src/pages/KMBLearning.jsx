import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Page.css';

const KMBLearning = () => {
  const navigate = useNavigate();
  const [trainingPrograms, setTrainingPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTrainingPrograms();
  }, []);

  const fetchTrainingPrograms = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Ambil semua training_title yang unik beserta card_image_url
      const { data, error } = await supabase
        .from('quizzes')
        .select('training_title, card_image_url')
        .order('training_title', { ascending: true });

      if (error) {
        console.error('Error fetching training programs:', error);
        setError(error.message);
      } else {
        // Get unique training titles dengan card_image_url
        const trainingMap = new Map();
        (data || []).forEach(q => {
          if (q.training_title) {
            if (!trainingMap.has(q.training_title)) {
              trainingMap.set(q.training_title, q.card_image_url || null);
            } else if (q.card_image_url && !trainingMap.get(q.training_title)) {
              // Update jika belum ada image dan ada yang baru
              trainingMap.set(q.training_title, q.card_image_url);
            }
          }
        });
        
        // Convert to array of objects
        const uniquePrograms = Array.from(trainingMap.entries()).map(([title, imageUrl]) => ({
          title,
          imageUrl
        }));
        
        setTrainingPrograms(uniquePrograms);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Gagal memuat program pelatihan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <h1 className="page-title">KMB Learning</h1>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner">⏳</div>
            <p>Memuat program pelatihan...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <h3>Terjadi Kesalahan</h3>
            <p>{error}</p>
            <button onClick={fetchTrainingPrograms} className="btn-retry">
              Coba Lagi
            </button>
          </div>
        ) : trainingPrograms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>Belum ada program pelatihan tersedia</h3>
            <p>Silakan buat quiz baru di menu Input Quiz</p>
          </div>
        ) : (
          <div className="training-programs-grid">
            {trainingPrograms.map((program) => (
              <div 
                key={program.title || program} 
                className="training-program-card"
                onClick={() => navigate(`/training/${encodeURIComponent(program.title || program)}`)}
              >
                <div className="training-program-image-container">
                  <img 
                    src={program.imageUrl || `/images/Charging.jpeg`} 
                    alt={program.title || program}
                    className="training-program-image"
                    onError={(e) => {
                      // Fallback jika gambar tidak ditemukan
                      if (e.target.src.includes('/images/Charging.jpeg')) {
                        // Jika fallback juga gagal, sembunyikan gambar
                        e.target.style.display = 'none';
                        const container = e.target.parentElement;
                        if (container) {
                          container.classList.add('no-image');
                        }
                      } else {
                        // Coba fallback ke gambar default
                        e.target.src = '/images/Charging.jpeg';
                      }
                    }}
                  />
                  <div className="training-program-overlay">
                    <h2 className="training-program-title">{program.title || program}</h2>
                  </div>
                </div>
                <div className="training-program-body">
                  <p className="training-program-description">
                    Klik untuk melihat materi pelatihan
                  </p>
                  <div className="training-program-arrow">→</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KMBLearning;
