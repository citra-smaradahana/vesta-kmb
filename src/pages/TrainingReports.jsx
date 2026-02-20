import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';
import './Page.css';

const PAGE_SIZE = 15;

const TrainingReports = () => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [certificateFilters, setCertificateFilters] = useState({
    trainingTitle: '',
    participantKeyword: '',
    site: '',
    status: 'all'
  });
  const [certificatesPage, setCertificatesPage] = useState(1);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      const { data: resultsData, error: resultsError } = await supabase
        .from('quiz_results')
        .select(`
          id,
          participant_name,
          score,
          total_questions,
          percentage,
          is_passed,
          completed_at,
          expiry_date,
          quizzes (
            quiz_title,
            training_title,
            quiz_type
          )
        `)
        .order('completed_at', { ascending: false });

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('nama, site, jabatan, nrp');

      if (resultsError) {
        console.error('Error fetching training report results:', resultsError);
      }

      if (usersError) {
        console.error('Error fetching users for training reports:', usersError);
      }

      const usersByName = {};
      (usersData || []).forEach((u) => {
        if (u.nama) {
          usersByName[u.nama] = u;
        }
      });

      const normalizedResults = (resultsData || []).map((item) => {
        const trainingTitle = item.quizzes?.training_title || '-';
        const participantName = item.participant_name || 'Anonymous';
        const userInfo = usersByName[participantName];
        return {
          ...item,
          participant_name: participantName,
          training_title: trainingTitle,
          quiz_title: item.quizzes?.quiz_title || '-',
          quiz_type: item.quizzes?.quiz_type || '-',
          site: userInfo?.site || '-',
          jabatan: userInfo?.jabatan || '-',
          nrp: userInfo?.nrp || '-'
        };
      });

      setResults(normalizedResults);
    } catch (err) {
      console.error('Error loading training reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getCertificateStatus = (expiryDate) => {
    if (!expiryDate) return 'valid';
    const now = new Date();
    const exp = new Date(expiryDate);
    return exp >= now ? 'valid' : 'expired';
  };

  const trainingOptions = useMemo(() => {
    return [...new Set(results.map((r) => r.training_title).filter(Boolean))]
      .filter((v) => v !== '-')
      .sort((a, b) => a.localeCompare(b));
  }, [results]);

  const siteOptions = useMemo(() => {
    return [...new Set(results.map((r) => r.site).filter(Boolean))]
      .filter((v) => v !== '-')
      .sort((a, b) => a.localeCompare(b));
  }, [results]);

  const certificateRows = useMemo(() => {
    const scoped = results.filter((r) => r.is_passed && r.quiz_type === 'Post Test');

    const filtered = scoped.filter((row) => {
      if (
        certificateFilters.trainingTitle &&
        row.training_title !== certificateFilters.trainingTitle
      ) {
        return false;
      }

      const keyword = certificateFilters.participantKeyword.trim().toLowerCase();
      if (keyword && !row.participant_name.toLowerCase().includes(keyword)) {
        return false;
      }

      if (certificateFilters.site && row.site !== certificateFilters.site) {
        return false;
      }

      if (certificateFilters.status !== 'all') {
        const rowStatus = getCertificateStatus(row.expiry_date);
        if (rowStatus !== certificateFilters.status) {
          return false;
        }
      }

      return true;
    });

    return filtered.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
  }, [results, certificateFilters]);

  const paginatedCertificateRows = useMemo(() => {
    const start = (certificatesPage - 1) * PAGE_SIZE;
    return certificateRows.slice(start, start + PAGE_SIZE);
  }, [certificateRows, certificatesPage]);

  const totalCertificatePages = Math.max(1, Math.ceil(certificateRows.length / PAGE_SIZE));

  useEffect(() => {
    setCertificatesPage(1);
  }, [certificateFilters]);

  const generateCertificatePdf = (row) => {
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, width, height, 'F');
    pdf.setDrawColor(41, 68, 145);
    pdf.setLineWidth(1.5);
    pdf.rect(8, 8, width - 16, height - 16);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(41, 68, 145);
    pdf.setFontSize(28);
    pdf.text('SERTIFIKAT PELATIHAN', width / 2, 36, { align: 'center' });

    pdf.setFontSize(12);
    pdf.setTextColor(60, 60, 60);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Diberikan kepada:', width / 2, 55, { align: 'center' });

    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(20, 20, 20);
    pdf.text(row.participant_name || 'Peserta', width / 2, 70, { align: 'center' });

    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    pdf.text('Atas penyelesaian pelatihan:', width / 2, 82, { align: 'center' });

    pdf.setFontSize(17);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(41, 68, 145);
    pdf.text(row.training_title || '-', width / 2, 94, { align: 'center' });

    pdf.setFontSize(12);
    pdf.setTextColor(50, 50, 50);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Quiz: ${row.quiz_title || '-'}`, width / 2, 106, { align: 'center' });
    pdf.text(`Nilai: ${row.percentage || 0}%`, width / 2, 114, { align: 'center' });
    pdf.text(`Tanggal selesai: ${formatDate(row.completed_at)}`, width / 2, 122, { align: 'center' });
    pdf.text(
      `Masa berlaku: ${row.expiry_date ? formatDate(row.expiry_date) : 'Tidak dibatasi'}`,
      width / 2,
      130,
      { align: 'center' }
    );

    pdf.setFontSize(11);
    pdf.setTextColor(90, 90, 90);
    pdf.text('KMB Learning', width / 2, height - 22, { align: 'center' });

    const safeName = (row.participant_name || 'Peserta').replace(/\s+/g, '_');
    const safeTraining = (row.training_title || 'Training').replace(/\s+/g, '_');
    pdf.save(`Sertifikat_${safeName}_${safeTraining}.pdf`);
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <h1 className="page-title">Laporan Training</h1>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner">⏳</div>
            <p>Memuat laporan training...</p>
          </div>
        ) : (
          <div className="monitoring-section">
            <div className="training-report-filters-grid">
              <div className="form-group-modern">
                <label>Training</label>
                <select
                  className="input-modern select-modern"
                  value={certificateFilters.trainingTitle}
                  onChange={(e) =>
                    setCertificateFilters((prev) => ({ ...prev, trainingTitle: e.target.value }))
                  }
                >
                  <option value="">Semua Training</option>
                  {trainingOptions.map((trainingTitle) => (
                    <option key={trainingTitle} value={trainingTitle}>
                      {trainingTitle}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group-modern">
                <label>Cari Peserta</label>
                <input
                  type="text"
                  className="input-modern"
                  placeholder="Nama peserta..."
                  value={certificateFilters.participantKeyword}
                  onChange={(e) =>
                    setCertificateFilters((prev) => ({ ...prev, participantKeyword: e.target.value }))
                  }
                />
              </div>
              <div className="form-group-modern">
                <label>Site</label>
                <select
                  className="input-modern select-modern"
                  value={certificateFilters.site}
                  onChange={(e) =>
                    setCertificateFilters((prev) => ({ ...prev, site: e.target.value }))
                  }
                >
                  <option value="">Semua Site</option>
                  {siteOptions.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group-modern">
                <label>Status Sertifikat</label>
                <select
                  className="input-modern select-modern"
                  value={certificateFilters.status}
                  onChange={(e) =>
                    setCertificateFilters((prev) => ({ ...prev, status: e.target.value }))
                  }
                >
                  <option value="all">Semua</option>
                  <option value="valid">Valid</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>

            <div className="participants-table-container">
              <table className="participants-table">
                <thead>
                  <tr>
                    <th>Nama Peserta</th>
                    <th>Site</th>
                    <th>Training</th>
                    <th>Quiz</th>
                    <th>Skor</th>
                    <th>Selesai</th>
                    <th>Expiry</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCertificateRows.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center' }}>
                        Tidak ada data sertifikat sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedCertificateRows.map((row) => {
                      const status = getCertificateStatus(row.expiry_date);
                      return (
                        <tr key={row.id}>
                          <td><strong>{row.participant_name}</strong></td>
                          <td>{row.site}</td>
                          <td>{row.training_title}</td>
                          <td>{row.quiz_title}</td>
                          <td>{row.percentage}%</td>
                          <td>{formatDate(row.completed_at)}</td>
                          <td>{formatDate(row.expiry_date)}</td>
                          <td>
                            <span className={`status-badge ${status === 'valid' ? 'pass' : 'fail'}`}>
                              {status === 'valid' ? 'Valid' : 'Expired'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-download-certificate-result"
                              onClick={() => generateCertificatePdf(row)}
                            >
                              Download
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="training-report-pagination">
              <button
                className="btn-update-time"
                disabled={certificatesPage <= 1}
                onClick={() => setCertificatesPage((prev) => Math.max(1, prev - 1))}
              >
                Sebelumnya
              </button>
              <span>Halaman {certificatesPage} / {totalCertificatePages}</span>
              <button
                className="btn-update-time"
                disabled={certificatesPage >= totalCertificatePages}
                onClick={() => setCertificatesPage((prev) => Math.min(totalCertificatePages, prev + 1))}
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingReports;
