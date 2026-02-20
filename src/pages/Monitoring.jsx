import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './Page.css';

const Monitoring = () => {
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [filters, setFilters] = useState({
    site: '',
    quizType: '',
    trainingTitle: '',
    dateFrom: '',
    dateTo: ''
  });
  
  // Options for filters
  const [sites, setSites] = useState([]);
  const [trainingTitles, setTrainingTitles] = useState([]);
  
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    totalParticipants: 0,
    totalAttempts: 0,
    averageScore: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [results, filters]);

  // Update stats when filtered results change
  useEffect(() => {
    if (filteredResults.length > 0 || results.length > 0) {
      const dataForStats = Object.values(filters).some(f => f !== '') ? filteredResults : results;
      const totalAttempts = dataForStats.length;
      const uniqueParticipants = new Set(dataForStats.map(r => r.participant_name)).size;
      const totalScore = dataForStats.reduce((sum, r) => sum + (r.percentage || 0), 0);
      const averageScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;

      setStats(prev => ({
        ...prev,
        totalParticipants: uniqueParticipants,
        totalAttempts: totalAttempts,
        averageScore: averageScore
      }));
    }
  }, [filteredResults, filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch quiz results dengan join ke quizzes
      const { data: resultsData, error: resultsError } = await supabase
        .from('quiz_results')
        .select(`
          *,
          quizzes (
            id,
            quiz_title,
            training_title,
            quiz_type
          )
        `)
        .order('completed_at', { ascending: false });

      // Fetch quizzes
      const { data: quizzesData, error: quizzesError } = await supabase
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch users untuk mendapatkan site
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('nama, site');

      if (resultsError) {
        console.error('Error fetching results:', resultsError);
      } else {
        // Enrich results dengan site dari users
        const enrichedResults = (resultsData || []).map(result => {
          const user = usersData?.find(u => u.nama === result.participant_name);
          return {
            ...result,
            site: user?.site || ''
          };
        });
        setResults(enrichedResults);
        // Initialize filteredResults dengan semua results
        setFilteredResults(enrichedResults);
      }

      if (quizzesError) {
        console.error('Error fetching quizzes:', quizzesError);
      } else {
        setQuizzes(quizzesData || []);
      }

      // Extract unique sites and training titles for filters
      if (usersData) {
        const uniqueSites = [...new Set(usersData.map(u => u.site).filter(Boolean))].sort();
        setSites(uniqueSites);
      }

      if (quizzesData) {
        const uniqueTrainingTitles = [...new Set(quizzesData.map(q => q.training_title).filter(Boolean))].sort();
        setTrainingTitles(uniqueTrainingTitles);
      }

      // Calculate statistics
      if (resultsData) {
        const enrichedResults = (resultsData || []).map(result => {
          const user = usersData?.find(u => u.nama === result.participant_name);
          return {
            ...result,
            site: user?.site || ''
          };
        });
        
        const totalAttempts = enrichedResults.length;
        const uniqueParticipants = new Set(enrichedResults.map(r => r.participant_name)).size;
        const totalScore = enrichedResults.reduce((sum, r) => sum + (r.percentage || 0), 0);
        const averageScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;

        setStats({
          totalQuizzes: quizzesData?.length || 0,
          totalParticipants: uniqueParticipants,
          totalAttempts: totalAttempts,
          averageScore: averageScore
        });
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...results];

    // Filter by site
    if (filters.site) {
      filtered = filtered.filter(r => r.site === filters.site);
    }

    // Filter by quiz type
    if (filters.quizType) {
      filtered = filtered.filter(r => r.quizzes?.quiz_type === filters.quizType);
    }

    // Filter by training title
    if (filters.trainingTitle) {
      filtered = filtered.filter(r => r.quizzes?.training_title === filters.trainingTitle);
    }

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(r => {
        const completedDate = new Date(r.completed_at);
        return completedDate >= fromDate;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => {
        const completedDate = new Date(r.completed_at);
        return completedDate <= toDate;
      });
    }

    setFilteredResults(filtered);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      site: '',
      quizType: '',
      trainingTitle: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  const exportToExcel = async () => {
    try {
      // Dynamic import untuk xlsx
      const XLSXModule = await import('xlsx');
      const XLSX = XLSXModule.default || XLSXModule;
      
      // Prepare data for export
      const exportData = filteredResults.map(result => ({
        'Nama Peserta': result.participant_name || 'Anonymous',
        'Site': result.site || '-',
        'Jenis Pelatihan': result.quizzes?.quiz_type || '-',
        'Nama Pelatihan': result.quizzes?.training_title || '-',
        'Judul Quiz': result.quizzes?.quiz_title || '-',
        'Tanggal Pelatihan': formatDate(result.completed_at),
        'Skor': result.score,
        'Total Soal': result.total_questions,
        'Persentase': `${result.percentage}%`,
        'Status': result.is_passed ? 'Lulus' : 'Tidak Lulus',
        'Waktu Selesai': formatDate(result.completed_at)
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data Monitoring');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `Monitoring_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Gagal mengexport data ke Excel. Silakan coba lagi atau pastikan package xlsx sudah terinstall.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getParticipantStats = (participantName) => {
    const participantResults = filteredResults.filter(r => r.participant_name === participantName);
    const attempts = participantResults.length;
    const averageScore = attempts > 0
      ? Math.round(participantResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / attempts)
      : 0;
    const bestScore = participantResults.length > 0
      ? Math.max(...participantResults.map(r => r.percentage || 0))
      : 0;
    const passedCount = participantResults.filter(r => r.is_passed).length;

    return { attempts, averageScore, bestScore, passedCount };
  };

  const uniqueParticipants = [...new Set(filteredResults.map(r => r.participant_name))];

  return (
    <div className="page-container">
      <div className="page-content">
        <h1 className="page-title">Monitoring</h1>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner">⏳</div>
            <p>Memuat data...</p>
          </div>
        ) : (
          <>
            {/* Filter Section */}
            <div className="monitoring-section" style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="section-title-monitoring">🔍 Filter Data</h2>
                <button
                  onClick={exportToExcel}
                  className="btn-submit-modern"
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}
                  disabled={filteredResults.length === 0}
                >
                  📥 Download Excel ({filteredResults.length} data)
                </button>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1rem',
                background: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div className="form-group-modern">
                  <label style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                    Site
                  </label>
                  <select
                    value={filters.site}
                    onChange={(e) => handleFilterChange('site', e.target.value)}
                    className="input-modern select-modern"
                    style={{ width: '100%' }}
                  >
                    <option value="">Semua Site</option>
                    {sites.map(site => (
                      <option key={site} value={site}>{site}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group-modern">
                  <label style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                    Jenis Pelatihan
                  </label>
                  <select
                    value={filters.quizType}
                    onChange={(e) => handleFilterChange('quizType', e.target.value)}
                    className="input-modern select-modern"
                    style={{ width: '100%' }}
                  >
                    <option value="">Semua Jenis</option>
                    <option value="Pre Test">Pre Test</option>
                    <option value="Post Test">Post Test</option>
                  </select>
                </div>

                <div className="form-group-modern">
                  <label style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                    Nama Pelatihan
                  </label>
                  <select
                    value={filters.trainingTitle}
                    onChange={(e) => handleFilterChange('trainingTitle', e.target.value)}
                    className="input-modern select-modern"
                    style={{ width: '100%' }}
                  >
                    <option value="">Semua Pelatihan</option>
                    {trainingTitles.map(title => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group-modern">
                  <label style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                    Tanggal Dari
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="input-modern"
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="form-group-modern">
                  <label style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                    Tanggal Sampai
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="input-modern"
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="form-group-modern" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    onClick={resetFilters}
                    className="btn-update-time"
                    style={{ width: '100%', padding: '0.75rem' }}
                  >
                    🔄 Reset Filter
                  </button>
                </div>
              </div>
              {Object.values(filters).some(f => f !== '') && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#e3f2fd', borderRadius: '8px', fontSize: '0.9rem' }}>
                  Menampilkan <strong>{filteredResults.length}</strong> dari <strong>{results.length}</strong> data
                </div>
              )}
            </div>

            <div className="monitoring-grid">
              <div className="monitoring-card">
                <h3>Statistik Quiz</h3>
                <div className="stat-item">
                  <span>Total Quiz Dibuat</span>
                  <span className="stat-value">{stats.totalQuizzes}</span>
                </div>
                <div className="stat-item">
                  <span>Total Peserta</span>
                  <span className="stat-value">{stats.totalParticipants}</span>
                </div>
                <div className="stat-item">
                  <span>Total Percobaan</span>
                  <span className="stat-value">{stats.totalAttempts}</span>
                </div>
                <div className="stat-item">
                  <span>Rata-rata Nilai</span>
                  <span className="stat-value">{stats.averageScore}%</span>
                </div>
              </div>

              <div className="monitoring-card">
                <h3>Ringkasan</h3>
                <div className="stat-item">
                  <span>Quiz dengan Hasil</span>
                  <span className="stat-value">
                    {new Set(filteredResults.map(r => r.quiz_id)).size}
                  </span>
                </div>
                <div className="stat-item">
                  <span>Lulus</span>
                  <span className="stat-value stat-pass">
                    {filteredResults.filter(r => r.is_passed).length}
                  </span>
                </div>
                <div className="stat-item">
                  <span>Tidak Lulus</span>
                  <span className="stat-value stat-fail">
                    {filteredResults.filter(r => !r.is_passed).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="monitoring-section">
              <h2 className="section-title-monitoring">📋 Data Peserta</h2>
              {uniqueParticipants.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <h3>Belum ada peserta</h3>
                  <p>Data peserta akan muncul setelah ada yang mengerjakan quiz</p>
                </div>
              ) : (
                <div className="participants-table-container">
                  <table className="participants-table">
                    <thead>
                      <tr>
                        <th>Nama Peserta</th>
                        <th>Jumlah Percobaan</th>
                        <th>Nilai Rata-rata</th>
                        <th>Nilai Terbaik</th>
                        <th>Lulus</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uniqueParticipants.map((participant, index) => {
                        const participantStats = getParticipantStats(participant);
                        return (
                          <tr key={index}>
                            <td><strong>{participant || 'Anonymous'}</strong></td>
                            <td>{participantStats.attempts}</td>
                            <td>{participantStats.averageScore}%</td>
                            <td>
                              <span className={`score-badge ${participantStats.bestScore >= 70 ? 'pass' : 'fail'}`}>
                                {participantStats.bestScore}%
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${participantStats.passedCount > 0 ? 'pass' : 'fail'}`}>
                                {participantStats.passedCount} kali
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => {
                                  const participantResults = results.filter(r => r.participant_name === participant);
                                  alert(`Detail ${participant}:\n\n${participantResults.map((r, i) => 
                                    `${i + 1}. ${r.quizzes?.quiz_title || 'Quiz'} - ${r.percentage}% (${r.is_passed ? 'Lulus' : 'Tidak Lulus'})\n   ${formatDate(r.completed_at)}`
                                  ).join('\n\n')}`);
                                }}
                                className="btn-view-detail"
                              >
                                Lihat
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="monitoring-section">
              <h2 className="section-title-monitoring">📝 Hasil Quiz Terbaru</h2>
              {filteredResults.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📝</div>
                  <h3>Belum ada hasil quiz</h3>
                  <p>{Object.values(filters).some(f => f !== '') ? 'Tidak ada data yang sesuai dengan filter' : 'Hasil quiz akan muncul setelah peserta mengerjakan quiz'}</p>
                </div>
              ) : (
                <div className="results-list-container">
                  {filteredResults.slice(0, 10).map((result, index) => (
                    <div key={result.id || index} className="result-card">
                      <div className="result-card-header">
                        <div className="result-quiz-info">
                          <h4>{result.quizzes?.quiz_title || 'Quiz'}</h4>
                          <span className="result-training-badge">
                            {result.quizzes?.training_title || ''}
                          </span>
                        </div>
                        <div className={`result-score-badge ${result.is_passed ? 'pass' : 'fail'}`}>
                          {result.percentage}%
                        </div>
                      </div>
                      <div className="result-card-body">
                        <div className="result-info-row">
                          <span className="result-label">👤 Peserta:</span>
                          <span>{result.participant_name || 'Anonymous'}</span>
                        </div>
                        <div className="result-info-row">
                          <span className="result-label">📊 Skor:</span>
                          <span>{result.score} / {result.total_questions}</span>
                        </div>
                        <div className="result-info-row">
                          <span className="result-label">✅ Status:</span>
                          <span className={result.is_passed ? 'status-pass' : 'status-fail'}>
                            {result.is_passed ? 'Lulus' : 'Tidak Lulus'}
                          </span>
                        </div>
                        <div className="result-info-row">
                          <span className="result-label">🕒 Waktu:</span>
                          <span>{formatDate(result.completed_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Monitoring;
