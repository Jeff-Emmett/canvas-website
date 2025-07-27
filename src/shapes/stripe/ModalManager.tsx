import React, { useState } from 'react';
import { StripePaymentPopup } from './StripePaymentShapeUtil';

export function ModalManager() {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return <StripePaymentPopup onClose={() => setIsOpen(false)} />;
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        padding: '12px 24px',
        backgroundColor: '#0066cc',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: '600',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      }}
    >
      💳 Open Payment
    </button>
  );
}
