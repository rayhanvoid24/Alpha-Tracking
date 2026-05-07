import React from 'react';
// Format date from YYYY-MM-DD to DD/MM/YYYY
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};
export default function InvoiceTable({ invoices, onUpdate, onDelete, showStatus }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Invoice #</th>
          <th>Date</th>
          <th>Due Date</th>
          <th>Amount</th>
          {showStatus && <th>Status</th>}
          <th>Override</th>
          <th>Comment</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {(invoices || []).map(invoice => (
          <tr key={invoice.id}>
            <td>{invoice.invoice_number}</td>
            <td>{formatDate(invoice.date)}</td>
            <td>{formatDate(invoice.due_date)}</td>
            <td>${invoice.total}</td>
            {showStatus && <td>
              <span className={`badge badge-${invoice.status === 'paid' ? 'paid' : invoice.status === 'overdue' ? 'overdue' : 'unpaid'}`}>
                {invoice.status}
              </span>
            </td>}
            <td>
              <select
                className="select"
                defaultValue={invoice.manual_status || ''}
                onChange={(e) => onUpdate(invoice.id, 'manual_status', e.target.value)}
              >
                <option value="">No override</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </td>
            <td>
              <input
                type="text"
                className="comment-input"
                defaultValue={invoice.comment || ''}
                placeholder="Add comment..."
                onBlur={(e) => onUpdate(invoice.id, 'comment', e.target.value)}
              />
            </td>
            <td>
              <button
                className="delete-button"
                onClick={() => onDelete(invoice.id)}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}