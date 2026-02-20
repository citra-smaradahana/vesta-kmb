import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import "./Navigation.css";

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 768px)").matches);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readNotifications, setReadNotifications] = useState(new Set());
  const [readNotificationsArray, setReadNotificationsArray] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (err) {
        console.error("Error parsing user data:", err);
      }
    }

    // Listen for auth changes
    const handleAuthChange = () => {
      const userData = localStorage.getItem("user");
      if (userData) {
        try {
          setUser(JSON.parse(userData));
        } catch (err) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };

    window.addEventListener("authChange", handleAuthChange);
    return () => window.removeEventListener("authChange", handleAuthChange);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleViewportChange = (e) => {
      setIsMobile(e.matches);
    };

    // Initial sync
    setIsMobile(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleViewportChange);
      return () => mediaQuery.removeEventListener("change", handleViewportChange);
    }

    // Fallback for older browsers
    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  // Load read notifications from localStorage
  useEffect(() => {
    if (user && user.nama) {
      const stored = localStorage.getItem(`readNotifications_${user.nama}`);
      if (stored) {
        try {
          const readArray = JSON.parse(stored);
          setReadNotifications(new Set(readArray));
          setReadNotificationsArray(readArray);
        } catch (err) {
          console.error('Error loading read notifications:', err);
        }
      } else {
        setReadNotifications(new Set());
        setReadNotificationsArray([]);
      }
    }
  }, [user]);

  // Fetch notifications
  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Refresh notifications every 5 minutes
      const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications && !event.target.closest('.notification-container')) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNotifications]);

  const fetchNotifications = async () => {
    try {
      const allNotifications = [];

      // 1. Fetch quiz baru (dalam 7 hari terakhir) yang sesuai dengan jabatan user
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: newQuizzes, error: quizzesError } = await supabase
        .from('quizzes')
        .select('id, quiz_title, training_title, created_at, target_jabatan')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50); // Ambil lebih banyak untuk filter di client

      if (!quizzesError && newQuizzes && user && user.jabatan) {
        // Filter quiz berdasarkan jabatan user
        const userJabatan = user.jabatan;
        const relevantQuizzes = newQuizzes.filter(quiz => {
          // Jika quiz tidak punya target_jabatan (null atau empty), tampilkan untuk semua
          if (!quiz.target_jabatan || !Array.isArray(quiz.target_jabatan) || quiz.target_jabatan.length === 0) {
            return true;
          }
          // Jika quiz punya target_jabatan, cek apakah jabatan user ada di dalamnya
          return quiz.target_jabatan.includes(userJabatan);
        });
        
        relevantQuizzes.forEach(quiz => {
          const createdDate = new Date(quiz.created_at);
          const daysAgo = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));
          allNotifications.push({
            id: `quiz-${quiz.id}`,
            type: 'quiz',
            title: 'Quiz Baru',
            message: `${quiz.quiz_title} - ${quiz.training_title}`,
            date: quiz.created_at,
            daysAgo: daysAgo === 0 ? 'Hari ini' : `${daysAgo} hari yang lalu`,
            link: '/kmb-learning',
          });
        });
      } else if (!quizzesError && newQuizzes && (!user || !user.jabatan)) {
        // Jika user tidak punya jabatan, tampilkan semua quiz
        newQuizzes.forEach(quiz => {
          const createdDate = new Date(quiz.created_at);
          const daysAgo = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));
          allNotifications.push({
            id: `quiz-${quiz.id}`,
            type: 'quiz',
            title: 'Quiz Baru',
            message: `${quiz.quiz_title} - ${quiz.training_title}`,
            date: quiz.created_at,
            daysAgo: daysAgo === 0 ? 'Hari ini' : `${daysAgo} hari yang lalu`,
            link: '/kmb-learning',
          });
        });
      }

      // 2. Fetch sertifikat yang akan kadaluarsa atau sudah kadaluarsa
      // Hanya tampilkan notifikasi untuk: 7 hari lagi, 3 hari lagi, dan sudah expired
      if (user && user.nama) {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Reset ke awal hari untuk perhitungan yang lebih akurat
        
        const sevenDaysLater = new Date(now);
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        
        // Fetch semua sertifikat yang akan kadaluarsa dalam 7 hari atau sudah expired
        const { data: expiringCertificates, error: certError } = await supabase
          .from('quiz_results')
          .select(`
            id,
            expiry_date,
            completed_at,
            quizzes (
              quiz_title,
              training_title
            )
          `)
          .eq('participant_name', user.nama)
          .eq('is_passed', true)
          .not('expiry_date', 'is', null)
          .lte('expiry_date', sevenDaysLater.toISOString())
          .order('expiry_date', { ascending: true });

        if (!certError && expiringCertificates) {
          expiringCertificates.forEach(cert => {
            const expiryDate = new Date(cert.expiry_date);
            expiryDate.setHours(0, 0, 0, 0); // Reset ke awal hari
            
            const isExpired = expiryDate < now;
            const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            
            // Hanya tambahkan notifikasi jika:
            // 1. Sudah expired (daysUntilExpiry < 0)
            // 2. Akan expired dalam 3 hari (daysUntilExpiry === 3)
            // 3. Akan expired dalam 7 hari (daysUntilExpiry === 7)
            // 4. Atau sudah expired hari ini (daysUntilExpiry === 0)
            const shouldNotify = isExpired || daysUntilExpiry === 3 || daysUntilExpiry === 7 || daysUntilExpiry === 0;
            
            if (shouldNotify) {
              allNotifications.push({
                id: `cert-${cert.id}-${daysUntilExpiry}`,
                type: 'certificate',
                title: isExpired ? 'Sertifikat Kadaluarsa' : 'Sertifikat Akan Kadaluarsa',
                message: `${cert.quizzes?.quiz_title || 'Quiz'} - ${cert.quizzes?.training_title || ''}`,
                date: cert.expiry_date,
                daysLeft: daysUntilExpiry,
                isExpired,
                link: '/kmb-learning',
              });
            }
          });
        }
      }

      // Sort by date (newest first)
      allNotifications.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setNotifications(allNotifications);
    } catch (err) {
      console.error('❌ Error fetching notifications:', err);
    }
  };

  // Calculate unread count separately to ensure it uses the latest readNotifications state
  // Use readNotificationsArray instead of readNotifications Set to ensure React detects changes
  useEffect(() => {
    if (user && user.nama && notifications.length > 0) {
      const unreadNotifications = notifications.filter(notif => !readNotificationsArray.includes(notif.id));
      const newUnreadCount = unreadNotifications.length;
      setUnreadCount(newUnreadCount);
    } else {
      setUnreadCount(0);
    }
  }, [notifications, readNotificationsArray, user]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("isAuthenticated");
    window.dispatchEvent(new Event("authChange"));
    navigate("/login");
  };

  const menuItems = [
    { path: "/", label: "Home", icon: "🏠" },
    { path: "/kmb-learning", label: "KMB Learning", icon: "📚" },
    {
      path: "/input-quiz",
      label: "Input Quiz",
      icon: "✏️",
      roles: ["Admin", "Trainer"],
    },
    {
      path: "/monitoring",
      label: "Monitoring",
      icon: "📊",
      roles: ["Admin", "Trainer"],
    },
    {
      path: "/laporan-training",
      label: "Laporan Training",
      icon: "📑",
      roles: ["Admin", "Trainer"],
    },
    {
      path: "/management-account",
      label: "Management Account",
      icon: "👤",
      role: "Admin",
    },
  ];

  // Filter menu items based on user role
  const roleFilteredMenuItems = menuItems.filter((item) => {
    if (!item.role && !item.roles) return true;
    if (item.roles) {
      // Check if user role is in the allowed roles array
      return user && item.roles.includes(user.role);
    }
    return user && user.role === item.role;
  });

  const mobileLearningPaths = ["/", "/kmb-learning"];
  const filteredMenuItems = isMobile
    ? roleFilteredMenuItems.filter((item) => mobileLearningPaths.includes(item.path))
    : roleFilteredMenuItems;

  // Handler untuk mark all notifications as read
  const handleMarkAllAsRead = useCallback(() => {
    if (!user || !user.nama || notifications.length === 0) {
      return;
    }
    
    // Mark all notifications as read
    const allNotificationIds = notifications.map(notif => notif.id);
    const newReadNotifications = new Set(allNotificationIds);
    const readArray = Array.from(newReadNotifications);
    
    // Update both Set and Array state
    setReadNotifications(newReadNotifications);
    setReadNotificationsArray(readArray);
    
    // Save to localStorage
    localStorage.setItem(
      `readNotifications_${user.nama}`,
      JSON.stringify(readArray)
    );
    
    // Reset unread count
    setUnreadCount(0);
  }, [user, notifications]);

  // Handler untuk klik pada notifikasi (dengan navigasi)
  const handleNotificationClick = useCallback((notif) => {
    // Navigate if there's a link
    if (notif.link) {
      setTimeout(() => {
        navigate(notif.link);
        setShowNotifications(false);
      }, 150);
    }
  }, [navigate]);

  // Fetch user profile data from Supabase
  const fetchUserProfile = useCallback(async () => {
    if (!user || !user.username) {
      return;
    }

    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', user.username)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        // Fallback to localStorage data if Supabase fetch fails
        setProfileData(user);
      } else if (data) {
        setProfileData(data);
      } else {
        setProfileData(user);
      }
    } catch (err) {
      console.error('Error:', err);
      // Fallback to localStorage data
      setProfileData(user);
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  // Fetch profile when opening profile panel
  useEffect(() => {
    if (showProfile && user) {
      fetchUserProfile();
    }
  }, [showProfile, user, fetchUserProfile]);

  if (isMobile) {
    const mobileUser = profileData || user;
    const isMobileHomeActive = location.pathname === "/" || location.pathname === "/riwayat-pengerjaan";
    const isMobileProfileActive = showProfile;

    return (
      <>
        <div className="mobile-top-header">
          <div className="mobile-user-block">
            {mobileUser?.foto ? (
              <img src={mobileUser.foto} alt={mobileUser.nama || "User"} className="mobile-user-photo" />
            ) : (
              <div className="mobile-user-photo-placeholder">👤</div>
            )}
            <div className="mobile-user-text">
              <p className="mobile-user-name">{mobileUser?.nama || "User"}</p>
              <p className="mobile-user-role">{mobileUser?.jabatan || mobileUser?.role || "-"}</p>
              <p className="mobile-user-greeting">Selamat datang di KMB Learning</p>
            </div>
          </div>
          <button
            className="mobile-notification-btn"
            onClick={() => {
              const newShowState = !showNotifications;
              setShowNotifications(newShowState);
              if (newShowState) {
                handleMarkAllAsRead();
              }
            }}
            title="Notifikasi"
          >
            🔔
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>
        </div>

        <nav className="mobile-bottom-nav">
          <button
            className={`mobile-bottom-nav-item ${isMobileHomeActive ? "active" : ""}`}
            onClick={() => {
              setShowProfile(false);
              navigate("/");
            }}
            title="Home"
          >
            <span className="mobile-bottom-nav-icon">🏠</span>
            <span className="mobile-bottom-nav-label">Home</span>
          </button>
          <button
            className={`mobile-bottom-nav-item ${isMobileProfileActive ? "active" : ""}`}
            onClick={() => {
              setShowNotifications(false);
              setShowProfile((prev) => !prev);
            }}
            title="Profile"
          >
            <span className="mobile-bottom-nav-icon">👤</span>
            <span className="mobile-bottom-nav-label">Profile</span>
          </button>
        </nav>

        {showNotifications && (
          <div className="notification-panel-overlay" onClick={() => setShowNotifications(false)}>
            <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
              <div className="notification-panel-header">
                <button
                  className="notification-panel-back"
                  onClick={() => setShowNotifications(false)}
                >
                  ←
                </button>
                <h2>Notifikasi</h2>
              </div>
              <div className="notification-panel-content">
                {notifications.length === 0 ? (
                  <div className="notification-empty-state">
                    <div className="notification-empty-icon">📭</div>
                    <p>Tidak ada notifikasi</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const isRead = readNotificationsArray.includes(notif.id);
                    return (
                      <div
                        key={notif.id}
                        className={`notification-panel-item ${notif.type} ${notif.isExpired ? "expired" : ""} ${isRead ? "read" : ""}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleNotificationClick(notif);
                        }}
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        <div className="notification-panel-indicator"></div>
                        <div className="notification-panel-icon">
                          {notif.type === "quiz" ? "📚" : notif.isExpired ? "⚠️" : "⏰"}
                        </div>
                        <div className="notification-panel-content-text">
                          <div className="notification-panel-title">{notif.title}</div>
                          <div className="notification-panel-message">
                            {notif.message}
                            {notif.daysLeft !== undefined && (
                              <span className={`notification-panel-badge ${notif.isExpired ? "expired" : ""}`}>
                                {notif.isExpired ? "Sudah kadaluarsa" : `${notif.daysLeft} hari lagi`}
                              </span>
                            )}
                          </div>
                          <div className="notification-panel-date">
                            {notif.daysAgo || (notif.daysLeft !== undefined
                              ? new Date(notif.date).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric"
                                })
                              : new Date(notif.date).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric"
                                }))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {showProfile && (
          <div className="notification-panel-overlay" onClick={() => setShowProfile(false)}>
            <div className="notification-panel profile-panel" onClick={(e) => e.stopPropagation()}>
              <div className="notification-panel-header">
                <button
                  className="notification-panel-back"
                  onClick={() => setShowProfile(false)}
                >
                  ←
                </button>
                <h2>Profil</h2>
              </div>
              <div className="notification-panel-content">
                {loadingProfile ? (
                  <div className="profile-loading">
                    <div className="loading-spinner">⏳</div>
                    <p>Memuat profil...</p>
                  </div>
                ) : profileData ? (
                  <div className="profile-content">
                    <div className="profile-photo-section">
                      {profileData.foto ? (
                        <img
                          src={profileData.foto}
                          alt={profileData.nama}
                          className="profile-photo-large"
                        />
                      ) : (
                        <div className="profile-photo-placeholder-large">👤</div>
                      )}
                    </div>
                    <div className="profile-details-section">
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Nama:</span>
                        <span className="profile-detail-value">{profileData.nama || "-"}</span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Jabatan:</span>
                        <span className="profile-detail-value">{profileData.jabatan || "-"}</span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">NRP:</span>
                        <span className="profile-detail-value">{profileData.nrp || "-"}</span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Site:</span>
                        <span className="profile-detail-value">{profileData.site || "-"}</span>
                      </div>
                      <button onClick={handleLogout} className="btn-logout" style={{ marginTop: "0.5rem" }}>
                        Logout
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="profile-empty">
                    <p>Data profil tidak ditemukan</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }


  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <img
          src="/images/VESTA-TEXT-LOGO.png"
          alt="Vesta"
          className="sidebar-logo"
        />
        {user && (
          <div className="user-info-sidebar">
            {user.foto ? (
              <img
                src={user.foto}
                alt={user.nama}
                className="user-photo-sidebar"
              />
            ) : (
              <div className="user-photo-placeholder-sidebar">👤</div>
            )}
            <div className="user-details-sidebar">
              <p className="user-name-sidebar">{user.nama}</p>
              {user.jabatan && (
                <p className="user-jabatan-sidebar">{user.jabatan}</p>
              )}
            </div>
            {/* Profile and Notification Icons - Below User Name */}
            <div className="notification-container">
              <button
                className="profile-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProfile(!showProfile);
                  // Tutup panel notifikasi jika terbuka
                  if (showNotifications) {
                    setShowNotifications(false);
                  }
                }}
                title="Profil"
              >
                <span className="profile-icon">👤</span>
              </button>
              <button
                className="notification-bell"
                onClick={(e) => {
                  e.stopPropagation();
                  const newShowState = !showNotifications;
                  setShowNotifications(newShowState);
                  
                  // Tutup panel profil jika terbuka
                  if (showProfile) {
                    setShowProfile(false);
                  }
                  
                  // Jika membuka panel notifikasi, mark all as read
                  if (newShowState) {
                    handleMarkAllAsRead();
                  }
                }}
                title="Notifikasi"
              >
                <span className="bell-icon">🔔</span>
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      <ul className="sidebar-menu">
        {filteredMenuItems.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className={`sidebar-link ${
                location.pathname === item.path ? "active" : ""
              }`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      {user && (
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">
            <span className="sidebar-icon">🚪</span>
            <span className="sidebar-label">Logout</span>
          </button>
        </div>
      )}
      
      {/* Notification Panel - Slides from sidebar */}
      {showNotifications && (
        <div className="notification-panel-overlay" onClick={() => setShowNotifications(false)}>
          <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
            <div className="notification-panel-header">
              <button
                className="notification-panel-back"
                onClick={() => setShowNotifications(false)}
              >
                ←
              </button>
              <h2>Notifikasi</h2>
            </div>
            <div className="notification-panel-content">
              {notifications.length === 0 ? (
                <div className="notification-empty-state">
                  <div className="notification-empty-icon">📭</div>
                  <p>Tidak ada notifikasi</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const isRead = readNotificationsArray.includes(notif.id);
                  return (
                    <div
                      key={notif.id}
                      className={`notification-panel-item ${notif.type} ${notif.isExpired ? 'expired' : ''} ${isRead ? 'read' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleNotificationClick(notif);
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                    <div className="notification-panel-indicator"></div>
                    <div className="notification-panel-icon">
                      {notif.type === 'quiz' ? '📚' : notif.isExpired ? '⚠️' : '⏰'}
                    </div>
                    <div className="notification-panel-content-text">
                      <div className="notification-panel-title">{notif.title}</div>
                      <div className="notification-panel-message">
                        {notif.message}
                        {notif.daysLeft !== undefined && (
                          <span className={`notification-panel-badge ${notif.isExpired ? 'expired' : ''}`}>
                            {notif.isExpired
                              ? 'Sudah kadaluarsa'
                              : `${notif.daysLeft} hari lagi`}
                          </span>
                        )}
                      </div>
                      <div className="notification-panel-date">
                        {notif.daysAgo || (notif.daysLeft !== undefined 
                          ? new Date(notif.date).toLocaleDateString('id-ID', { 
                              day: 'numeric', 
                              month: 'short', 
                              year: 'numeric' 
                            })
                          : new Date(notif.date).toLocaleDateString('id-ID', { 
                              day: 'numeric', 
                              month: 'short', 
                              year: 'numeric' 
                            }))}
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Profile Panel - Slides from sidebar */}
      {showProfile && (
        <div className="notification-panel-overlay" onClick={() => setShowProfile(false)}>
          <div className="notification-panel profile-panel" onClick={(e) => e.stopPropagation()}>
            <div className="notification-panel-header">
              <button
                className="notification-panel-back"
                onClick={() => setShowProfile(false)}
              >
                ←
              </button>
              <h2>Profil</h2>
            </div>
            <div className="notification-panel-content">
              {loadingProfile ? (
                <div className="profile-loading">
                  <div className="loading-spinner">⏳</div>
                  <p>Memuat profil...</p>
                </div>
              ) : profileData ? (
                <div className="profile-content">
                  <div className="profile-photo-section">
                    {profileData.foto ? (
                      <img
                        src={profileData.foto}
                        alt={profileData.nama}
                        className="profile-photo-large"
                      />
                    ) : (
                      <div className="profile-photo-placeholder-large">👤</div>
                    )}
                  </div>
                  <div className="profile-details-section">
                    <div className="profile-detail-item">
                      <span className="profile-detail-label">Nama:</span>
                      <span className="profile-detail-value">{profileData.nama || '-'}</span>
                    </div>
                    <div className="profile-detail-item">
                      <span className="profile-detail-label">Jabatan:</span>
                      <span className="profile-detail-value">{profileData.jabatan || '-'}</span>
                    </div>
                    <div className="profile-detail-item">
                      <span className="profile-detail-label">NRP:</span>
                      <span className="profile-detail-value">{profileData.nrp || '-'}</span>
                    </div>
                    <div className="profile-detail-item">
                      <span className="profile-detail-label">Site:</span>
                      <span className="profile-detail-value">{profileData.site || '-'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="profile-empty">
                  <p>Data profil tidak ditemukan</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
