import './Modal.css';

const Modal = ({ isOpen, onClose, title, message, type = 'info', onConfirm, showCancel = true, confirmText = 'OK', cancelText = 'Batal', showClose = true }) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'confirm':
        return '❓';
      default:
        return 'ℹ️';
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'success':
        return 'btn-modal-success';
      case 'error':
        return 'btn-modal-error';
      case 'warning':
        return 'btn-modal-warning';
      case 'confirm':
        return 'btn-modal-confirm';
      default:
        return 'btn-modal-info';
    }
  };

  return (
    <div className="modal-overlay" onClick={showCancel ? onClose : null}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className={`modal-header modal-${type}`}>
          <div className="modal-icon">{getIcon()}</div>
          <h2 className="modal-title">{title}</h2>
          {showClose && (
            <button className="modal-close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        <div className="modal-body">
          <p className="modal-message">{message}</p>
        </div>
        <div className="modal-footer">
          {showCancel && (
            <button className="btn-modal-cancel" onClick={onClose}>
              {cancelText}
            </button>
          )}
          <button className={getButtonClass()} onClick={handleConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;

