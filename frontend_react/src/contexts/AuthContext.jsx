import { createContext, useContext, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || null;
  });

  const signed = !!token;

  async function login(email, senha) {
    const response = await api.post('/login', { email, senha });
    const { token: newToken, user: userData } = response.data;

    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));

    setToken(newToken);
    setUser(userData);

    return userData;
  }

  async function logout() {
    try {
      await api.post('/logout');
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ signed, user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
