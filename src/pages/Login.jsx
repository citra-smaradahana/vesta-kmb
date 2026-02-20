import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import './Page.css';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({
    type: 'info',
    title: '',
    message: ''
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validasi
      if (!formData.username || !formData.password) {
        setModalContent({
          type: 'error',
          title: 'Validasi Error',
          message: 'Mohon lengkapi username dan password!'
        });
        setShowModal(true);
        setLoading(false);
        return;
      }

      // Cek user di database
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', formData.username)
        .eq('password', formData.password)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user:', error);
        setModalContent({
          type: 'error',
          title: 'Error',
          message: 'Terjadi kesalahan saat login: ' + error.message
        });
        setShowModal(true);
      } else if (!user) {
        setModalContent({
          type: 'error',
          title: 'Login Gagal',
          message: 'Username atau password salah!'
        });
        setShowModal(true);
      } else {
        // Login berhasil
        // Simpan user data ke localStorage
        localStorage.setItem('user', JSON.stringify({
          id: user.id,
          nama: user.nama,
          username: user.username,
          role: user.role,
          foto: user.foto
        }));
        localStorage.setItem('isAuthenticated', 'true');

        // Trigger auth change event
        window.dispatchEvent(new Event('authChange'));

        // Redirect berdasarkan role
        if (user.role === 'Admin' || user.role === 'Trainer') {
          navigate('/');
        } else {
          navigate('/kmb-learning');
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setModalContent({
        type: 'error',
        title: 'Error',
        message: 'Terjadi kesalahan saat login'
      });
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <h1>📚 KMB Learning</h1>
          </div>
          <h2>Selamat Datang</h2>
          <p>Silakan login untuk melanjutkan</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group-login">
            <label htmlFor="username">
              <span className="label-icon">👤</span>
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Masukkan username"
              required
              className="input-login"
              autoComplete="username"
            />
          </div>

          <div className="form-group-login">
            <label htmlFor="password">
              <span className="label-icon">🔒</span>
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Masukkan password"
              required
              className="input-login"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-login"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner-small">⏳</span>
                Memproses...
              </>
            ) : (
              <>
                <span className="btn-icon">🔐</span>
                Login
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-hint">
            Sistem Pembelajaran KMB Learning
          </p>
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
    </div>
  );
};

export default Login;

