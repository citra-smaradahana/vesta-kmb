import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import './Page.css';

const Home = () => {
  const navigate = useNavigate();
  const [isMobileView, setIsMobileView] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    totalAttempts: 0,
    totalParticipants: 0,
    averageScore: 0,
    passedCount: 0,
    failedCount: 0,
    totalSites: 0,
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [quizTypeData, setQuizTypeData] = useState([]);
  const [siteData, setSiteData] = useState([]);

  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe'];

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
    if (!isMobileView) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [isMobileView]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch quiz results
      const { data: resultsData, error: resultsError } = await supabase
        .from('quiz_results')
        .select(`
          *,
          quizzes (
            quiz_title,
            training_title,
            quiz_type
          )
        `)
        .order('completed_at', { ascending: false });

      // Fetch quizzes
      const { data: quizzesData, error: quizzesError } = await supabase
        .from('quizzes')
        .select('id, quiz_title, training_title, quiz_type');

      // Fetch users untuk mendapatkan site
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('nama, site');

      if (resultsError) {
        console.error('Error fetching results:', resultsError);
      }

      if (quizzesError) {
        console.error('Error fetching quizzes:', quizzesError);
      }

      if (usersError) {
        console.error('Error fetching users:', usersError);
      }

      const results = resultsData || [];
      const quizzes = quizzesData || [];
      const users = usersData || [];

      // Enrich results dengan site dari users
      const enrichedResults = results.map(result => {
        const user = users.find(u => u.nama === result.participant_name);
        return {
          ...result,
          site: user?.site || 'Unknown'
        };
      });

      // Calculate statistics
      const totalAttempts = enrichedResults.length;
      const uniqueParticipants = new Set(enrichedResults.map(r => r.participant_name)).size;
      const totalScore = enrichedResults.reduce((sum, r) => sum + (r.percentage || 0), 0);
      const averageScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;
      const passedCount = enrichedResults.filter(r => r.is_passed).length;
      const failedCount = totalAttempts - passedCount;
      const uniqueSites = new Set(enrichedResults.map(r => r.site).filter(Boolean));
      const totalSites = uniqueSites.size;

      setStats({
        totalQuizzes: quizzes.length,
        totalAttempts,
        totalParticipants: uniqueParticipants,
        averageScore,
        passedCount,
        failedCount,
        totalSites,
      });

      // Prepare monthly data (last 6 months)
      const monthlyMap = new Map();
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        monthlyMap.set(monthKey, 0);
      }

      enrichedResults.forEach(result => {
        if (result.completed_at) {
          const date = new Date(result.completed_at);
          const monthKey = date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
          if (monthlyMap.has(monthKey)) {
            monthlyMap.set(monthKey, monthlyMap.get(monthKey) + 1);
          }
        }
      });

      const monthlyArray = Array.from(monthlyMap.entries()).map(([month, count]) => ({
        month,
        jumlah: count,
      }));
      setMonthlyData(monthlyArray);

      // Prepare daily data (last 7 days)
      const dailyMap = new Map();
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayKey = date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
        dailyMap.set(dayKey, 0);
      }

      enrichedResults.forEach(result => {
        if (result.completed_at) {
          const date = new Date(result.completed_at);
          const today = new Date();
          const diffTime = today - date;
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 6) {
            const dayKey = date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
            if (dailyMap.has(dayKey)) {
              dailyMap.set(dayKey, dailyMap.get(dayKey) + 1);
            }
          }
        }
      });

      const dailyArray = Array.from(dailyMap.entries()).map(([day, count]) => ({
        day,
        jumlah: count,
      }));
      setDailyData(dailyArray);

      // Prepare quiz type data
      const typeMap = new Map();
      enrichedResults.forEach(result => {
        const quizType = result.quizzes?.quiz_type || 'Unknown';
        typeMap.set(quizType, (typeMap.get(quizType) || 0) + 1);
      });

      const typeArray = Array.from(typeMap.entries()).map(([name, value]) => ({
        name,
        value,
      }));
      setQuizTypeData(typeArray);

      // Prepare site data
      const siteMap = new Map();
      enrichedResults.forEach(result => {
        const site = result.site || 'Unknown';
        siteMap.set(site, (siteMap.get(site) || 0) + 1);
      });

      const siteArray = Array.from(siteMap.entries())
        .map(([name, value]) => ({
          name: name || 'Unknown',
          value,
        }))
        .sort((a, b) => b.value - a.value); // Sort by value descending
      setSiteData(siteArray);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusData = [
    { name: 'Lulus', value: stats.passedCount, color: '#10b981' },
    { name: 'Tidak Lulus', value: stats.failedCount, color: '#ef4444' },
  ];

  if (isMobileView) {
    return (
      <div className="page-container">
        <div className="page-content">
          <h1 className="page-title">Home</h1>

          <div className="mobile-home-menu-grid">
            <button
              className="mobile-home-menu-card"
              onClick={() => navigate('/kmb-learning')}
            >
              <span className="mobile-home-menu-icon">📚</span>
              <span className="mobile-home-menu-title">KMB Learning</span>
              <span className="mobile-home-menu-desc">Buka daftar training</span>
            </button>

            <button
              className="mobile-home-menu-card"
              onClick={() => navigate('/riwayat-pengerjaan')}
            >
              <span className="mobile-home-menu-icon">🕘</span>
              <span className="mobile-home-menu-title">Riwayat Pengerjaan</span>
              <span className="mobile-home-menu-desc">Lihat training yang sudah dikerjakan</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Memuat data dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <h1 className="page-title">Dashboard</h1>

        {/* KPI Cards */}
        <div className="stats-grid" style={{ marginBottom: '2rem' }}>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <div className="stat-icon" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>📚</div>
            <div className="stat-info">
              <h3 style={{ color: 'white', margin: 0 }}>Total Quiz</h3>
              <p className="stat-number" style={{ color: 'white', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>
                {stats.totalQuizzes}
              </p>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <div className="stat-icon" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>✅</div>
            <div className="stat-info">
              <h3 style={{ color: 'white', margin: 0 }}>Quiz Selesai</h3>
              <p className="stat-number" style={{ color: 'white', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>
                {stats.totalAttempts}
              </p>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <div className="stat-icon" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>👥</div>
            <div className="stat-info">
              <h3 style={{ color: 'white', margin: 0 }}>Peserta Aktif</h3>
              <p className="stat-number" style={{ color: 'white', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>
                {stats.totalParticipants}
              </p>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
            <div className="stat-icon" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>📊</div>
            <div className="stat-info">
              <h3 style={{ color: 'white', margin: 0 }}>Nilai Rata-rata</h3>
              <p className="stat-number" style={{ color: 'white', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>
                {stats.averageScore}%
              </p>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
            <div className="stat-icon" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>🏢</div>
            <div className="stat-info">
              <h3 style={{ color: 'white', margin: 0 }}>Total Site</h3>
              <p className="stat-number" style={{ color: 'white', fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>
                {stats.totalSites}
              </p>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Site Distribution Chart (Bar) */}
          <div className="chart-card">
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
              Distribusi Quiz per Site
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={siteData.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#667eea" name="Jumlah Quiz" />
              </BarChart>
            </ResponsiveContainer>
            {siteData.length > 10 && (
              <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                Menampilkan 10 site teratas dari {siteData.length} site
              </p>
            )}
          </div>

          {/* Status Quiz Chart (Doughnut) */}
          <div className="chart-card">
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
              Status Quiz
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
              {statusData.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '16px', height: '16px', backgroundColor: item.color, borderRadius: '4px' }}></div>
                  <span style={{ fontSize: '0.9rem' }}>{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quiz Type Chart (Doughnut) */}
          <div className="chart-card">
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
              Tipe Quiz
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={quizTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {quizTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              {quizTypeData.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '16px', height: '16px', backgroundColor: COLORS[index % COLORS.length], borderRadius: '4px' }}></div>
                  <span style={{ fontSize: '0.9rem' }}>{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '1.5rem' }}>
          {/* Site Pie Chart */}
          <div className="chart-card">
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
              Distribusi Site (Top 5)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={siteData.slice(0, 5)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {siteData.slice(0, 5).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              {siteData.slice(0, 5).map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '16px', height: '16px', backgroundColor: COLORS[index % COLORS.length], borderRadius: '4px' }}></div>
                  <span style={{ fontSize: '0.9rem' }}>{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Activity Chart */}
          <div className="chart-card">
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
              Aktivitas Quiz (6 Bulan Terakhir)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="jumlah" fill="#667eea" name="Jumlah Quiz" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Activity Chart */}
          <div className="chart-card">
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
              Aktivitas Quiz (7 Hari Terakhir)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="jumlah" stroke="#764ba2" strokeWidth={2} name="Jumlah Quiz" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
