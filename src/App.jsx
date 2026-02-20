import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import KMBLearning from './pages/KMBLearning';
import BAIMDetail from './pages/BAIMDetail';
import InputQuiz from './pages/InputQuiz';
import Monitoring from './pages/Monitoring';
import ManagementAccount from './pages/ManagementAccount';
import TakeQuiz from './pages/TakeQuiz';
import TrainingReports from './pages/TrainingReports';
import RiwayatPengerjaan from './pages/RiwayatPengerjaan';
import Login from './pages/Login';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole = null, requiredRoles = null }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    const userData = localStorage.getItem('user');
    
    if (authStatus === 'true' && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
        
        // Check role if required
        if (requiredRoles && Array.isArray(requiredRoles)) {
          // Check if user role is in the allowed roles array
          if (!requiredRoles.includes(parsedUser.role)) {
            setIsAuthenticated(false);
          }
        } else if (requiredRole && parsedUser.role !== requiredRole) {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
        setIsAuthenticated(false);
      }
    }
    setLoading(false);
  }, [requiredRole, requiredRoles]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="loading-spinner">⏳</div>
          <p>Memuat...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const authStatus = localStorage.getItem('isAuthenticated');
      setIsAuthenticated(authStatus === 'true');
    };

    checkAuth();
    
    // Listen for storage changes
    window.addEventListener('storage', checkAuth);
    
    // Custom event for login/logout
    window.addEventListener('authChange', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('authChange', checkAuth);
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/*"
          element={
            <div className="app">
              <Navigation />
              <main className="main-content">
                <Routes>
                  <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                  <Route path="/kmb-learning" element={<ProtectedRoute><KMBLearning /></ProtectedRoute>} />
                  <Route path="/riwayat-pengerjaan" element={<ProtectedRoute><RiwayatPengerjaan /></ProtectedRoute>} />
                  <Route path="/training/:trainingTitle" element={<ProtectedRoute><BAIMDetail /></ProtectedRoute>} />
                  <Route path="/input-quiz" element={<ProtectedRoute requiredRoles={['Admin', 'Trainer']}><InputQuiz /></ProtectedRoute>} />
                  <Route path="/monitoring" element={<ProtectedRoute requiredRoles={['Admin', 'Trainer']}><Monitoring /></ProtectedRoute>} />
                  <Route path="/laporan-training" element={<ProtectedRoute requiredRoles={['Admin', 'Trainer']}><TrainingReports /></ProtectedRoute>} />
                  <Route path="/management-account" element={<ProtectedRoute requiredRole="Admin"><ManagementAccount /></ProtectedRoute>} />
                  <Route path="/take-quiz/:id" element={<ProtectedRoute><TakeQuiz /></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
      </div>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
