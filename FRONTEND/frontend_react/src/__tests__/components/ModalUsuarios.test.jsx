import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ModalUsuarios from '../../components/ModalUsuarios/ModalUsuarios';

describe('Componente ModalUsuarios', () => {
  const usuariosMock = [
    { idUsuario: 1, nome: 'Admin Master', email: 'admin@salestrack.com', tipo: 'admin' },
    { idUsuario: 2, nome: 'Vendedor João', email: 'joao@salestrack.com', tipo: 'vendedor' },
    { idUsuario: 3, nome: 'Super Maria', email: 'maria@salestrack.com', tipo: 'supervisor' }
  ];

  it('não deve renderizar quando isOpen for false', () => {
    render(<ModalUsuarios isOpen={false} onClose={() => {}} usuarios={[]} loading={false} />);
    expect(screen.queryByText('Usuários')).not.toBeInTheDocument();
  });

  it('deve exibir mensagem de carregando quando loading for true', () => {
    render(<ModalUsuarios isOpen={true} onClose={() => {}} usuarios={[]} loading={true} />);
    expect(screen.getByText('Carregando usuários…')).toBeInTheDocument();
  });

  it('deve exibir mensagem de nenhum usuário quando lista for vazia', () => {
    render(<ModalUsuarios isOpen={true} onClose={() => {}} usuarios={[]} loading={false} />);
    expect(screen.getByText('Nenhum usuário encontrado.')).toBeInTheDocument();
  });

  it('deve renderizar a lista de usuários com badges de perfis', () => {
    render(<ModalUsuarios isOpen={true} onClose={() => {}} usuarios={usuariosMock} loading={false} />);
    expect(screen.getByText('Admin Master')).toBeInTheDocument();
    expect(screen.getByText(/admin@salestrack.com/)).toBeInTheDocument();
    expect(screen.getByText('Vendedor João')).toBeInTheDocument();
    expect(screen.getByText('Super Maria')).toBeInTheDocument();

    const adminBadge = screen.getByText('admin');
    expect(adminBadge).toHaveClass('badge', 'admin');
  });

  it('deve chamar onClose ao clicar no botão fechar do modal', () => {
    const handleClose = vi.fn();
    const { container } = render(<ModalUsuarios isOpen={true} onClose={handleClose} usuarios={usuariosMock} loading={false} />);

    const closeBtn = container.querySelector('.modal-close');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
