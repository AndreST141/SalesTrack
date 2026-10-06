import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// adminOnly   → apenas admin e tecnico (acesso total)
// noVendedor  → bloqueia vendedor (redireciona para /vendas)
// tecnicoOnly → apenas o usuário técnico (nem admin acessa)
function PrivateRoute({ children, adminOnly = false, noVendedor = false, tecnicoOnly = false }) {
  const { signed, user } = useAuth();

  if (!signed) {
    return <Navigate to="/login" replace />;
  }

  if (tecnicoOnly && user?.tipo !== 'tecnico') {
    return <Navigate to="/vendas" replace />;
  }

  if (adminOnly && !['admin', 'tecnico'].includes(user?.tipo)) {
    return <Navigate to="/vendas" replace />;
  }

  if (noVendedor && user?.tipo === 'vendedor') {
    return <Navigate to="/vendas" replace />;
  }

  return children;
}

export default PrivateRoute;
