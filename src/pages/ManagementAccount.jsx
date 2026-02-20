import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import Cropper from 'react-easy-crop';
import './Page.css';

const ManagementAccount = () => {
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('user');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [jabatanOptions, setJabatanOptions] = useState([]);
  const [siteOptions, setSiteOptions] = useState([]);
  const [newJabatanName, setNewJabatanName] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  
  const [newUser, setNewUser] = useState({
    nama: '',
    jabatan: '',
    site: '',
    nrp: '',
    username: '',
    password: '',
    role: 'User',
    foto: null, // URL dari storage atau preview
    fotoBlob: null // Blob untuk upload
  });

  // Image crop state
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({
    type: 'info',
    title: '',
    message: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const normalizeOptionList = (list) => {
    return [...new Set((list || []).map((item) => (item || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  };

  const saveLocalMasterOptions = (type, values) => {
    localStorage.setItem(`master_${type}_options`, JSON.stringify(values));
  };

  const loadLocalMasterOptions = (type) => {
    const raw = localStorage.getItem(`master_${type}_options`);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? normalizeOptionList(parsed) : [];
    } catch (err) {
      console.error(`Error parsing master_${type}_options:`, err);
      return [];
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        showModalMessage('error', 'Error', 'Gagal memuat data user: ' + error.message);
      } else {
        setUsers(data || []);

        const dbJabatan = normalizeOptionList((data || []).map((u) => u.jabatan));
        const dbSite = normalizeOptionList((data || []).map((u) => u.site));
        const localJabatan = loadLocalMasterOptions('jabatan');
        const localSite = loadLocalMasterOptions('site');

        setJabatanOptions(normalizeOptionList([...dbJabatan, ...localJabatan]));
        setSiteOptions(normalizeOptionList([...dbSite, ...localSite]));
      }
    } catch (err) {
      console.error('Error:', err);
      showModalMessage('error', 'Error', 'Terjadi kesalahan saat memuat data user');
    } finally {
      setLoading(false);
    }
  };

  const showModalMessage = (type, title, message) => {
    setModalContent({ type, title, message });
    setShowModal(true);
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

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

    // Set canvas size to match cropped area
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

  const uploadPhotoToStorage = async (blob, userId) => {
    try {
      // Generate unique filename
      const fileName = userId ? `user-${userId}-${Date.now()}.jpg` : `user-${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('user-photos')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) {
        console.error('Error uploading photo:', error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-photos')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error in uploadPhotoToStorage:', error);
      throw error;
    }
  };

  const deletePhotoFromStorage = async (photoUrl) => {
    try {
      // Extract file path from URL
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      
      if (fileName) {
        const { error } = await supabase.storage
          .from('user-photos')
          .remove([fileName]);

        if (error) {
          console.error('Error deleting photo:', error);
        }
      }
    } catch (error) {
      console.error('Error in deletePhotoFromStorage:', error);
    }
  };

  const handleImageSelect = (e) => {
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
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result);
        setShowCropModal(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async () => {
    try {
      if (!croppedAreaPixels || !imageSrc) return;

      // Get cropped blob
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      
      // Create preview URL for display
      const previewUrl = URL.createObjectURL(croppedBlob);
      
      // Store blob for later upload
      setNewUser({ ...newUser, foto: previewUrl, fotoBlob: croppedBlob });
      setShowCropModal(false);
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (error) {
      console.error('Error cropping image:', error);
      showModalMessage('error', 'Error', 'Gagal memproses gambar');
    }
  };

  const handleRemovePhoto = () => {
    if (newUser.foto && newUser.foto.startsWith('blob:')) {
      URL.revokeObjectURL(newUser.foto);
    }
    setNewUser({ ...newUser, foto: null, fotoBlob: null });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validasi
      if (!newUser.nama || !newUser.username || !newUser.password || !newUser.role) {
        showModalMessage('error', 'Validasi Error', 'Mohon lengkapi semua field yang wajib diisi!');
        setIsSubmitting(false);
        return;
      }

      // Cek apakah username sudah ada
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', newUser.username)
        .maybeSingle();

      if (existingUser && !editingUserId) {
        showModalMessage('error', 'Error', 'Username sudah digunakan!');
        setIsSubmitting(false);
        return;
      }

      // Upload foto to storage if there's a new photo
      let fotoUrl = newUser.foto;
      if (newUser.fotoBlob) {
        // Upload new photo
        try {
          fotoUrl = await uploadPhotoToStorage(newUser.fotoBlob, editingUserId || null);
          
          // If editing and has old photo, delete it
          if (editingUserId && newUser.foto && !newUser.foto.startsWith('blob:')) {
            await deletePhotoFromStorage(newUser.foto);
          }
        } catch (error) {
          showModalMessage('error', 'Error', 'Gagal mengupload foto: ' + error.message);
          setIsSubmitting(false);
          return;
        }
      } else if (editingUserId && !newUser.foto) {
        // If editing and photo is removed, delete old photo
        const oldUser = users.find(u => u.id === editingUserId);
        if (oldUser && oldUser.foto) {
          await deletePhotoFromStorage(oldUser.foto);
        }
      }

      if (editingUserId) {
        // Update user
        const updateData = {
          nama: newUser.nama,
          jabatan: newUser.jabatan || null,
          site: newUser.site || null,
          nrp: newUser.nrp || null,
          username: newUser.username,
          password: newUser.password, // Note: In production, hash this password!
          role: newUser.role,
          foto: fotoUrl,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUserId);

        if (error) {
          showModalMessage('error', 'Error', 'Gagal mengupdate user: ' + error.message);
        } else {
          showModalMessage('success', 'Berhasil', 'User berhasil diupdate!');
          resetForm();
          fetchUsers();
        }
      } else {
        // Insert new user
        const { error } = await supabase
          .from('users')
          .insert([{
            nama: newUser.nama,
            jabatan: newUser.jabatan || null,
            site: newUser.site || null,
            nrp: newUser.nrp || null,
            username: newUser.username,
            password: newUser.password, // Note: In production, hash this password!
            role: newUser.role,
            foto: fotoUrl
          }]);

        if (error) {
          showModalMessage('error', 'Error', 'Gagal menambahkan user: ' + error.message);
        } else {
          showModalMessage('success', 'Berhasil', 'User berhasil ditambahkan!');
          resetForm();
          fetchUsers();
        }
      }
    } catch (err) {
      console.error('Error:', err);
      showModalMessage('error', 'Error', 'Terjadi kesalahan saat menyimpan user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = (user) => {
    if (user.jabatan) {
      setJabatanOptions((prev) => normalizeOptionList([...prev, user.jabatan]));
    }
    if (user.site) {
      setSiteOptions((prev) => normalizeOptionList([...prev, user.site]));
    }

    setEditingUserId(user.id);
    setNewUser({
      nama: user.nama || '',
      jabatan: user.jabatan || '',
      site: user.site || '',
      nrp: user.nrp || '',
      username: user.username || '',
      password: '', // Don't show password
      role: user.role || 'User',
      foto: user.foto || null,
      fotoBlob: null // No new photo selected yet
    });
    setShowAddForm(true);
    setActiveTab('user');
  };

  const handleDeleteUser = async (userId) => {
    setModalContent({
      type: 'confirm',
      title: 'Hapus User',
      message: 'Apakah Anda yakin ingin menghapus user ini?\n\nTindakan ini tidak dapat dibatalkan!',
    });
    setShowModal(true);

    const deleteUser = async () => {
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (error) {
          showModalMessage('error', 'Error', 'Gagal menghapus user: ' + error.message);
        } else {
          showModalMessage('success', 'Berhasil', 'User berhasil dihapus!');
          fetchUsers();
        }
      } catch (err) {
        showModalMessage('error', 'Error', 'Terjadi kesalahan saat menghapus user');
      }
    };

    window.deleteUserConfirm = deleteUser;
  };

  const handleModalConfirm = () => {
    if (modalContent.type === 'confirm' && window.deleteUserConfirm) {
      window.deleteUserConfirm();
      window.deleteUserConfirm = null;
    }
    setShowModal(false);
  };

  const resetForm = () => {
    if (newUser.foto && newUser.foto.startsWith('blob:')) {
      URL.revokeObjectURL(newUser.foto);
    }
    setNewUser({
      nama: '',
      jabatan: '',
      site: '',
      nrp: '',
      username: '',
      password: '',
      role: 'User',
      foto: null,
      fotoBlob: null
    });
    setEditingUserId(null);
    setShowAddForm(false);
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleAddJabatan = (e) => {
    e.preventDefault();
    const normalized = newJabatanName.trim();
    if (!normalized) return;

    const updated = normalizeOptionList([...jabatanOptions, normalized]);
    setJabatanOptions(updated);
    saveLocalMasterOptions('jabatan', updated);
    setNewJabatanName('');
    showModalMessage('success', 'Berhasil', 'Jabatan berhasil ditambahkan ke daftar.');
  };

  const handleAddSite = (e) => {
    e.preventDefault();
    const normalized = newSiteName.trim();
    if (!normalized) return;

    const updated = normalizeOptionList([...siteOptions, normalized]);
    setSiteOptions(updated);
    saveLocalMasterOptions('site', updated);
    setNewSiteName('');
    showModalMessage('success', 'Berhasil', 'Site berhasil ditambahkan ke daftar.');
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <h1 className="page-title">Management Account</h1>

        <div className="training-report-tabs" style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`training-report-tab ${activeTab === 'user' ? 'active' : ''}`}
            onClick={() => setActiveTab('user')}
          >
            Tambah User
          </button>
          <button
            type="button"
            className={`training-report-tab ${activeTab === 'jabatan' ? 'active' : ''}`}
            onClick={() => setActiveTab('jabatan')}
          >
            Tambah Jabatan
          </button>
          <button
            type="button"
            className={`training-report-tab ${activeTab === 'site' ? 'active' : ''}`}
            onClick={() => setActiveTab('site')}
          >
            Tambah Site
          </button>
        </div>

        {activeTab === 'jabatan' && (
          <div className="monitoring-section" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Master Jabatan</h3>
            <form onSubmit={handleAddJabatan} className="training-report-filters-grid">
              <div className="form-group-modern">
                <label>Nama Jabatan</label>
                <input
                  type="text"
                  value={newJabatanName}
                  onChange={(e) => setNewJabatanName(e.target.value)}
                  className="input-modern"
                  placeholder="Contoh: Supervisor Learning"
                />
              </div>
              <div className="form-group-modern" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" className="btn-submit-modern">
                  Tambah Jabatan
                </button>
              </div>
            </form>
            <div className="participants-table-container" style={{ marginTop: '1rem' }}>
              <table className="participants-table">
                <thead>
                  <tr>
                    <th>Daftar Jabatan</th>
                  </tr>
                </thead>
                <tbody>
                  {jabatanOptions.length === 0 ? (
                    <tr>
                      <td>Belum ada data jabatan.</td>
                    </tr>
                  ) : (
                    jabatanOptions.map((item) => (
                      <tr key={item}>
                        <td>{item}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'site' && (
          <div className="monitoring-section" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Master Site</h3>
            <form onSubmit={handleAddSite} className="training-report-filters-grid">
              <div className="form-group-modern">
                <label>Nama Site</label>
                <input
                  type="text"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="input-modern"
                  placeholder="Contoh: Balikpapan"
                />
              </div>
              <div className="form-group-modern" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" className="btn-submit-modern">
                  Tambah Site
                </button>
              </div>
            </form>
            <div className="participants-table-container" style={{ marginTop: '1rem' }}>
              <table className="participants-table">
                <thead>
                  <tr>
                    <th>Daftar Site</th>
                  </tr>
                </thead>
                <tbody>
                  {siteOptions.length === 0 ? (
                    <tr>
                      <td>Belum ada data site.</td>
                    </tr>
                  ) : (
                    siteOptions.map((item) => (
                      <tr key={item}>
                        <td>{item}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'user' && (
          <>
        <div className="account-actions">
          <button 
            onClick={() => {
              if (showAddForm) {
                handleCancel();
              } else {
                setShowAddForm(true);
              }
            }}
            className="btn-primary"
          >
            {showAddForm ? 'Batal' : '+ Tambah User'}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddUser} className="user-form quiz-form-modern">
            <div className="form-section">
              <div className="section-title">
                <span className="section-icon">📋</span>
                <h2>{editingUserId ? 'Edit User' : 'Tambah User Baru'}</h2>
              </div>

              {/* Photo Upload Section */}
              <div className="form-group-modern photo-upload-section">
                <label>
                  <span className="label-icon">📷</span>
                  Foto Profil
                </label>
                <div className="photo-upload-container">
                  {newUser.foto ? (
                    <div className="photo-preview">
                      <img src={newUser.foto} alt="Preview" className="photo-preview-img" />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="btn-remove-photo"
                        title="Hapus Foto"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="photo-placeholder">
                      <span className="photo-icon">📷</span>
                      <p>Belum ada foto</p>
                    </div>
                  )}
                  <div className="photo-upload-actions">
                    <label htmlFor="photo-upload" className="btn-upload-photo">
                      {newUser.foto ? 'Ganti Foto' : 'Upload Foto'}
                    </label>
                    <input
                      type="file"
                      id="photo-upload"
                      accept="image/*"
                      onChange={handleImageSelect}
                      style={{ display: 'none' }}
                    />
                    {newUser.foto && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="btn-remove-photo-text"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>
                </div>
                <small className="form-hint">Format: JPG, PNG. Maksimal 5MB. Crop 1:1</small>
              </div>

              <div className="form-row">
                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">👤</span>
                    Nama <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={newUser.nama}
                    onChange={(e) => setNewUser({ ...newUser, nama: e.target.value })}
                    placeholder="Masukkan nama"
                    required
                    className="input-modern"
                  />
                </div>

                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">💼</span>
                    Jabatan
                  </label>
                  <select
                    value={newUser.jabatan}
                    onChange={(e) => setNewUser({ ...newUser, jabatan: e.target.value })}
                    className="input-modern select-modern"
                  >
                    <option value="">Pilih Jabatan</option>
                    {jabatanOptions.map((jabatan) => (
                      <option key={jabatan} value={jabatan}>
                        {jabatan}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">📍</span>
                    Site
                  </label>
                  <select
                    value={newUser.site}
                    onChange={(e) => setNewUser({ ...newUser, site: e.target.value })}
                    className="input-modern select-modern"
                  >
                    <option value="">Pilih Site</option>
                    {siteOptions.map((site) => (
                      <option key={site} value={site}>
                        {site}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">🆔</span>
                    NRP
                  </label>
                  <input
                    type="text"
                    value={newUser.nrp}
                    onChange={(e) => setNewUser({ ...newUser, nrp: e.target.value })}
                    placeholder="Masukkan NRP"
                    className="input-modern"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">🔐</span>
                    Username <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Masukkan username"
                    required
                    disabled={!!editingUserId}
                    className="input-modern"
                    style={editingUserId ? { background: '#f3f4f6', cursor: 'not-allowed' } : {}}
                  />
                  {editingUserId && (
                    <small className="form-hint">Username tidak dapat diubah</small>
                  )}
                </div>

                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">🔒</span>
                    Password <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder={editingUserId ? "Kosongkan jika tidak ingin mengubah password" : "Masukkan password"}
                    required={!editingUserId}
                    className="input-modern"
                  />
                  {editingUserId && (
                    <small className="form-hint">Kosongkan jika tidak ingin mengubah password</small>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group-modern">
                  <label>
                    <span className="label-icon">👥</span>
                    Role <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    required
                    className="input-modern select-modern"
                  >
                    <option value="User">User</option>
                    <option value="Trainer">Trainer</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={handleCancel}
                  className="btn-cancel"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn-submit-modern"
                  disabled={isSubmitting}
                >
                  <span className="btn-icon">💾</span>
                  {isSubmitting ? 'Menyimpan...' : (editingUserId ? 'Update User' : 'Simpan User')}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="users-table-container">
          <h3>Daftar User</h3>
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner">⏳</div>
              <p>Memuat data user...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>Belum ada user</h3>
              <p>Tambahkan user baru untuk memulai</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>Nama</th>
                    <th>Jabatan</th>
                    <th>Site</th>
                    <th>NRP</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        {user.foto ? (
                          <img src={user.foto} alt={user.nama} className="user-photo-table" />
                        ) : (
                          <div className="user-photo-placeholder-table">👤</div>
                        )}
                      </td>
                      <td>{user.nama}</td>
                      <td>{user.jabatan || '-'}</td>
                      <td>{user.site || '-'}</td>
                      <td>{user.nrp || '-'}</td>
                      <td>{user.username}</td>
                      <td>
                        <span className={`role-badge role-${user.role.toLowerCase()}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleEditUser(user)}
                            className="btn-edit-small"
                            title="Edit User"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="btn-delete-small"
                            title="Hapus User"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* Crop Modal */}
      {showCropModal && imageSrc && (
        <div className="crop-modal-overlay">
          <div className="crop-modal-container">
            <div className="crop-modal-header">
              <h3>Crop Foto (1:1)</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setImageSrc(null);
                }}
                className="crop-modal-close"
              >
                ✕
              </button>
            </div>
            <div className="crop-modal-body">
              <div className="crop-container">
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
              <div className="crop-controls">
                <label>
                  Zoom:
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="crop-zoom-slider"
                  />
                </label>
              </div>
            </div>
            <div className="crop-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setImageSrc(null);
                }}
                className="btn-cancel"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCropComplete}
                className="btn-submit-modern"
              >
                Simpan Crop
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleModalConfirm}
        title={modalContent.title}
        message={modalContent.message}
        type={modalContent.type}
        showCancel={modalContent.type === 'confirm'}
        confirmText={modalContent.type === 'confirm' ? 'Ya, Hapus' : 'OK'}
        cancelText="Batal"
        showClose={false}
      />
    </div>
  );
};

export default ManagementAccount;
