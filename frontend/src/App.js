import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import InvoicesPage from './pages/InvoicesPage';
import IndexPage from './pages/IndexPage';
import CalculatorPage from './pages/CalculatorPage';
import SettingsPage from './pages/SettingsPage';
import InventoryPage from './pages/InventoryPage';
import Layout from './components/Layout';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  return token ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes with sidebar layout */}
        <Route path="/" element={
          <PrivateRoute>
            <Layout>
              <IndexPage />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/invoices" element={
          <PrivateRoute>
            <Layout>
              <InvoicesPage />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/calculator" element={
          <PrivateRoute>
            <Layout>
              <CalculatorPage />
            </Layout>
          </PrivateRoute>
        } />

        <Route path="/settings" element={
          <PrivateRoute>
            <Layout>
              <SettingsPage />
            </Layout>
          </PrivateRoute>
        } />

        <Route path="/inventory" element={
          <PrivateRoute>
            <Layout>
              <InventoryPage />
            </Layout>
          </PrivateRoute>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}