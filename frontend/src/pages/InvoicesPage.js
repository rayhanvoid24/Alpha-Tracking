import React, { useState, useEffect } from 'react';
import { getInvoices, updateInvoice, createInvoice, deleteInvoice } from '../services/api';
import './InvoicesPage.css';
import InvoiceTable from '../components/InvoiceTable';
import AddInvoiceForm from '../components/AddInvoiceForm';
import { useLocation } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    customer_name: '',
    invoice_number: '',
    amount: '',
    date: '',
    due_date: '',
  });

  const location = useLocation();
  const showStatus = localStorage.getItem('showInvoiceStatus') !== 'false';

  useEffect(() => {
    getInvoices()
      .then(response => {
        setInvoices(response.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load invoices');
        setLoading(false);
      });
  }, []);

  // Read customer from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const customer = params.get('customer');
    if (customer) setSelectedCustomer(decodeURIComponent(customer));
  }, [location.search]);

  useEffect(() => {
    setNewInvoice(prev => ({ ...prev, customer_name: selectedCustomer || '' }));
  }, [selectedCustomer]);

  const handleUpdate = (id, field, value) => {
    updateInvoice(id, { [field]: value })
      .then(() => {
        setInvoices(prev => prev.map(inv =>
          inv.id === id ? { ...inv, [field]: value } : inv
        ));
      })
      .catch(err => console.error('Failed to update invoice', err));
  };

  const handleCreateInvoice = () => {
    createInvoice(newInvoice)
      .then(() => getInvoices())
      .then(response => {
        setInvoices(response.data);
        setShowAddForm(false);
        setNewInvoice({
          customer_name: selectedCustomer || '',
          invoice_number: '',
          amount: '',
          date: '',
          due_date: '',
        });
      })
      .catch(err => console.error('Failed to create invoice', err));
  };

  const exportCustomerPDF = () => {
    const customerInvoices = groupedInvoices[selectedCustomer] || [];
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.text('PAYMENT HISTORY', 14, 18);

    doc.setFontSize(12);
    doc.text(selectedCustomer, 14, 26);

    doc.setFontSize(9);
    doc.setTextColor(127, 140, 141);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-AU')}`, 14, 32);

    const formatDate = (d) => {
      if (!d) return '';
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    };

    autoTable(doc, {
      startY: 38,
      head: [['Invoice #', 'Date', 'Due Date', 'Amount', 'Override', 'Comment']],
      body: customerInvoices.map(inv => [
        inv.invoice_number,
        formatDate(inv.date),
        formatDate(inv.due_date),
        `$${inv.total}`,
        inv.manual_status || '—',
        inv.comment || '',
      ]),
      headStyles: { fillColor: [44, 62, 80], fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 5: { cellWidth: 50 } },
      alternateRowStyles: { fillColor: [248, 249, 250] },
    });

    doc.save(`${selectedCustomer.replace(/\s+/g, '_')}_payment_history.pdf`);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      deleteInvoice(id)
        .then(() => {
          setInvoices(prev => prev.filter(inv => inv.id !== id));
        })
        .catch(err => console.error('Failed to delete invoice', err));
    }
  };

  const groupedInvoices = invoices.reduce((groups, invoice) => {
    const customer = invoice.customer;
    if (!groups[customer]) groups[customer] = [];
    groups[customer].push(invoice);
    return groups;
  }, {});

  return (
    <div style={{ flex: 1, padding: '30px', overflowY: 'auto', backgroundColor: 'white' }}>
      {loading && <div className="loading">Loading invoices...</div>}
      {error && <div className="error">{error}</div>}

      {!selectedCustomer && !loading && (
        <div className="empty-state">
          <h3>Select a customer from the sidebar</h3>
          <p>Click on a customer name to view their invoices</p>
        </div>
      )}

      {selectedCustomer && !loading && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 className="customer-title">{selectedCustomer}</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={exportCustomerPDF}
                style={{
                  padding: '10px 20px', backgroundColor: '#e74c3c',
                  color: 'white', border: 'none', borderRadius: '5px',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
                }}
              >
                Export PDF
              </button>
              <button
                className="add-button"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                + Add Invoice
              </button>
            </div>
          </div>

          {showAddForm && (
            <AddInvoiceForm
              selectedCustomer={selectedCustomer}
              newInvoice={newInvoice}
              setNewInvoice={setNewInvoice}
              onSave={handleCreateInvoice}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          <InvoiceTable
            invoices={groupedInvoices[selectedCustomer]}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            showStatus={showStatus}
          />
        </>
      )}
    </div>
  );
}