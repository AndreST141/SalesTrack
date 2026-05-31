import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "../pages/dashboard/dashboard";
import Vendas from "../pages/vendas/vendas";
import Historico from "../pages/historico/historico";
import Produtos from "../pages/produtos/produtos";
import Clientes from "../pages/clientes/clientes";
import Relatorios from "../pages/relatorios/relatorios";
import Configuracoes from "../pages/configuracoes/configuracoes";
import Login from "../pages/login/login";
import PrivateRoute from "../components/PrivateRoute/PrivateRoute";

function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>}/>
                <Route path="/vendas" element={<PrivateRoute><Vendas /></PrivateRoute>} />
                <Route path="/historico" element={<PrivateRoute><Historico /></PrivateRoute>}/>
                <Route path="/produtos" element={<PrivateRoute><Produtos /></PrivateRoute>}/>
                <Route path="/clientes" element={<PrivateRoute><Clientes /></PrivateRoute>}/>
                <Route path="/relatorios" element={<PrivateRoute><Relatorios /></PrivateRoute>}/>
                <Route path="/configuracoes" element={<PrivateRoute><Configuracoes /></PrivateRoute>}/>
            </Routes>
        </BrowserRouter>
    );
}

export default Router;