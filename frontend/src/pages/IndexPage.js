import React from 'react';

export default function IndexPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div style={{ padding: '40px', backgroundColor: 'white', minHeight: '100vh' }}>
      <h1 style={{ color: '#2c3e50', marginBottom: '8px' }}>
        Welcome, {user.full_name || 'Sydney Food Co'} 👋
      </h1>
      <p style={{ color: '#7f8c8d', fontSize: '16px', marginBottom: '40px' }}>
        What would you like to do today?
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '600px' }}>
        <div
          style={cardStyle}
          onClick={() => window.location.href = '/invoices'}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📋</div>
          <h3 style={{ color: '#2c3e50', marginBottom: '5px' }}>Invoices</h3>
          <p style={{ color: '#7f8c8d', fontSize: '13px' }}>View and manage customer invoices</p>
        </div>

        <div
          style={cardStyle}
          onClick={() => window.location.href = '/calculator'}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🧮</div>
          <h3 style={{ color: '#2c3e50', marginBottom: '5px' }}>Calculator</h3>
          <p style={{ color: '#7f8c8d', fontSize: '13px' }}>Delivery table and kitchen prep</p>
        </div>

        <div style={{ ...cardStyle, opacity: 0.5, cursor: 'not-allowed' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📦</div>
          <h3 style={{ color: '#2c3e50', marginBottom: '5px' }}>Inventory</h3>
          <p style={{ color: '#7f8c8d', fontSize: '13px' }}>Coming soon</p>
        </div>

        <div style={{ ...cardStyle, opacity: 0.5, cursor: 'not-allowed' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>💳</div>
          <h3 style={{ color: '#2c3e50', marginBottom: '5px' }}>Payments</h3>
          <p style={{ color: '#7f8c8d', fontSize: '13px' }}>Coming soon</p>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  backgroundColor: '#f8f9fa',
  border: '1px solid #dee2e6',
  borderRadius: '10px',
  padding: '24px',
  cursor: 'pointer',
  transition: 'all 0.2s',
};