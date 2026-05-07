import React from 'react';

export default function AddInvoiceForm({ selectedCustomer, newInvoice, setNewInvoice, onSave, onCancel }) {
  return (
    <div className="add-form">
      <h3 style={{ marginBottom: '15px', color: '#2c3e50' }}>Add Manual Invoice</h3>
      <div className="form-grid">
        <div>
          <label className="form-label">Customer Name</label>
          <input
            className="form-input"
            style={{ backgroundColor: '#f0f0f0' }}
            value={selectedCustomer}
            readOnly
          />
        </div>
        <div>
          <label className="form-label">Invoice Number</label>
          <input
            className="form-input"
            value={newInvoice.invoice_number}
            onChange={(e) => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })}
            placeholder="e.g. INV-001"
          />
        </div>
        <div>
          <label className="form-label">Amount</label>
          <input
            className="form-input"
            type="number"
            value={newInvoice.amount}
            onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
            placeholder="e.g. 233.30"
          />
        </div>
        <div>
          <label className="form-label">Invoice Date</label>
          <input
            className="form-input"
            type="date"
            value={newInvoice.date}
            onChange={(e) => setNewInvoice({ ...newInvoice, date: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label">Due Date</label>
          <input
            className="form-input"
            type="date"
            value={newInvoice.due_date}
            onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
          />
        </div>
      </div>
      <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
        <button className="add-button" onClick={onSave}>Save Invoice</button>
        <button className="cancel-button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}