import React from 'react';
import Sidebar from './Sidebar';
import { useNavigate } from 'react-router-dom';
import { getInvoices, syncInvoices } from '../services/api';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const [invoicesOpen, setInvoicesOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [customers, setCustomers] = React.useState([]);

  React.useEffect(() => {
    getInvoices().then(response => {
      const grouped = response.data.reduce((groups, invoice) => {
        if (!groups[invoice.customer]) groups[invoice.customer] = [];
        groups[invoice.customer].push(invoice);
        return groups;
      }, {});
      setCustomers(Object.keys(grouped).sort());
    });
  }, []);

  const handleSync = () => {
    setSyncing(true);
    syncInvoices()
      .then(() => getInvoices())
      .then(response => {
        const grouped = response.data.reduce((groups, invoice) => {
          if (!groups[invoice.customer]) groups[invoice.customer] = [];
          groups[invoice.customer].push(invoice);
          return groups;
        }, {});
        setCustomers(Object.keys(grouped).sort());
        setSyncing(false);
      })
      .catch(() => setSyncing(false));
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        invoicesOpen={invoicesOpen}
        setInvoicesOpen={setInvoicesOpen}
        customers={customers}
        selectedCustomer={null}
        setSelectedCustomer={(customer) => {
        navigate(`/invoices?customer=${encodeURIComponent(customer)}`);
        }}
        syncing={syncing}
        onSync={handleSync}
        onLogout={handleLogout}
      />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}