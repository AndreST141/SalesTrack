import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// adminOnly  → apenas admin e tecnico (acesso total)
// noVendedor → bloqueia vendedor (redireciona para /vendas)
function PrivateRoute({ children, adminOnly = false, noVendedor = false }) {
  const { signed, user } = useAuth();

  if (!signed) {
    return <Navigate to="/login" replace />;
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
