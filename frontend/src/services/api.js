import axios from 'axios';

// Base URL for our Django backend
const BASE_URL = 'https://alpha-tracking.onrender.com/api';

// Create an axios instance with the base URL
const api = axios.create({
  baseURL: BASE_URL,
});

// Automatically attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth calls
export const loginUser = (email, password) =>
  api.post('/auth/login/', { email, password });

export const registerUser = (email, full_name, password) =>
  api.post('/auth/register/', { email, full_name, password });

// Invoice calls
export const getInvoices = () => api.get('/invoices/');

// Update invoice manual status and comment
export const updateInvoice = (id, data) =>
  api.patch(`/invoices/${id}/`, data);

// Create a manual invoice
export const createInvoice = (data) =>
  api.post('/invoices/create/', data);
// Delete an invoice
export const deleteInvoice = (id) =>
  api.delete(`/invoices/${id}/delete/`);
// Sync invoices from Zoho
export const syncInvoices = () => api.get('/zoho/invoices/');

// Calculator API calls
export const getMenuItems = () => api.get('/menu-items/');
export const getCustomers = () => api.get('/customers/');
export const createDeliveryOrder = (data) => api.post('/delivery/', data);
export const getDeliveryOrder = (date) => api.get(`/delivery/${date}/`);
export const updateDeliveryItem = (orderId, data) => api.patch(`/delivery/${orderId}/item/`, data);
export const saveDeliveryOrder = (orderId, data) => api.post(`/delivery/${orderId}/save/`, data);
export const getKitchenPrep = (orderId) => api.get(`/delivery/${orderId}/kitchen-prep/`);

// Customer settings
export const updateCustomerRate = (id, rate) => api.patch(`/customers/${id}/`, { rate });

// Invoice generation
export const generateInvoice = (orderId, customerId, invoiceDate, dueDate) =>
  api.post(`/delivery/${orderId}/generate-invoice/${customerId}/`, { invoice_date: invoiceDate, due_date: dueDate });

export const deleteGeneratedInvoice = (orderId, customerId) =>
  api.delete(`/delivery/${orderId}/generate-invoice/${customerId}/`);

// Inventory
export const getSleeveInventory = () => api.get('/inventory/');
export const saveSleeveInventory = (data) => api.post('/inventory/', data);
export const resetSleeveInventory = () => api.post('/inventory/reset/');
export const markDelivered = (orderId) => api.post(`/delivery/${orderId}/deliver/`);

export default api;