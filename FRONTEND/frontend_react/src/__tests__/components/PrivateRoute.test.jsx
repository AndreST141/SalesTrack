import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PrivateRoute from '../../components/PrivateRoute/PrivateRoute';

const mockAuthState = {
  signed: false,
  user: null,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

function renderWithRouter(routeProps = {}, initialEntry = '/protegido') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/protegido"
          element={
            <PrivateRoute {...routeProps}>
              <div>Conteúdo Protegido</div>
            </PrivateRoute>
          }
        />
        <Route path="/login" element={<div>Página de Login</div>} />
        <Route path="/vendas" element={<div>Página de Vendas</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PrivateRoute', () => {
  it('redireciona para /login quando não está autenticado', () => {
    mockAuthState.signed = false;
    mockAuthState.user = null;

    renderWithRouter();
    expect(screen.getByText('Página de Login')).toBeInTheDocument();
  });

  it('permite acesso a rota protegida quando autenticado', () => {
    mockAuthState.signed = true;
    mockAuthState.user = { tipo: 'vendedor', nome: 'Vendedor 1' };

    renderWithRouter();
    expect(screen.getByText('Conteúdo Protegido')).toBeInTheDocument();
  });

  it('bloqueia vendedor em rota adminOnly redirecionando para /vendas', () => {
    mockAuthState.signed = true;
    mockAuthState.user = { tipo: 'vendedor', nome: 'Vendedor 1' };

    renderWithRouter({ adminOnly: true });
    expect(screen.getByText('Página de Vendas')).toBeInTheDocument();
  });

  it('permite admin em rota adminOnly', () => {
    mockAuthState.signed = true;
    mockAuthState.user = { tipo: 'admin', nome: 'Admin' };

    renderWithRouter({ adminOnly: true });
    expect(screen.getByText('Conteúdo Protegido')).toBeInTheDocument();
  });

  it('bloqueia admin em rota tecnicoOnly redirecionando para /vendas', () => {
    mockAuthState.signed = true;
    mockAuthState.user = { tipo: 'admin', nome: 'Admin' };

    renderWithRouter({ tecnicoOnly: true });
    expect(screen.getByText('Página de Vendas')).toBeInTheDocument();
  });

  it('permite tecnico em rota tecnicoOnly', () => {
    mockAuthState.signed = true;
    mockAuthState.user = { tipo: 'tecnico', nome: 'Técnico Suporte' };

    renderWithRouter({ tecnicoOnly: true });
    expect(screen.getByText('Conteúdo Protegido')).toBeInTheDocument();
  });

  it('bloqueia vendedor quando noVendedor=true', () => {
    mockAuthState.signed = true;
    mockAuthState.user = { tipo: 'vendedor', nome: 'Vendedor' };

    renderWithRouter({ noVendedor: true });
    expect(screen.getByText('Página de Vendas')).toBeInTheDocument();
  });
});
