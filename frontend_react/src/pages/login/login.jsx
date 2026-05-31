import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import './style.css';

function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

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
        "Funcionalidade de recuperação de senha em desenvolvimento.", 
        "info", 
        "top", 
        "center"
    );
  };

  const handleRequestAccess = () => {
    showNotification(
        "Entre em contato com o administrador para solicitar seu acesso.", 
        "warning", 
        "bottom", 
        "center"
    );
  };

  return (
    <div className="body-login">
      <div className="eclipse-decor decor-1"></div>
      <div className="eclipse-decor decor-2"></div>

      <div className="box-login">
        <div className="logo-title">
            <h1>SalesTrack</h1>
            <h2>SISTEMA DE GESTÃO DE VENDAS</h2>
        </div>

        <h2 className="h2-acessar">Acesse sua conta</h2>

        <form onSubmit={handleSubmit} className="form-login" noValidate>
          <div className="linha-flex">
            <div className="campo">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@email.com"
              />
            </div>
            
            <div className="campo">
              <div className="sobre-senha">
                <label>Senha</label>
                <span onClick={handleForgotPassword}>Esqueceu a senha?</span>
              </div>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="button">
            <button type="submit" disabled={loading}>
              {loading ? 'Carregando' : 'Entrar'}
            </button>
          </div>
        </form>
        <div className="login-info">
            <p><strong>Usuários de teste:</strong></p>
            <p>Admin: admin@salestrack.com / admin123</p>
            <p>Vendedor: vendedor@salestrack.com / vendedor123</p>
        </div>
        <div className="footer-box-login">
          <p>Não possui acesso? <span onClick={handleRequestAccess}>Solicite aqui</span></p>
        </div>
      </div>
    </div>
  );
}

export default Login;
