import React, { useState, useEffect } from 'react';
import { getCustomers, updateCustomerRate } from '../services/api';

const SHOW_STATUS_KEY = 'showInvoiceStatus';

export default function SettingsPage() {
  const [customers, setCustomers] = useState([]);
  const [rates, setRates] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [error, setError] = useState({});
  const [showStatus, setShowStatus] = useState(() => localStorage.getItem(SHOW_STATUS_KEY) !== 'false');

  useEffect(() => {
    getCustomers().then(res => {
      setCustomers(res.data);
      const initial = {};
      res.data.forEach(c => { initial[c.id] = c.rate ?? ''; });
      setRates(initial);
    });
  }, []);

  const handleSave = (customer) => {
    const rate = rates[customer.id];
    if (rate === '' || rate === null || rate === undefined) {
      setError(prev => ({ ...prev, [customer.id]: 'Rate cannot be empty' }));
      return;
    }
    setSaving(prev => ({ ...prev, [customer.id]: true }));
    setError(prev => ({ ...prev, [customer.id]: null }));

    updateCustomerRate(customer.id, rate)
      .then(() => {
        setSaved(prev => ({ ...prev, [customer.id]: true }));
        setTimeout(() => setSaved(prev => ({ ...prev, [customer.id]: false })), 2000);
      })
      .catch(() => {
        setError(prev => ({ ...prev, [customer.id]: 'Failed to save' }));
      })
      .finally(() => {
        setSaving(prev => ({ ...prev, [customer.id]: false }));
      });
  };

  const toggleShowStatus = () => {
    const next = !showStatus;
    setShowStatus(next);
    localStorage.setItem(SHOW_STATUS_KEY, String(next));
  };

  return (
    <div style={{ padding: '40px', backgroundColor: 'white', minHeight: '100vh' }}>
      <h1 style={{ color: '#2c3e50', marginBottom: '8px' }}>Settings</h1>
      <p style={{ color: '#7f8c8d', fontSize: '15px', marginBottom: '32px' }}>
        Set the per-unit rate for each customer. This rate applies to all products when generating Zoho invoices.
      </p>

      {/* ── Invoice display settings ── */}
      <div style={{ maxWidth: '600px', marginBottom: '40px' }}>
        <h2 style={{ color: '#2c3e50', fontSize: '16px', marginBottom: '16px' }}>Invoice List</h2>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6', borderRadius: '6px',
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c3e50' }}>Show status column</div>
            <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '2px' }}>
              Hides the auto status (unpaid/paid) until payment matching is set up
            </div>
          </div>
          <div
            onClick={toggleShowStatus}
            style={{
              width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
              backgroundColor: showStatus ? '#2c3e50' : '#ccc',
              position: 'relative', transition: 'background-color 0.2s', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: '3px',
              left: showStatus ? '23px' : '3px',
              width: '18px', height: '18px', borderRadius: '50%',
              backgroundColor: 'white', transition: 'left 0.2s',
            }} />
          </div>
        </div>
      </div>

      <h2 style={{ color: '#2c3e50', fontSize: '16px', marginBottom: '16px' }}>Customer Rates</h2>

      <div style={{ maxWidth: '600px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 180px 100px',
          gap: '0',
          backgroundColor: '#2c3e50',
          color: 'white',
          padding: '10px 16px',
          borderRadius: '6px 6px 0 0',
          fontWeight: 'bold',
          fontSize: '13px',
        }}>
          <span>Customer</span>
          <span>Rate ($ per unit, excl. GST)</span>
          <span></span>
        </div>

        {customers.map((customer, idx) => (
          <div key={customer.id} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 180px 100px',
            gap: '0',
            alignItems: 'center',
            padding: '10px 16px',
            backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white',
            borderBottom: '1px solid #dee2e6',
          }}>
            <span style={{ fontSize: '14px', color: '#2c3e50', fontWeight: '500' }}>{customer.name}</span>
            <div style={{ paddingRight: '12px' }}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rates[customer.id] ?? ''}
                onChange={e => setRates(prev => ({ ...prev, [customer.id]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave(customer)}
                placeholder="e.g. 12.50"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: `1px solid ${error[customer.id] ? '#e74c3c' : '#dee2e6'}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              {error[customer.id] && (
                <div style={{ color: '#e74c3c', fontSize: '11px', marginTop: '2px' }}>{error[customer.id]}</div>
              )}
            </div>
            <button
              onClick={() => handleSave(customer)}
              disabled={saving[customer.id]}
              style={{
                padding: '6px 14px',
                backgroundColor: saved[customer.id] ? '#27ae60' : '#2c3e50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving[customer.id] ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s',
              }}
            >
              {saving[customer.id] ? 'Saving...' : saved[customer.id] ? 'Saved!' : 'Save'}
            </button>
          </div>
        ))}

        {customers.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#7f8c8d', backgroundColor: '#f8f9fa', borderRadius: '0 0 6px 6px' }}>
            No customers found. Sync from Zoho first.
          </div>
        )}
      </div>
    </div>
  );
}
