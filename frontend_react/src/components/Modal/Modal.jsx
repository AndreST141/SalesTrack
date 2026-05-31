import { useEffect, useCallback } from 'react';
import './style.css';

function Modal({ 
    isOpen, 
    onClose,
    title, 
    children, 
    footer, 
    maxWidth = '600px', 
    onConfirm,  
    className = '',
}) {
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {

            const tag = e.target.tagName.toLowerCase();
            if (tag === 'textarea') return;
            if (tag === 'button') return;

            e.preventDefault();
            if (onConfirm) {
                onConfirm();
            }
        }
    }, [onConfirm]);

    useEffect(() => {
        if (!isOpen) return;
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div className="body-modal" onClick={onClose}>
            <div
                className={`modal-container ${className}`}
                style={{ maxWidth }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button className="modal-close" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Modal;
