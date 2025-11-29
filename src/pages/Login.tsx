import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Completely prevent any navigation or refresh
  useEffect(() => {
    // Prevent back/forward navigation during error state
    const preventNavigation = (e: PopStateEvent) => {
      if (error || isProcessing) {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', preventNavigation);

    return () => {
      window.removeEventListener('popstate', preventNavigation);
    };
  }, [error, isProcessing]);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse): Promise<void> => {
    // Prevent multiple simultaneous attempts
    if (isProcessing || loading) {
      return;
    }

    if (!credentialResponse.credential) {
      setError('No credential received from Google');
      return;
    }

    // Set flags to prevent any interruption
    setIsProcessing(true);
    setLoading(true);
    setError(''); // Clear any previous errors

    try {
      // Call login API
      await login(credentialResponse.credential);
      
      // Only navigate on successful login
      setIsProcessing(false);
      navigate('/list-stocks');
    } catch (err: any) {
      console.error('Login error:', err);
      
      // IMPORTANT: Keep processing flag true to prevent refresh
      setIsProcessing(false);
      setLoading(false);
      
      // Handle specific error cases with detailed messages
      if (err.response?.status === 403) {
        setError('Access Denied: Your email address is not authorized to access this application. Please contact the system administrator to request access.');
      } else if (err.response?.status === 401) {
        setError('Authentication Failed: Unable to verify your Google credentials. Please try signing in again.');
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.message) {
        setError(`Login Error: ${err.message}`);
      } else {
        setError('Login Failed: An unexpected error occurred. Please try again or contact support if the problem persists.');
      }
      
      // Force the error to stay visible (prevent any auto-dismiss)
      setTimeout(() => {
        // Error will remain until user manually closes it
      }, 100);
    }
  };

  const handleGoogleError = (): void => {
    setError('Google Sign-In Failed: The sign-in process was cancelled or encountered an error. Please try again.');
    setLoading(false);
    setIsProcessing(false);
  };

  const handleDismissError = () => {
    setError('');
    setIsProcessing(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={6}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 2,
          }}
        >
          <Typography
            component="h3"
            variant="h4"
            gutterBottom
            sx={{ fontWeight: 700, color: '#667eea' }}
          >
            Leowit Portfolio
          </Typography>
          
          <Typography
            variant="h6"
            color="text.secondary"
            gutterBottom
            sx={{ mb: 4 }}
          >
            Welcome to Leowit Portfolio. Please sign in to continue.
          </Typography>

          {error && (
            <Alert 
              severity="error" 
              sx={{ width: '100%', mb: 3 }}
              onClose={handleDismissError}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                {error.includes(':') ? error.split(':')[0] : 'Error'}
              </Typography>
              <Typography variant="body2">
                {error.includes(':') ? error.split(':').slice(1).join(':').trim() : error}
              </Typography>
            </Alert>
          )}

          {loading ? (
            <Box sx={{ mt: 2, mb: 2, textAlign: 'center', py: 3 }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                Authenticating your account...
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Please wait, do not refresh the page
              </Typography>
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap={false}
                theme="filled_blue"
                size="large"
                text="signin_with"
                shape="rectangular"
                auto_select={false}
                cancel_on_tap_outside={false}
                ux_mode="popup"
                context="signin"
                itp_support={false}
              />
            </Box>
          )}

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 4, textAlign: 'center', maxWidth: '400px' }}
          >
            Sign in with your authorized Google account to access your portfolio
          </Typography>
          
          {error && (
            <Alert 
              severity="info" 
              sx={{ mt: 3, width: '100%' }}
            >
              <Typography variant="caption">
                <strong>Need access?</strong> Contact your administrator to add your email to the authorized users list.
              </Typography>
            </Alert>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;