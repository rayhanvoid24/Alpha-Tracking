import React from 'react';

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  invoicesOpen,
  setInvoicesOpen,
  customers,
  selectedCustomer,
  setSelectedCustomer,
  syncing,
  onSync,
  onLogout,
}) {
  return (
    <>
      {/* Toggle button */}
      <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? '◀' : '▶'}
      </button>

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="app-title">Alpha Tracking</div>

        {/* Dashboard link */}
<div 
  className="section-header" 
  onClick={() => window.location.href = '/'}
>
  <span>🏠 Dashboard</span>
</div>

        {/* Sync button */}
        <div style={{ padding: '10px 20px' }}>
          <button
            className="sync-button"
            onClick={onSync}
            disabled={syncing}
            style={{ width: '100%' }}
          >
            {syncing ? 'Syncing...' : '🔄 Sync Invoices'}
          </button>
        </div>

        {/* Invoices section */}
        <div
          className="section-header"
          onClick={() => setInvoicesOpen(!invoicesOpen)}
        >
          <span>📋 Invoices</span>
          <span>{invoicesOpen ? '▼' : '▶'}</span>
        </div>
        {invoicesOpen && (
          <div>
            {customers.map(customer => (
              <div
                key={customer}
                className={`customer-item ${selectedCustomer === customer ? 'active' : ''}`}
                onClick={() => setSelectedCustomer(customer)}
              >
                {customer}
              </div>
            ))}
          </div>
        )}

        <div className="section-header" onClick={() => window.location.href = '/inventory'}><span>📦 Inventory</span></div>
        <div className="section-header" onClick={()=>window.location.href = '/calculator'}><span>🧮 Calculator</span></div>
        <div className="section-header" onClick={() => window.location.href = '/settings'}><span>⚙️ Settings</span></div>

        {/* Logout */}
        <div className="logout-button" onClick={onLogout}>
          🚪 Logout
        </div>
      </div>
    </>
  );
}