import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import './style.css';

function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [campoFocado, setCampoFocado] = useState(null);

  const { login } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email.trim() || !senha.trim()) {
      showNotification('Preencha todos os campos obrigatórios!', 'warning', 'top', 'center');
      return;
    }

    setLoading(true);

    try {
      await login(email, senha);
      navigate('/dashboard');
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        'Erro de conexão. Verifique se o backend está rodando.';

      showNotification(msg, 'error', 'top', 'center');
    } finally {
      setLoading(false);
    }
  }

  const handleForgotPassword = () => {
    showNotification(
      'Funcionalidade de recuperação de senha em desenvolvimento.',
      'info',
      'top',
      'center'
    );
  };

  const handleRequestAccess = () => {
    showNotification(
      'Entre em contato com o administrador para solicitar seu acesso.',
      'warning',
      'bottom',
      'center'
    );
  };

  return (
    <div className="login-page">
      <div className="login-visual">
        <svg viewBox="0 0 560 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="visualGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1B7AF5" />
              <stop offset="1" stopColor="#0B2447" />
            </linearGradient>
          </defs>
          <rect width="560" height="800" fill="#0B2447" />
          <path
            d="M0,0 H560 V300 C480,250 430,360 350,330 C260,295 250,210 160,235 C90,255 70,200 0,225 Z"
            fill="url(#visualGradient)"
          />
          <path
            d="M0,800 H560 V520 C470,560 430,470 340,500 C250,530 240,600 150,575 C80,555 60,610 0,585 Z"
            fill="#AFC2DC"
            opacity="0.55"
          />
        </svg>

        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <span style={{ height: 10 }}></span>
            <span style={{ height: 18 }}></span>
            <span style={{ height: 14 }}></span>
            <span style={{ height: 26 }}></span>
          </div>
          <h1>SalesTrack</h1>
          <p>Gestão de vendas</p>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-panel-inner">
          <div className="brand-mobile">
            <div className="brand-mark" aria-hidden="true">
              <span style={{ height: 8 }}></span>
              <span style={{ height: 14 }}></span>
              <span style={{ height: 11 }}></span>
              <span style={{ height: 20 }}></span>
            </div>
            <span>SalesTrack</span>
          </div>

          <p className="eyebrow">Bem-vindo de volta</p>
          <h2 className="titulo-login">
            Acesse sua conta <em>SalesTrack</em>
          </h2>
          <p className="subtitulo-login">
            Entre para acompanhar suas <b>vendas</b>, clientes e relatórios em um só lugar.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="campo">
              <label htmlFor="email">Email</label>
              <div className={`campo-input ${campoFocado === 'email' ? 'focado' : ''}`}>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setCampoFocado('email')}
                  onBlur={() => setCampoFocado(null)}
                  placeholder="seu@email.com"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="campo">
              <label htmlFor="senha">Senha</label>
              <div className={`campo-input ${campoFocado === 'senha' ? 'focado' : ''}`}>
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onFocus={() => setCampoFocado('senha')}
                  onBlur={() => setCampoFocado(null)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-senha"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={-1}
                >
                  {mostrarSenha ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.6 18.6 0 0 1 4.22-5.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="linha-esqueceu">
                <span onClick={handleForgotPassword}>Esqueceu a senha?</span>
              </div>
            </div>

            <button type="submit" className="botao-entrar" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="footer-login">
            Ainda não tem acesso?{' '}
            <span onClick={handleRequestAccess}>Solicite aqui</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
