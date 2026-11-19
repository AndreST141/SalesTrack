import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Login from '../../pages/login/login';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();
const mockShowNotification = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock('../../contexts/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock css import
vi.mock('../../pages/login/style.css', () => ({}));

describe('Página de Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza os campos de email, senha e botão de submissão', () => {
    render(<Login />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha', { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('valida campos obrigatórios vazios antes de chamar a API', async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringMatching(/obrigat/i),
      'warning',
      'top',
      'center'
    );
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('executa login com sucesso e redireciona para o dashboard', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({ nome: 'Gestor' });
    render(<Login />);

    await user.type(screen.getByLabelText('Email'), 'admin@salestrack.com');
    await user.type(screen.getByLabelText('Senha', { selector: 'input' }), 'admin123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@salestrack.com', 'admin123');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('exibe alerta de erro quando login falha por credenciais inválidas', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce({
      response: { data: { error: 'E-mail ou senha incorretos.' } },
    });
    render(<Login />);

    await user.type(screen.getByLabelText('Email'), 'errado@salestrack.com');
    await user.type(screen.getByLabelText('Senha', { selector: 'input' }), 'senhaerrada');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith(
        'E-mail ou senha incorretos.',
        'error',
        'top',
        'center'
      );
    });
  });

  it('alterna visualização de texto plano da senha pelo botão de visualização', async () => {
    const user = userEvent.setup();
    render(<Login />);

    const inputSenha = screen.getByLabelText('Senha', { selector: 'input' });
    expect(inputSenha).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByRole('button', { name: /mostrar senha/i });
    await user.click(toggleBtn);
    expect(inputSenha).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /ocultar senha/i }));
    expect(inputSenha).toHaveAttribute('type', 'password');
  });
});
