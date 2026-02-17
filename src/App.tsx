import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
// import Holdings from './pages/Holdings';
// import { AssetType } from './types';
import AllowedEmails from './pages/Admin/AllowedEmails';
import Stocks from './pages/Admin/Stocks';
import Etfs from './pages/Admin/Etfs';
import Bonds from './pages/Admin/Bonds';
import MutualFunds from './pages/Admin/MutualFunds';
import Industries from './pages/Admin/Industries';
// import Maintenance from './pages/Admin/Maintenance';
import AuditLogs from './pages/Admin/AuditLogs';
import Strategies from './pages/Admin/Strategies';
import ListStocks from './pages/ListStocks';
import HoldingAccounts from './pages/Holdings/HoldingAccounts';
import Scheduler from './pages/Admin/Schedular';
import ListEtfs from './pages/ListEtfs';
import UploadHoldings from './pages/Holdings/UploadHoldings';
import ListHoldings from './pages/Holdings/ListHoldings';
import StockHistory from './pages/StockHistory';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const theme = createTheme({
  typography: {
    fontSize: 13, // Sets the base font size for the entire theme, affecting body text
    // You can also target specific typography variants like body1 or body2:
    // body1: {
    //   fontSize: '1.1rem', // Custom font size for body1 variant
    // },
  },
  palette: {
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#764ba2',
    },
    text: {
      primary: '#000', // Your default primary text color
      secondary: '#aaaaaa', // Your default secondary text color
      disabled: '#666666', // Your default disabled text color
    },
  },
  components: {
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 36, // Adjust value as needed
        },
      },
    },
  },
});

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/" replace />;
};

interface ViewerRouteProps {
  children: React.ReactElement;
}

const ViewerRoute: React.FC<ViewerRouteProps> = ({ children }) => {
  const { isViewer, isAdmin, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  // Viewer or Admin can access
  return (isViewer || isAdmin) ? children : <Navigate to="/recommendations" replace />;
};

interface AdminRouteProps {
  children: React.ReactElement;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return isAdmin ? children : <Navigate to="/recommendations" replace />;
};

const App: React.FC = () => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route
                path="/list-stocks"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ListStocks />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/list-stocks/:symbol/history"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <StockHistory />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/list-etfs"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ListEtfs />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ViewerRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ViewerRoute>
                }
              />
              <Route
                path="/holding-accounts"
                element={
                  <ViewerRoute>
                    <Layout>
                      <HoldingAccounts />
                    </Layout>
                  </ViewerRoute>
                }
              />
              <Route
                path="/upload-holdings/:accountId"
                element={
                  <ViewerRoute>
                    <Layout>
                      <UploadHoldings />
                    </Layout>
                  </ViewerRoute>
                }
              />
              <Route
                path="/list-holdings/:accountId"
                element={
                  <ViewerRoute>
                    <Layout>
                      <ListHoldings />
                    </Layout>
                  </ViewerRoute>
                }
              />
              {/* <Route
                path="/holding/stocks"
                element={
                  <ViewerRoute>
                    <Layout>
                      <Holdings assetType={AssetType.STOCK} title="Stock Holdings" />
                    </Layout>
                  </ViewerRoute>
                }
              />
              <Route
                path="/holding/etfs"
                element={
                  <ViewerRoute>
                    <Layout>
                      <Holdings assetType={AssetType.ETF} title="ETF Holdings" />
                    </Layout>
                  </ViewerRoute>
                }
              />
              <Route
                path="/holding/bonds"
                element={
                  <ViewerRoute>
                    <Layout>
                      <Holdings assetType={AssetType.BOND} title="Bond Holdings" />
                    </Layout>
                  </ViewerRoute>
                }
              />
              <Route
                path="/holding/mutual-funds"
                element={
                  <ViewerRoute>
                    <Layout>
                      <Holdings assetType={AssetType.MUTUAL_FUND} title="Mutual Fund Holdings" />
                    </Layout>
                  </ViewerRoute>
                }
              /> */}
              {/* Admin Routes */}
              <Route
                path="/admin/allowed-emails"
                element={
                  <AdminRoute>
                    <Layout>
                      <AllowedEmails />
                    </Layout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/industries"
                element={
                  <AdminRoute>
                    <Layout>
                      <Industries />
                    </Layout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/stocks"
                element={
                  <AdminRoute>
                    <Layout>
                      <Stocks />
                    </Layout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/etfs"
                element={
                  <AdminRoute>
                    <Layout>
                      <Etfs />
                    </Layout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/bonds"
                element={
                  <AdminRoute>
                    <Layout>
                      <Bonds />
                    </Layout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/mutual-funds"
                element={
                  <AdminRoute>
                    <Layout>
                      <MutualFunds />
                    </Layout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/strategies"
                element={
                  <AdminRoute>
                    <Layout>
                      <Strategies />
                    </Layout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/scheduler"
                element={
                  <AdminRoute>
                    <Layout>
                      <Scheduler />
                    </Layout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/audit-logs"
                element={
                  <AdminRoute>
                    <Layout>
                      <AuditLogs />
                    </Layout>
                  </AdminRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
};

export default App;