import { useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './Certificate.css';

const Certificate = ({ 
  participantName, 
  jabatan, 
  nrp, 
  trainingTitle, 
  quizTitle, 
  completionDate, 
  score, 
  totalQuestions,
  percentage,
  onDownload 
}) => {
  const certificateRef = useRef(null);

  const handleDownload = async () => {
    if (!certificateRef.current) return;

    try {
      // Convert HTML to canvas
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      // Convert canvas to image
      const imgData = canvas.toDataURL('image/png');

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
      const filename = `Sertifikat_${participantName.replace(/\s+/g, '_')}_${quizTitle.replace(/\s+/g, '_')}.pdf`;
      pdf.save(filename);

      if (onDownload) {
        onDownload();
      }
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Gagal mengunduh sertifikat. Silakan coba lagi.');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
  };

  return (
    <div className="certificate-container">
      <div ref={certificateRef} className="certificate-template">
        <div className="certificate-border">
          <div className="certificate-header">
            <div className="certificate-logo">🏆</div>
            <h1 className="certificate-title">SERTIFIKAT</h1>
            <p className="certificate-subtitle">Sertifikat Penyelesaian Pelatihan</p>
          </div>

          <div className="certificate-body">
            <p className="certificate-text">
              Dengan ini menyatakan bahwa:
            </p>

            <div className="certificate-participant">
              <p className="participant-name">{participantName || 'Nama Peserta'}</p>
              <p className="participant-details">
                {jabatan && <span>Jabatan: {jabatan}</span>}
                {nrp && <span>NRP: {nrp}</span>}
              </p>
            </div>

            <p className="certificate-text">
              telah menyelesaikan pelatihan:
            </p>

            <div className="certificate-training">
              <p className="training-title">{trainingTitle}</p>
              <p className="quiz-title">{quizTitle}</p>
            </div>

            <div className="certificate-details">
              <p>Dengan skor: <strong>{score} / {totalQuestions}</strong></p>
              <p>Tanggal penyelesaian: <strong>{formatDate(completionDate)}</strong></p>
            </div>
          </div>

          <div className="certificate-footer">
            <div className="certificate-signature">
              <div className="signature-trainer">
                <div className="signature-line"></div>
                <p className="signature-name">Trainer</p>
                <p className="signature-title">KMB Learning</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button onClick={handleDownload} className="btn-download-certificate">
        📥 Download Sertifikat (PDF)
      </button>
    </div>
  );
};

export default Certificate;

