import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Configuracoes from '../../pages/configuracoes/configuracoes';
import { ConfigProvider } from '../../contexts/ConfigContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { AuthProvider } from '../../contexts/AuthContext';
import api from '../../services/api';

// Mock api
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock matchMedia
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('Página de Configurações', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 1, nome: 'Admin', tipo: 'admin' }));
    localStorage.setItem('token', 'fake-jwt-token');
    api.get.mockImplementation((url) => {
      if (url === '/configuracoes') {
        return Promise.resolve({
          data: {
            permiteEstoqueNegativo: false,
            dadosEmpresa: {
              cadastro: { razaoSocial: 'Empresa Teste', nomeFantasia: 'Teste', cnpj: '11.222.333/0001-81', inscricaoEstadual: '123' },
              endereco: { cep: '70000-000', logradouro: 'Rua 1', numero: '10', complemento: '', bairro: 'Centro', cidade: 'Brasília', estado: 'DF', pais: 'Brasil' },
            },
            formasPagamento: [
              { value: 'dinheiro', label: 'Dinheiro', shortcut: 'F1' }
            ],
          }
        });
      }
      if (url === '/usuarios') {
        return Promise.resolve({
          data: [
            { idUsuario: 1, nome: 'Admin Master', email: 'admin@salestrack.com', tipo: 'admin' },
            { idUsuario: 2, nome: 'Vendedor João', email: 'joao@salestrack.com', tipo: 'vendedor' }
          ]
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('deve renderizar a página de configurações sem estourar erro', () => {
    render(
      <MemoryRouter initialEntries={['/configuracoes']}>
        <NotificationProvider>
          <ConfigProvider>
            <AuthProvider>
              <Configuracoes />
            </AuthProvider>
          </ConfigProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerenciar Usuários/i })).toBeInTheDocument();
  });

  it('não deve quebrar a tela quando dadosEmpresa vier do banco sem o objeto endereco', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/configuracoes') {
        return Promise.resolve({
          data: {
            permiteEstoqueNegativo: false,
            // Exatamente como está no seed do database_setup.sql!
            dadosEmpresa: {
              cadastro: {
                razaoSocial: 'SalesTrack Comércio',
                nomeFantasia: 'SalesTrack',
                cnpj: '12.345.678/0001-90',
              },
            },
            formasPagamento: null,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter initialEntries={['/configuracoes']}>
        <NotificationProvider>
          <ConfigProvider>
            <AuthProvider>
              <Configuracoes />
            </AuthProvider>
          </ConfigProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    // Espera a sincronização assíncrona atualizar o estado com os dados do servidor
    await waitFor(() => {
      expect(screen.getByDisplayValue('SalesTrack Comércio')).toBeInTheDocument();
    });
  });

  it('deve abrir o modal de usuários ao clicar no botão Gerenciar Usuários', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/configuracoes') {
        return Promise.resolve({
          data: {
            permiteEstoqueNegativo: false,
            dadosEmpresa: {
              cadastro: { razaoSocial: 'SalesTrack', nomeFantasia: 'SalesTrack', cnpj: '12.345.678/0001-90' },
            },
            formasPagamento: null,
          },
        });
      }
      if (url === '/usuarios') {
        return Promise.resolve({
          data: [
            { idUsuario: 1, nome: 'Admin Master', email: 'admin@salestrack.com', tipo: 'admin' },
            { idUsuario: 2, nome: 'Vendedor João', email: 'joao@salestrack.com', tipo: 'vendedor' },
          ],
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter initialEntries={['/configuracoes']}>
        <NotificationProvider>
          <ConfigProvider>
            <AuthProvider>
              <Configuracoes />
            </AuthProvider>
          </ConfigProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    const btn = screen.getByRole('button', { name: /Gerenciar Usuários/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('Admin Master')).toBeInTheDocument();
      expect(screen.getByText('Vendedor João')).toBeInTheDocument();
    });
  });
});

