import React, { useState, useEffect } from 'react';
import { getSleeveInventory, saveSleeveInventory, resetSleeveInventory } from '../services/api';

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    setLoading(true);
    setError('');
    getSleeveInventory()
      .then(res => {
        setInventory(res.data);
        const q = {};
        res.data.forEach(item => { q[item.menu_item_id] = item.quantity; });
        setQuantities(q);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load inventory.');
        setLoading(false);
      });
  };

  const handleChange = (menuItemId, value) => {
    const parsed = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
    setQuantities(prev => ({ ...prev, [menuItemId]: parsed }));
  };

  const handleSave = () => {
    setSaving(true);
    setSaveSuccess(false);
    setError('');
    const payload = inventory.map(item => ({
      menu_item_id: item.menu_item_id,
      quantity: quantities[item.menu_item_id] === '' ? 0 : (quantities[item.menu_item_id] ?? 0),
    }));
    saveSleeveInventory(payload)
      .then(() => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      })
      .catch(() => setError('Failed to save inventory.'))
      .finally(() => setSaving(false));
  };

  const handleReset = () => {
    if (!window.confirm('Reset all sleeve quantities to 0? This cannot be undone.')) return;
    setResetting(true);
    setError('');
    resetSleeveInventory()
      .then(() => {
        const zeroed = {};
        inventory.forEach(item => { zeroed[item.menu_item_id] = 0; });
        setQuantities(zeroed);
      })
      .catch(() => setError('Failed to reset inventory.'))
      .finally(() => setResetting(false));
  };

  return (
    <div style={{ padding: '40px', backgroundColor: 'white', minHeight: '100vh' }}>
      <h1 style={{ color: '#2c3e50', marginBottom: '8px' }}>Sleeve Inventory</h1>
      <p style={{ color: '#7f8c8d', fontSize: '15px', marginBottom: '32px' }}>
        Track current sleeve stock per product. Use "Mark as Delivered" on the Calculator page to deduct quantities after each weekly delivery.
      </p>

      {loading && <div style={{ color: '#7f8c8d' }}>Loading…</div>}
      {error && (
        <div style={{ color: '#e74c3c', backgroundColor: '#fdf2f2', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {!loading && !error && inventory.length === 0 && (
        <div style={{ color: '#7f8c8d' }}>No active products found. Add products via Menu Items in the admin panel first.</div>
      )}

      {!loading && inventory.length > 0 && (
        <>
          <div style={{ maxWidth: '560px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', color: '#2c3e50', fontWeight: '600' }}>Code</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', color: '#2c3e50', fontWeight: '600' }}>Product</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', color: '#2c3e50', fontWeight: '600' }}>Sleeves</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item, idx) => (
                  <tr key={item.menu_item_id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f8f9fa', borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px 14px', fontSize: '13px', color: '#7f8c8d', fontFamily: 'monospace' }}>
                      {item.product_code}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '14px', color: '#2c3e50' }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '6px 14px', textAlign: 'right' }}>
                      <input
                        type="number"
                        min="0"
                        value={quantities[item.menu_item_id] ?? 0}
                        onChange={e => handleChange(item.menu_item_id, e.target.value)}
                        style={{
                          width: '80px', padding: '6px 8px', textAlign: 'right',
                          border: '1px solid #dee2e6', borderRadius: '4px',
                          fontSize: '14px', color: '#2c3e50',
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '10px 24px', backgroundColor: '#2c3e50', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  fontWeight: 'bold', fontSize: '14px',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                style={{
                  padding: '10px 24px', backgroundColor: '#e74c3c', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  fontWeight: 'bold', fontSize: '14px',
                }}
              >
                {resetting ? 'Resetting…' : 'Reset to 0'}
              </button>
              {saveSuccess && (
                <span style={{ color: '#27ae60', fontWeight: '500', fontSize: '14px' }}>
                  ✓ Saved
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
