import React, { createContext, useContext, useState, useCallback } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info', 
    vertical: 'top',
    horizontal: 'center',
  });

  const showNotification = useCallback((message, severity = 'info', vertical = 'top', horizontal = 'center') => {
    setNotification({
      open: true,
      message,
      severity,
      vertical,
      horizontal,
    });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <Snackbar
        anchorOrigin={{ 
            vertical: notification.vertical, 
            horizontal: notification.horizontal 
        }}
        sx={notification.vertical === 'top' ? { top: '10px !important' } : { bottom: '10px !important' }}
        open={notification.open}
        autoHideDuration={4000}
        onClose={hideNotification}
        key={notification.vertical + notification.horizontal + notification.message}
        ContentProps={{
          sx: { borderRadius: '8px' }
        }}
      >
        <Alert 
          onClose={hideNotification} 
          severity={notification.severity} 
          variant="filled"
          sx={{ width: '100%', borderRadius: '8px' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification deve ser usado dentro de um NotificationProvider');
  }
  return context;
}
