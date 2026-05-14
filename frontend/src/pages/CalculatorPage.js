import React, { useState, useEffect } from 'react';
import { getMenuItems, getCustomers, createDeliveryOrder, getDeliveryOrder, getKitchenPrep, generateInvoice, deleteGeneratedInvoice, markDelivered, saveDeliveryOrder } from '../services/api';
import './CalculatorPage.css';
import './KitchenPrepSheet.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CalculatorPage() {
  // ─── Data from API ───────────────────────────────────────────
  const [menuItems, setMenuItems] = useState([]);
  const [customers, setCustomers] = useState([]);

  // ─── Delivery order state ────────────────────────────────────
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderId, setOrderId] = useState(null);
  const [useByDate, setUseByDate] = useState('');
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── Kitchen prep state ───────────────────────────────────────
  const [kitchenPrep, setKitchenPrep] = useState(null);

  // ─── Save state ───────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedIndicator, setSavedIndicator] = useState(false);

  // ─── Invoice generation state ─────────────────────────────────
  const [invoicedCustomerIds, setInvoicedCustomerIds] = useState([]);
  const [invoiceModal, setInvoiceModal] = useState(null); // { customer, orderId, deliveryDate }
  const [selectedInvoiceDayOffset, setSelectedInvoiceDayOffset] = useState(0);
  const [selectedDueDays, setSelectedDueDays] = useState(4);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceSuccess, setInvoiceSuccess] = useState('');
  const [deletingInvoiceIds, setDeletingInvoiceIds] = useState(new Set());
  const [isDelivered, setIsDelivered] = useState(false);
  const [deliverLoading, setDeliverLoading] = useState(false);
  const [deliverError, setDeliverError] = useState('');

  // ─── Customer selection state ─────────────────────────────────
  const [tableCustomers, setTableCustomers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customEntry, setCustomEntry] = useState('');

  // ─── Fetch menu items and customers on load ───────────────────
  useEffect(() => {
    getMenuItems().then(res => setMenuItems(res.data));
    getCustomers().then(res => setCustomers(res.data));
  }, []);

  // ─── Date selection — must be a Monday ───────────────────────
  const handleDateChange = (e) => {
    const date = e.target.value;
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (dateObj.getDay() !== 1) {
      setError('Please select a Monday');
      return;
    }
    setError('');
    setDeliveryDate(date);
    loadOrCreateOrder(date);
  };

  // ─── Rebuild quantities + tableCustomers from a saved items array ──
  const restoreFromItems = (items) => {
    const q = {};
    items.forEach(item => {
      const customerId = item.customer_id != null ? item.customer_id : `custom-${item.custom_entry_id}`;
      q[`${customerId}-${item.menu_item_id}`] = item.quantity;
    });

    const seenCustomerIds = new Set();
    const restoredReal = [];
    items.filter(i => i.customer_id != null).forEach(i => {
      if (!seenCustomerIds.has(i.customer_id)) {
        seenCustomerIds.add(i.customer_id);
        const match = customers.find(c => c.id === i.customer_id);
        if (match) restoredReal.push(match);
      }
    });

    const seenCustomEntryIds = new Set();
    const restoredCustom = [];
    items.filter(i => i.custom_entry_id != null).forEach(i => {
      if (!seenCustomEntryIds.has(i.custom_entry_id)) {
        seenCustomEntryIds.add(i.custom_entry_id);
        restoredCustom.push({ id: `custom-${i.custom_entry_id}`, name: i.custom_entry_name, isCustom: true });
      }
    });

    return { quantities: q, tableCustomers: [...restoredReal, ...restoredCustom] };
  };

  // ─── Load existing delivery order or create new one ──────────
  const loadOrCreateOrder = (date) => {
    setLoading(true);
    setIsDelivered(false);
    setDeliverError('');
    setSaveError('');
    setSavedIndicator(false);
    setTableCustomers([]);
    getDeliveryOrder(date)
      .then(res => {
        setOrderId(res.data.id);
        setUseByDate(res.data.use_by_date);
        setIsDelivered(res.data.is_delivered || false);
        setInvoicedCustomerIds(res.data.invoiced_customer_ids || []);
        const { quantities: q, tableCustomers: tc } = restoreFromItems(res.data.items);
        setQuantities(q);
        setTableCustomers(tc);
        fetchKitchenPrep(res.data.id);
        setLoading(false);
      })
      .catch(() => {
        createDeliveryOrder({ delivery_date: date })
          .then(res => {
            setOrderId(res.data.id);
            setUseByDate(res.data.use_by_date);
            setIsDelivered(false);
            setQuantities({});
            fetchKitchenPrep(res.data.id);
            setLoading(false);
          })
          .catch(() => {
            setError('Failed to create delivery order');
            setLoading(false);
          });
      });
  };

  // ─── Fetch kitchen prep calculations ─────────────────────────
  const fetchKitchenPrep = (id) => {
    getKitchenPrep(id)
      .then(res => setKitchenPrep(res.data))
      .catch(err => console.error('Failed to fetch kitchen prep:', err));
  };

  // ─── Add a real customer from dropdown ───────────────────────
  const addCustomer = (customer) => {
    if (tableCustomers.find(c => c.id === customer.id)) return;
    setTableCustomers(prev => [...prev, customer]);
    setShowDropdown(false);
  };

  // ─── Add a custom entry (e.g. "Staff Order") ─────────────────
  const addCustomEntry = () => {
    if (!customEntry.trim()) return;
    const customId = `custom-${Date.now()}`;
    setTableCustomers(prev => [...prev, { id: customId, name: customEntry.trim(), isCustom: true }]);
    setCustomEntry('');
  };

  // ─── Remove a customer from the table ────────────────────────
  const removeCustomer = (customerId) => {
    setTableCustomers(prev => prev.filter(c => c.id !== customerId));
  };

  // ─── Arrow-key navigation between cells (Excel-style) ────────
  const handleCellKeyDown = (e, rowIndex, colIndex) => {
    let targetRow = rowIndex;
    let targetCol = colIndex;

    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); targetRow = rowIndex - 1; break;
      case 'ArrowDown':  e.preventDefault(); targetRow = rowIndex + 1; break;
      case 'ArrowLeft':  e.preventDefault(); targetCol = colIndex - 1; break;
      case 'ArrowRight': e.preventDefault(); targetCol = colIndex + 1; break;
      case 'Enter':      e.preventDefault(); targetRow = rowIndex + 1; break;
      default: return;
    }

    const target = document.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
    if (target) { target.focus(); target.select(); }
  };

  // ─── Update quantity in local state only — saved on explicit Save ──
  const handleQuantityChange = (customerId, menuItemId, value) => {
    const key = `${customerId}-${menuItemId}`;
    const qty = parseInt(value) || 0;
    setQuantities(prev => ({ ...prev, [key]: qty }));
  };

  // ─── Save all items to the backend, then refresh kitchen prep ──
  const handleSave = () => {
    setSaving(true);
    setSaveError('');
    const items = [];
    tableCustomers.forEach(customer => {
      menuItems.forEach(item => {
        const qty = quantities[`${customer.id}-${item.id}`] || 0;
        if (qty <= 0) return;
        if (String(customer.id).startsWith('custom-')) {
          items.push({ custom_name: customer.name, menu_item_id: item.id, quantity: qty });
        } else {
          items.push({ customer_id: customer.id, menu_item_id: item.id, quantity: qty });
        }
      });
    });
    saveDeliveryOrder(orderId, { items })
      .then(res => {
        const { quantities: q, tableCustomers: tc } = restoreFromItems(res.data.items);
        setQuantities(q);
        // Preserve the user's row order, updating IDs for custom entries
        setTableCustomers(prev => prev.map(tc_entry => {
          if (!String(tc_entry.id).startsWith('custom-')) return tc_entry;
          const saved = tc.find(r => r.name === tc_entry.name);
          return saved || tc_entry;
        }));
        fetchKitchenPrep(orderId);
        setSaving(false);
        setSavedIndicator(true);
        setTimeout(() => setSavedIndicator(false), 2500);
      })
      .catch(() => {
        setSaveError('Failed to save. Please try again.');
        setSaving(false);
      });
  };

  // ─── Copy quantities from the previous Monday's order ────────
  const copyFromLastWeek = () => {
    const [year, month, day] = deliveryDate.split('-').map(Number);
    const current = new Date(year, month - 1, day);
    const lastMonday = new Date(current);
    lastMonday.setDate(current.getDate() - 7);
    const pad = n => String(n).padStart(2, '0');
    const lastMondayStr = `${lastMonday.getFullYear()}-${pad(lastMonday.getMonth() + 1)}-${pad(lastMonday.getDate())}`;
    getDeliveryOrder(lastMondayStr)
      .then(res => {
        const { quantities: q, tableCustomers: tc } = restoreFromItems(res.data.items);
        setQuantities(q);
        setTableCustomers(tc);
      })
      .catch(() => {});
  };

  // ─── Invoice generation ───────────────────────────────────────
  const openInvoiceModal = (customer) => {
    setInvoiceModal({ customer, orderId, deliveryDate });
    setSelectedInvoiceDayOffset(0);
    setSelectedDueDays(4);
    setInvoiceError('');
    setInvoiceSuccess('');
  };

  const addDays = (dateStr, days) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const handleGenerateInvoice = () => {
    const { customer, orderId: oid, deliveryDate: dd } = invoiceModal;
    const invoiceDate = addDays(dd, selectedInvoiceDayOffset);
    const dueDate = addDays(invoiceDate, selectedDueDays);
    setInvoiceLoading(true);
    setInvoiceError('');
    generateInvoice(oid, customer.id, invoiceDate, dueDate)
      .then(res => {
        setInvoicedCustomerIds(prev => [...prev, customer.id]);
        setInvoiceSuccess(`Invoice ${res.data.invoice_number} created for ${customer.name}`);
        setInvoiceLoading(false);
        setTimeout(() => setInvoiceModal(null), 2000);
      })
      .catch(err => {
        setInvoiceError(err.response?.data?.error || 'Failed to generate invoice');
        setInvoiceLoading(false);
      });
  };

  const handleDeleteInvoice = (customer) => {
    if (!window.confirm(`Delete the invoice for ${customer.name}? This cannot be undone.`)) return;
    setDeletingInvoiceIds(prev => new Set(prev).add(customer.id));
    deleteGeneratedInvoice(orderId, customer.id)
      .then(() => {
        setInvoicedCustomerIds(prev => prev.filter(id => id !== customer.id));
      })
      .catch(err => {
        alert(err.response?.data?.error || 'Failed to delete invoice');
      })
      .finally(() => {
        setDeletingInvoiceIds(prev => { const s = new Set(prev); s.delete(customer.id); return s; });
      });
  };

  const handleMarkDelivered = () => {
    if (!window.confirm('Mark this delivery as finalised? Sleeve inventory will be deducted.')) return;
    setDeliverLoading(true);
    setDeliverError('');
    markDelivered(orderId)
      .then(() => {
        setIsDelivered(true);
        setDeliverLoading(false);
      })
      .catch(err => {
        const msg = err.response?.data?.error || 'Failed to mark as delivered';
        setDeliverError(msg);
        if (err.response?.status === 409) setIsDelivered(true);
        setDeliverLoading(false);
      });
  };

  // ─── Row total for a customer ─────────────────────────────────
  const getRowTotal = (customerId) => {
    return menuItems.reduce((total, item) => {
      return total + (quantities[`${customerId}-${item.id}`] || 0);
    }, 0);
  };

  // ─── Column total for a menu item ────────────────────────────
  const getColumnTotal = (menuItemId) => {
    return tableCustomers.reduce((total, customer) => {
      return total + (quantities[`${customer.id}-${menuItemId}`] || 0);
    }, 0);
  };

  // ─── Grand total ──────────────────────────────────────────────
  const getGrandTotal = () => {
    return tableCustomers.reduce((total, customer) => total + getRowTotal(customer.id), 0);
  };

  // ─── Box count ────────────────────────────────────────────────
  // 1 box holds 16 portions. Returns "boxes / leftover" e.g. "1 / 4".
  // Returns '' for 0 so empty cells stay blank.
  const boxCount = (qty) => {
    if (!qty) return '';
    const boxes = Math.floor(qty / 16);
    const left = qty % 16;
    return `${boxes} / ${left}`;
  };

  // ─── Tray calculation ─────────────────────────────────────────
  // Add product codes here if more items need tray calculations
  const TRAY_ITEMS = {
    '1001': { portionsPerTray: 12 },
    '3003': { portionsPerTray: 12 },
  };

  const getTrays = (menuItemCode, total) => {
    if (!TRAY_ITEMS[menuItemCode] || total === 0) return '';
    const portionsPerTray = TRAY_ITEMS[menuItemCode].portionsPerTray;
    let trays = Math.floor(total / portionsPerTray);
    const leftover = total % portionsPerTray;
    if (leftover > 0 && leftover <= 6) trays += 0.5;
    else if (leftover > 6) trays += 1;
    return `${trays} Trays`;
  };

  // ─── Row color ────────────────────────────────────────────────
  const getRowColor = (index) => {
    const colors = [
      '#ffffff', '#f5cba7', '#a9dfbf', '#aed6f1',
      '#f1948a', '#f9e79f', '#c39bd3', '#76d7c4',
      '#f0b27a', '#7fb3d3',
    ];
    return colors[index % colors.length];
  };

  // ─── Export Delivery Table to PDF ────────────────────────────
  // Opens a preview in a new browser tab (use browser's download button to save).
  // To tweak sizing: fontSize + cellPadding in styles{}, column widths below.
  // To tweak layout: customerColWidth, totalColWidth, startY.
  const exportPDF = () => {
    const doc = new jsPDF('landscape');

    // ── Header ──
    doc.setFontSize(16);
    doc.text(`DELIVERY ${deliveryDate}`, 14, 15);

    // Use by date line — shifts table start down if present
    let tableStartY = 22;
    if (useByDate) {
      doc.setFontSize(11);
      doc.text(`USE BY DATE: ${new Date(useByDate).toLocaleDateString('en-AU')}`, 14, 22);
      tableStartY = 29;
    }

    // ── Helpers ──
    const hexToRgb = (hex) => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];

    // ── Table data ──
    // Column order: CUSTOMER | ...items | TOTAL | BOXES
    const headers = ['CUSTOMER', ...menuItems.map(i => `${i.name}\n${i.code}`), 'TOTAL', 'BOXES'];
    const totalColIdx = menuItems.length + 1; // green column
    const boxesColIdx = headers.length - 1;   // yellow column

    const rows = tableCustomers.map(customer => [
      customer.name,
      ...menuItems.map(item => quantities[`${customer.id}-${item.id}`] || ''),
      getRowTotal(customer.id) || '',
      boxCount(getRowTotal(customer.id)), // boxes for this customer
    ]);

    // TOTAL row (orange) — index tableCustomers.length
    // BOXES cell sums full boxes from each customer row individually (not Math.floor of grand total),
    // so it stays consistent with what you'd get adding up the BOXES column yourself.
    const totalFullBoxes = tableCustomers.reduce((sum, c) => sum + Math.floor(getRowTotal(c.id) / 16), 0);
    rows.push([
      'TOTAL',
      ...menuItems.map(item => getColumnTotal(item.id) || ''),
      getGrandTotal() || '',
      `${totalFullBoxes}/`,
    ]);

    // Quantity Prepared row (green) — index tableCustomers.length + 1
    // Mirrors the on-screen tray row; TOTAL + BOXES cells left empty.
    rows.push([
      'Quantity Prepared',
      ...menuItems.map(item => getTrays(item.code, getColumnTotal(item.id))),
      '',
      '',
    ]);

    const totalsRowIdx = tableCustomers.length;     // orange
    const qtyPrepRowIdx = tableCustomers.length + 1; // green

    // ── Column widths ──
    // Fixed columns are kept narrow to maximise space for the 15 item columns.
    // Tweak these if customer names get clipped or item headers are still squashed.
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = pageWidth - margin * 2;
    const customerColWidth = 38; // reduced from 48 to free space for item columns
    const totalColWidth = 13;    // reduced from 17
    const boxesColWidth = 15;    // reduced from 20
    const itemColWidth = (tableWidth - customerColWidth - totalColWidth - boxesColWidth) / menuItems.length;

    const columnStyles = {
      0: { cellWidth: customerColWidth },
      [menuItems.length + 1]: { cellWidth: totalColWidth },
      [menuItems.length + 2]: { cellWidth: boxesColWidth, halign: 'center' }, // BOXES
    };
    menuItems.forEach((_, i) => { columnStyles[i + 1] = { cellWidth: itemColWidth, halign: 'center' }; });

    // ── Render table ──
    // Body fontSize / cellPadding scale cell size uniformly — bump both by the same % to resize.
    // headStyles fontSize is kept smaller so the two-line item headers (name + code) fit without squashing.
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: tableStartY,
      margin: { left: margin, right: margin },
      tableWidth,
      styles: { fontSize: 8.4, cellPadding: 1.8, lineWidth: 0.2, lineColor: [0, 0, 0] },
      headStyles: { fillColor: [44, 62, 80], lineWidth: 0.2, lineColor: [0, 0, 0], fontSize: 6.5, cellPadding: 1.2 },
      columnStyles,
      didParseCell: (data) => {
        // BOXES column — yellow in header + body, always takes priority
        if (data.column.index === boxesColIdx) {
          data.cell.styles.fillColor = [255, 241, 118];
          data.cell.styles.textColor = [0, 0, 0];
          if (data.section === 'body' && data.cell.raw !== '') {
            data.cell.styles.fontStyle = 'bold';
          }
          return;
        }

        // TOTAL column header — green
        if (data.section === 'head') {
          if (data.column.index === totalColIdx) {
            data.cell.styles.fillColor = [213, 245, 227];
            data.cell.styles.textColor = [0, 0, 0];
          }
          return; // all other header cells handled by headStyles
        }

        // Quantity Prepared row — green, bold
        if (data.row.index === qtyPrepRowIdx) {
          data.cell.styles.fillColor = [213, 232, 212];
          data.cell.styles.fontStyle = 'bold';
          return;
        }

        // TOTAL row — orange, bold (overrides TOTAL column green for this row)
        if (data.row.index === totalsRowIdx) {
          data.cell.styles.fillColor = [243, 156, 18];
          data.cell.styles.fontStyle = 'bold';
          return;
        }

        // Customer rows — TOTAL column green, others get per-row color
        if (data.column.index === totalColIdx) {
          data.cell.styles.fillColor = [213, 245, 227];
          data.cell.styles.fontStyle = 'bold';
          return;
        }

        data.cell.styles.fillColor = hexToRgb(getRowColor(data.row.index));
        // col 0 is the customer name — leave normal weight
        if (data.column.index > 0 && data.cell.raw !== '') {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    // Open blob URL in new tab so the user can preview before saving
    window.open(doc.output('bloburi'), '_blank');
  };
  // ─── Export Kitchen Prep Sheet to PDF ────────────────────────
const exportKitchenPrepPDF = () => {
  const doc = new jsPDF('landscape');

  doc.setFontSize(14);
  doc.text(`KITCHEN PREP — DELIVERY ${deliveryDate}`, 14, 15);
  doc.setFontSize(10);
  doc.text(`USE BY DATE: ${new Date(kitchenPrep.use_by_date).toLocaleDateString('en-AU')}`, 14, 22);

  const col1Left = 14;
  const col2Left = 100;
  const col3Left = 186;
  const col1Width = 80;
  const col2Width = 80;
  const col3Width = 106;

  // ── Column 1: Rice, Chicken, Sauces ──
  let y1 = 30;

  autoTable(doc, {
    head: [['RICE', 'QTY']],
    body: [
      ['White Rice — 1kg Tray', `${kitchenPrep.rice.white_rice} kg`],
      ['Leb Rice — 1kg Tray', `${kitchenPrep.rice.leb_rice} kg`],
      ['Jasmine Rice', `${kitchenPrep.rice.jasmine_rice} kg`],
    ],
    startY: y1,
    margin: { left: col1Left },
    tableWidth: col1Width,
    headStyles: { fillColor: [241, 194, 50], textColor: [0, 0, 0] },
    styles: { fontSize: 8 },
  });
  y1 = doc.lastAutoTable.finalY + 5;

  autoTable(doc, {
    head: [['CHICKEN ORDER (kg)', 'QTY']],
    body: [
      ['Chicken Thigh (Tikka)', `${kitchenPrep.chicken.thigh_tikka} kg`],
      ['Chicken Thigh (Curry)', `${kitchenPrep.chicken.thigh_curry} kg`],
      ['Chicken Breast (Leb)', `${kitchenPrep.chicken.breast_leb} kg`],
      ['Breast Sliced 140g', `${kitchenPrep.chicken.breast_sliced} kg`],
    ],
    startY: y1,
    margin: { left: col1Left },
    tableWidth: col1Width,
    headStyles: { fillColor: [224, 102, 102] },
    styles: { fontSize: 8 },
  });
  y1 = doc.lastAutoTable.finalY + 5;

  autoTable(doc, {
    head: [['SAUCES COOKING', 'QTY']],
    body: [
      ['1. Napoletane — Tomato', `${kitchenPrep.sauces.napoletane} L`],
      ['2. Bechamel — Milk', `${kitchenPrep.sauces.bechamel} L`],
      ['3. Tikka Sauce — Tomato', `${kitchenPrep.sauces.tikka} L`],
      ['4. Pesto Pasta — Pesto', `${kitchenPrep.sauces.pesto} L`],
    ],
    startY: y1,
    margin: { left: col1Left },
    tableWidth: col1Width,
    headStyles: { fillColor: [230, 145, 56] },
    styles: { fontSize: 8 },
  });

  // ── Column 2: Cooking Time, Pasta, Beef Mince, Chicken Thigh Mince ──
  let y2 = 30;

  autoTable(doc, {
    head: [['COOKING TIME', '']],
    body: [
      ['Tandoori Chicken', '230°C — 15-16 mins'],
      ['Grilled Chicken', '290°C 10% Combi — 12 mins'],
      ['Leb Chicken', '180°C 70% Combi — 15 mins'],
    ],
    startY: y2,
    margin: { left: col2Left },
    tableWidth: col2Width,
    headStyles: { fillColor: [11, 83, 148] },
    styles: { fontSize: 8 },
  });
  y2 = doc.lastAutoTable.finalY + 5;

  autoTable(doc, {
    head: [['PASTA (1 pack = 5.5 portions)', 'QTY']],
    body: [
      ['Penne', `${kitchenPrep.pasta.penne} Pac`],
      ['Casarecce', `${kitchenPrep.pasta.casarecce} Pac`],
      ['Pea Risotto', `${kitchenPrep.pasta.pea_risotto} kg`],
      ['Spaghetti', `${kitchenPrep.pasta.spaghetti} kg`],
    ],
    startY: y2,
    margin: { left: col2Left },
    tableWidth: col2Width,
    headStyles: { fillColor: [106, 168, 79] },
    styles: { fontSize: 8 },
  });
  y2 = doc.lastAutoTable.finalY + 5;

  autoTable(doc, {
    head: [['BEEF MINCE', 'QTY']],
    body: [
      ['5. Bolognese', `${kitchenPrep.beef_mince.bolognese.toFixed(1)} kg`],
      ['6. Chili Con Carne', `${kitchenPrep.beef_mince.chili} kg`],
      ['7. Beef Leb Rice', `${kitchenPrep.beef_mince.leb_rice} kg`],
      ['TOTAL MINCE', `${kitchenPrep.beef_mince.total.toFixed(1)} kg`],
    ],
    startY: y2,
    margin: { left: col2Left },
    tableWidth: col2Width,
    headStyles: { fillColor: [204, 65, 37] },
    styles: { fontSize: 8 },
  });
  y2 = doc.lastAutoTable.finalY + 5;

  autoTable(doc, {
    head: [['CHICKEN THIGH MINCE', 'QTY']],
    body: [
      ['11. Chicken Holy Basil', `${kitchenPrep.chicken.thigh_mince} kg`],
    ],
    startY: y2,
    margin: { left: col2Left },
    tableWidth: col2Width,
    headStyles: { fillColor: [204, 65, 37] },
    styles: { fontSize: 8 },
  });

  // ── Column 3: Portioning Sizes, Pasta/Rice — Protein ──
  let y3 = 30;

  autoTable(doc, {
    head: [['PORTIONING SIZES', 'DETAILS']],
    body: [
      ['Chili Con Carne', '140g rice + 220g chili + sour cream + cheese'],
      ['Tikka', '140g rice + 100-110g chicken + curry (total 390g)'],
      ['Penne', '2k pasta + 0.5 kilo sauce (200g pasta 180g sauce total 380)'],
      ['Leb Rice', '250g rice 100-110g chicken + nuts total 360g'],
      ['Pesto 260g + chix', '2 kilos pesto + 2.5 kilos cream + 1 kilo spinach + 50g salt'],
      ['Pea Spin. Risotto', '280g risotto + chicken'],
      ['Massaman Beef', '140g rice + 3 pcs beef + potato (total 400g)'],
    ],
    startY: y3,
    margin: { left: col3Left },
    tableWidth: col3Width,
    headStyles: { fillColor: [61, 133, 198] },
    styles: { fontSize: 7 },
    columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 68 } },
  });
  y3 = doc.lastAutoTable.finalY + 5;

  autoTable(doc, {
    head: [['PASTA/RICE', 'PROTEIN', 'TRAY']],
    body: [
      ['140g', '220g', 'SGL Tray'],
      ['140g', '100g', 'SPT Tray'],
      ['200g', '180g', ''],
      ['250g', '100g', ''],
      ['260g', '100g', ''],
      ['290g', '100g', ''],
      ['140g', '270g', ''],
    ],
    startY: y3,
    margin: { left: col3Left },
    tableWidth: col3Width,
    headStyles: { fillColor: [106, 168, 79] },
    styles: { fontSize: 7 },
  });

  doc.save(`kitchen_prep_${deliveryDate}.pdf`);
};

  return (
    <div className="calculator-container">

      {/* ── Date bar ── */}
      <div className="date-bar">
        <div>
          <label className="date-label">Delivery Date (Monday):</label>
          <input
            type="date"
            value={deliveryDate}
            onChange={handleDateChange}
            className="date-input"
          />
        </div>
        {useByDate && (
          <div className="use-by-badge">
            USE BY DATE: {new Date(useByDate).toLocaleDateString('en-AU')}
          </div>
        )}
        {orderId && (
          <button
            onClick={exportPDF}
            style={{
              padding: '8px 16px',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            📄 Export PDF
          </button>
        )}
        {orderId && (
          isDelivered ? (
            <div style={{
              padding: '8px 16px', backgroundColor: '#d5f5e3', color: '#27ae60',
              borderRadius: '4px', fontWeight: 'bold', fontSize: '14px',
            }}>
              ✓ Delivered
            </div>
          ) : (
            <button
              onClick={handleMarkDelivered}
              disabled={deliverLoading}
              style={{
                padding: '8px 16px', backgroundColor: '#e67e22', color: 'white',
                border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
              }}
            >
              {deliverLoading ? 'Saving…' : '✓ Mark as Delivered'}
            </button>
          )
        )}
        {deliverError && <div className="error-text">{deliverError}</div>}
        {error && <div className="error-text">{error}</div>}
      </div>

      {loading && <div>Loading...</div>}

      {orderId && !loading && (
        <>
          {/* ── Save + Copy from last week ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 20px', backgroundColor: '#2980b9', color: 'white',
                border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={copyFromLastWeek}
              style={{
                padding: '8px 16px', backgroundColor: '#7f8c8d', color: 'white',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
              }}
            >
              Copy from Last Week
            </button>
            {savedIndicator && (
              <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '14px' }}>✓ Saved</span>
            )}
            {saveError && <span style={{ color: '#e74c3c', fontSize: '14px' }}>{saveError}</span>}
          </div>

          {/* ── Customer selector ── */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {tableCustomers.map(customer => (
                <div key={customer.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  backgroundColor: '#2c3e50',
                  color: 'white',
                  borderRadius: '20px',
                  fontSize: '13px',
                }}>
                  {customer.name}
                  <span
                    onClick={() => removeCustomer(customer.id)}
                    style={{ cursor: 'pointer', marginLeft: '4px', fontWeight: 'bold' }}
                  >✕</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2c3e50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  + Add Customer ▼
                </button>
                {showDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '38px',
                    left: 0,
                    backgroundColor: 'white',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    maxHeight: '250px',
                    overflowY: 'auto',
                    minWidth: '200px',
                  }}>
                    {customers
                      .filter(c => !tableCustomers.find(tc => tc.id === c.id))
                      .map(customer => (
                        <div
                          key={customer.id}
                          onClick={() => addCustomer(customer)}
                          style={{
                            padding: '8px 14px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            borderBottom: '1px solid #f0f0f0',
                          }}
                          onMouseEnter={e => e.target.style.backgroundColor = '#f8f9fa'}
                          onMouseLeave={e => e.target.style.backgroundColor = 'white'}
                        >
                          {customer.name}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <input
                type="text"
                value={customEntry}
                onChange={(e) => setCustomEntry(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomEntry()}
                placeholder="Custom entry e.g. Staff Order"
                style={{
                  padding: '8px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '13px',
                  width: '220px',
                }}
              />
              <button
                onClick={addCustomEntry}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                + Add
              </button>
            </div>
          </div>

          {/* ── Delivery table ── */}
          {tableCustomers.length > 0 && (
            <table className="delivery-table">
              <thead>
                <tr>
                  <th>CUSTOMER / PRODUCT</th>
                  {menuItems.map(item => (
                    <th key={item.id} className="product-header">{item.name}</th>
                  ))}
                  {/* TOTAL column — green highlight */}
                  <th style={{ backgroundColor: '#d5f5e3', color: '#000' }}>TOTAL</th>
                  {/* BOXES column — yellow highlight */}
                  <th style={{ backgroundColor: '#fff176', color: '#000' }}>BOXES</th>
                </tr>
                <tr>
                  <th></th>
                  {menuItems.map(item => (
                    <th key={item.id} className="product-code">{item.code}</th>
                  ))}
                  <th style={{ backgroundColor: '#d5f5e3' }}></th>
                  <th style={{ backgroundColor: '#fff176' }}></th>
                </tr>
              </thead>
              <tbody>
                {tableCustomers.map((customer, idx) => (
                  <tr key={customer.id} style={{ backgroundColor: getRowColor(idx) }}>
                    <td className="customer-name">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span>{customer.name}</span>
                        {!customer.isCustom && (
                          invoicedCustomerIds.includes(customer.id) ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontSize: '11px', padding: '2px 6px 2px 8px',
                              backgroundColor: '#d5f5e3', color: '#27ae60',
                              borderRadius: '10px', fontWeight: 'bold', whiteSpace: 'nowrap',
                            }}>
                              Invoiced
                              <button
                                onClick={() => handleDeleteInvoice(customer)}
                                disabled={deletingInvoiceIds.has(customer.id)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: '#e74c3c', fontWeight: 'bold', fontSize: '13px',
                                  lineHeight: 1, padding: '0 2px',
                                }}
                                title="Delete invoice"
                              >
                                {deletingInvoiceIds.has(customer.id) ? '…' : '×'}
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => openInvoiceModal(customer)}
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                backgroundColor: '#2c3e50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                fontWeight: 'bold',
                              }}
                            >
                              + Invoice
                            </button>
                          )
                        )}
                      </div>
                    </td>
                    {menuItems.map((item, itemIdx) => (
                      <td key={item.id}>
                        <input
                          type="number"
                          min="0"
                          value={quantities[`${customer.id}-${item.id}`] || ''}
                          onChange={(e) => handleQuantityChange(customer.id, item.id, e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, itemIdx)}
                          data-row={idx}
                          data-col={itemIdx}
                          className="cell-input"
                        />
                      </td>
                    ))}
                    {/* TOTAL column — green per customer row */}
                    <td className="row-total" style={{ backgroundColor: '#d5f5e3' }}>
                      {getRowTotal(customer.id) || ''}
                    </td>
                    {/* Box count for this customer — yellow highlighter column */}
                    <td style={{ backgroundColor: '#fff176', fontWeight: 'bold', textAlign: 'center' }}>
                      {boxCount(getRowTotal(customer.id))}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="totals-row">
                  <td>TOTAL</td>
                  {menuItems.map(item => (
                    <td key={item.id}>{getColumnTotal(item.id) || ''}</td>
                  ))}
                  <td>{getGrandTotal() || ''}</td>
                  {/* Sum of full boxes per customer — consistent with adding up the BOXES column */}
                  <td style={{ backgroundColor: '#fff176', fontWeight: 'bold', textAlign: 'center' }}>
                    {`${tableCustomers.reduce((sum, c) => sum + Math.floor(getRowTotal(c.id) / 16), 0)}/`}
                  </td>
                </tr>
                {/* Quantity prepared row */}
                <tr style={{ backgroundColor: '#d5e8d4', fontWeight: 'bold' }}>
                  <td>Quantity Prepared</td>
                  {menuItems.map(item => (
                    <td key={item.id} style={{ textAlign: 'center', fontSize: '11px' }}>
                      {getTrays(item.code, getColumnTotal(item.id))}
                    </td>
                  ))}
                  {/* TOTAL column — green, empty for this row */}
                  <td style={{ backgroundColor: '#d5f5e3' }}></td>
                  <td style={{ backgroundColor: '#fff176' }}></td>
                </tr>
              </tbody>
            </table>
          )}

          {/* Show message if no customers selected yet */}
          {tableCustomers.length === 0 && (
            <div style={{ textAlign: 'center', color: '#7f8c8d', marginTop: '40px', fontSize: '15px' }}>
              Add customers above to start the delivery table
            </div>
          )}

          {/* ── Page 2: Kitchen Prep Sheet ── */}
{kitchenPrep && (
  <div className="kitchen-prep">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h2 style={{ margin: 0 }}>Kitchen Prep Sheet</h2>
      <button
        onClick={exportKitchenPrepPDF}
        style={{
          padding: '8px 16px',
          backgroundColor: '#e74c3c',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        📄 Export Kitchen Prep PDF
      </button>
    </div>

    <div className="prep-grid">

      {/* ── COLUMN 1: Use By, Rice, Chicken, Sauces ── */}
      <div>
        {/* Use by date */}
        <div className="use-by-box">
          <div>USE BY DATE</div>
          <div className="date">{new Date(kitchenPrep.use_by_date).toLocaleDateString('en-AU')}</div>
        </div>

        {/* Rice */}
        <div className="prep-section">
          <div className="prep-section-title title-rice">Rice</div>
          <table><tbody>
            <tr><td>White Rice — 1kg Tray</td><td>{kitchenPrep.rice.white_rice} kg</td></tr>
            <tr><td>Leb Rice — 1kg Tray</td><td>{kitchenPrep.rice.leb_rice} kg</td></tr>
            <tr><td>Jasmine Rice</td><td>{kitchenPrep.rice.jasmine_rice} kg</td></tr>
          </tbody></table>
        </div>

        {/* Chicken */}
        <div className="prep-section">
          <div className="prep-section-title title-chicken">Chicken Order — kg (after stock)</div>
          <table><tbody>
            <tr><td>Chicken Thigh (Tikka)</td><td>{kitchenPrep.chicken.thigh_tikka} kg</td></tr>
            <tr><td>Chicken Thigh (Curry)</td><td>{kitchenPrep.chicken.thigh_curry} kg</td></tr>
            <tr><td>Chicken Breast (Leb)</td><td>{kitchenPrep.chicken.breast_leb} kg</td></tr>
            <tr><td>Breast Sliced 140g portion</td><td>{kitchenPrep.chicken.breast_sliced} kg</td></tr>
          </tbody></table>
        </div>

        {/* Sauces */}
        <div className="prep-section">
          <div className="prep-section-title title-sauces">Sauces Cooking</div>
          <table><tbody>
            <tr><td>1. Napoletane Sauce — Tomato</td><td>{kitchenPrep.sauces.napoletane} L</td></tr>
            <tr><td>2. Bechamel — Milk</td><td>{kitchenPrep.sauces.bechamel} L</td></tr>
            <tr><td>3. Tikka Sauce — Tomato</td><td>{kitchenPrep.sauces.tikka} L</td></tr>
            <tr><td>4. Pesto Pasta — Pesto</td><td>{kitchenPrep.sauces.pesto} L</td></tr>
          </tbody></table>
        </div>
      </div>

      {/* ── COLUMN 2: Cooking Time, Pasta, Beef Mince, Chicken Thigh Mince ── */}
      <div>
        {/* Cooking Time - fixed */}
        <div className="prep-section">
          <div className="prep-section-title title-cooking">Cooking Time</div>
          <table><tbody>
            <tr><td>Tandoori Chicken</td><td>230°C — 15-16 mins</td></tr>
            <tr><td>Grilled Chicken</td><td>290°C 10% Combi — 12 mins</td></tr>
            <tr><td>Leb Chicken</td><td>180°C 70% Combi — 15 mins</td></tr>
          </tbody></table>
        </div>

        {/* Pasta */}
        <div className="prep-section">
          <div className="prep-section-title title-pasta">Pasta 1 pack = 5.5 portions</div>
          <table><tbody>
            <tr><td>Penne</td><td>{kitchenPrep.pasta.penne} Pac</td></tr>
            <tr><td>Casarecce</td><td>{kitchenPrep.pasta.casarecce} Pac</td></tr>
            <tr className="row-highlight"><td>Pea Risotto</td><td>{kitchenPrep.pasta.pea_risotto} kg</td></tr>
            <tr><td>Spaghetti</td><td>{kitchenPrep.pasta.spaghetti} kg</td></tr>
          </tbody></table>
        </div>

        {/* Beef Mince */}
        <div className="prep-section">
          <div className="prep-section-title title-beef">Beef Mince — Cooking</div>
          <table><tbody>
            <tr><td>5. Bolognese</td><td>{kitchenPrep.beef_mince.bolognese.toFixed(1)} kg</td></tr>
            <tr><td>6. Chili Con Carne</td><td>{kitchenPrep.beef_mince.chili} kg</td></tr>
            <tr><td>7. Beef Leb Rice</td><td>{kitchenPrep.beef_mince.leb_rice} kg</td></tr>
            <tr className="total-row"><td>Total Mince</td><td>{kitchenPrep.beef_mince.total.toFixed(1)} kg</td></tr>
          </tbody></table>
        </div>

        {/* Chicken Thigh Mince */}
        <div className="prep-section">
          <div className="prep-section-title title-chicken-mince">Chicken Thigh Mince — Cooking</div>
          <table><tbody>
            <tr><td>11. Chicken Holy Basil</td><td>{kitchenPrep.chicken.thigh_mince} kg</td></tr>
          </tbody></table>
        </div>
      </div>

      {/* ── COLUMN 3: Portioning Sizes ── */}
      <div>
        <div className="prep-section">
          <div className="prep-section-title title-portioning">Portioning Sizes</div>
          <table><tbody>
            <tr><td><strong>Chili Con Carne</strong></td><td>140g rice + 220g chili + sour cream + cheese</td></tr>
            <tr><td><strong>Tikka</strong></td><td>140g rice + 100-110g chicken + curry (total 390g)</td></tr>
            <tr><td><strong>Penne</strong></td><td>2k pasta + 0.5 kilo sauce (200g pasta 180g sauce total 380)</td></tr>
            <tr><td><strong>Leb Rice</strong></td><td>250g rice 100-110g chicken + nuts total 360g</td></tr>
            <tr><td><strong>Pesto 260g + chix</strong></td><td>2 kilos pesto + 2.5 kilos cream + 1 kilo spinach + 50g salt (60)</td></tr>
            <tr><td><strong>Pea Spin. Risotto</strong></td><td>280g risotto + chicken</td></tr>
            <tr><td><strong>Massaman Beef</strong></td><td>140g rice + 3 pcs beef + potato (total 400g)</td></tr>
          </tbody></table>
        </div>
      </div>

      {/* ── COLUMN 4: Pasta/Rice and Protein ── */}
      <div>
        <div className="prep-section">
          <div className="prep-section-title title-pasta-rice">Pasta/Rice — Protein</div>
          <table><tbody>
            <tr><td>140g</td><td>220g</td><td>SGL Tray</td></tr>
            <tr><td>140g</td><td>100g</td><td>SPT Tray</td></tr>
            <tr><td>200g</td><td>180g</td><td></td></tr>
            <tr><td>250g</td><td>100g</td><td></td></tr>
            <tr><td>260g</td><td>100g</td><td></td></tr>
            <tr><td>290g</td><td>100g</td><td></td></tr>
            <tr><td>140g</td><td>270g</td><td></td></tr>
          </tbody></table>
        </div>
      </div>

    </div>
  </div>
)}
        </>
      )}
      {/* ── Invoice modal ── */}
      {invoiceModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '10px', padding: '32px',
            width: '380px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ margin: '0 0 4px', color: '#2c3e50' }}>Generate Invoice</h3>
            <p style={{ margin: '0 0 24px', color: '#7f8c8d', fontSize: '14px' }}>
              {invoiceModal.customer.name}
            </p>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '10px' }}>
                Invoice date:
              </div>
              {[[-2, 'Saturday'], [-1, 'Sunday'], [0, 'Monday'], [1, 'Tuesday']].map(([offset, weekday]) => {
                const dateStr = addDays(invoiceModal.deliveryDate, offset);
                const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
                return (
                  <label key={offset} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 14px', marginBottom: '6px', cursor: 'pointer',
                    backgroundColor: selectedInvoiceDayOffset === offset ? '#eaf4fb' : '#f8f9fa',
                    border: `2px solid ${selectedInvoiceDayOffset === offset ? '#2c3e50' : '#dee2e6'}`,
                    borderRadius: '6px', fontSize: '14px',
                  }}>
                    <input
                      type="radio"
                      name="invoice_day"
                      value={offset}
                      checked={selectedInvoiceDayOffset === offset}
                      onChange={() => setSelectedInvoiceDayOffset(offset)}
                    />
                    <span>{weekday} — <strong>{label}</strong></span>
                  </label>
                );
              })}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '10px' }}>
                Due date:
              </div>
              {[4, 5, 15].map(days => {
                const dateStr = addDays(invoiceModal.deliveryDate, selectedInvoiceDayOffset + days);
                const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
                return (
                  <label key={days} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', marginBottom: '6px', cursor: 'pointer',
                    backgroundColor: selectedDueDays === days ? '#eaf4fb' : '#f8f9fa',
                    border: `2px solid ${selectedDueDays === days ? '#2c3e50' : '#dee2e6'}`,
                    borderRadius: '6px', fontSize: '14px',
                  }}>
                    <input
                      type="radio"
                      name="due_days"
                      value={days}
                      checked={selectedDueDays === days}
                      onChange={() => setSelectedDueDays(days)}
                    />
                    <span>+{days} days — <strong>{label}</strong></span>
                  </label>
                );
              })}
            </div>

            {invoiceError && (
              <div style={{ color: '#e74c3c', fontSize: '13px', marginBottom: '14px', padding: '8px', backgroundColor: '#fdf2f2', borderRadius: '4px' }}>
                {invoiceError}
              </div>
            )}
            {invoiceSuccess && (
              <div style={{ color: '#27ae60', fontSize: '13px', marginBottom: '14px', padding: '8px', backgroundColor: '#f0faf4', borderRadius: '4px' }}>
                {invoiceSuccess}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setInvoiceModal(null)}
                style={{
                  padding: '8px 18px', backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateInvoice}
                disabled={invoiceLoading || !!invoiceSuccess}
                style={{
                  padding: '8px 18px', backgroundColor: '#2c3e50', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: invoiceLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontWeight: 'bold',
                }}
              >
                {invoiceLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}