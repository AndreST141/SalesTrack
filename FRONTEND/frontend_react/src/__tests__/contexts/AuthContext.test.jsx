import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Mock api
vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// Mock ConfigContext
vi.mock('../../contexts/ConfigContext', () => ({
  ConfigProvider: ({ children }) => children,
  useConfig: () => ({
    sincronizarConfiguracoesDoServidor: vi.fn(),
  }),
}));

import api from '../../services/api';

function TestConsumer() {
  const { signed, user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="signed">{signed ? 'logado' : 'deslogado'}</span>
      <span data-testid="user">{user ? user.nome : 'nenhum'}</span>
      <button onClick={() => login('admin@salestrack.com', 'admin123')}>Entrar</button>
      <button onClick={logout}>Sair</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('inicia no estado deslogado quando não há token no storage', () => {
    renderWithProvider();
    expect(screen.getByTestId('signed').textContent).toBe('deslogado');
    expect(screen.getByTestId('user').textContent).toBe('nenhum');
  });

  it('inicia no estado logado quando há token e usuário no storage', () => {
    localStorage.setItem('token', 'existing-jwt-token');
    localStorage.setItem('user', JSON.stringify({ nome: 'Felipe Maximo' }));

    renderWithProvider();
    expect(screen.getByTestId('signed').textContent).toBe('logado');
    expect(screen.getByTestId('user').textContent).toBe('Felipe Maximo');
  });

  it('login atualiza estado e persiste dados no localStorage', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce({
      data: {
        token: 'new-jwt-token-xyz',
        user: { id: 1, nome: 'Rafael Carvalho', email: 'rafael@salestrack.com', tipo: 'admin' },
      },
    });

    renderWithProvider();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('new-jwt-token-xyz');
      expect(screen.getByTestId('signed').textContent).toBe('logado');
      expect(screen.getByTestId('user').textContent).toBe('Rafael Carvalho');
    });
  });

  it('logout limpa o estado e o localStorage', async () => {
    const user = userEvent.setup();
    localStorage.setItem('token', 'valid-token');
    localStorage.setItem('user', JSON.stringify({ nome: 'Bruno Henrique' }));
    api.post.mockResolvedValueOnce({ data: { message: 'Logout realizado' } });

    renderWithProvider();
    expect(screen.getByTestId('signed').textContent).toBe('logado');

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(screen.getByTestId('signed').textContent).toBe('deslogado');
      expect(screen.getByTestId('user').textContent).toBe('nenhum');
    });
  });

  it('useAuth lança exceção quando utilizado fora do AuthProvider', () => {
    function InvalidConsumer() {
      useAuth();
      return null;
    }
    expect(() => render(<InvalidConsumer />)).toThrow('useAuth deve ser usado dentro de um AuthProvider');
  });
});
