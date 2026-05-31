import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import Dashboard from "../../assets/sidebar/dashboard.svg";
import Vendas from "../../assets/sidebar/vendas.svg";
import Historico from "../../assets/sidebar/historico.svg";
import Produtos from "../../assets/sidebar/produtos.svg";
import Clientes from "../../assets/sidebar/clientes.svg";
import Relatorios from "../../assets/sidebar/relatorios.svg";
import ConfigIcon from "../../assets/sidebar/configuracoes.svg";
import SalesTrack from "../../assets/salesTrack.svg";
import './style.css';

function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const [itemActive, setItemActive] = useState(location.pathname);

    const handleItemClick = (path) => {
        setItemActive(path);
        navigate(path);
    };

    async function handleLogout() {
        await logout();
        navigate('/login');
    }

    const tipoLabel = user?.tipo === 'admin' ? 'Administrador' : 'Vendedor';

    return (
        <div className="body-sidebar">
            <div className="box-vertical">
                <div className="header-dashboard">
                    <div className="logo">
                        <img src={SalesTrack} alt="" className="salesTrack-img" />
                        <h1>SalesTrack</h1>
                    </div>
                    <hr />
                </div>
                <div className="sidebar-menu">
                    <div className={`menu-select ${itemActive === '/dashboard' ? 'ativo' : ''}`} onClick={() => handleItemClick('/dashboard')}>
                        <img src={Dashboard} alt="" />
                        <span>Dashboard</span>
                    </div>
                    <div className={`menu-select ${itemActive === '/vendas' ? 'ativo' : ''}`} onClick={() => handleItemClick('/vendas')}>
                        <img src={Vendas} alt="" />
                        <span>Nova Venda</span>
                    </div>
                    <div className={`menu-select ${itemActive === '/historico' ? 'ativo' : ''}`} onClick={() => handleItemClick('/historico')}>
                        <img src={Historico} alt="" />
                        <span>Histórico</span>
                    </div>
                    <div className={`menu-select ${itemActive === '/produtos' ? 'ativo' : ''}`} onClick={() => handleItemClick('/produtos')}>
                        <img src={Produtos} alt="" />
                        <span>Produtos</span>
                    </div>
                    <div className={`menu-select ${itemActive === '/clientes' ? 'ativo' : ''}`} onClick={() => handleItemClick('/clientes')}>
                        <img src={Clientes} alt="" />
                        <span>Clientes</span>
                    </div>
                    <div className={`menu-select ${itemActive === '/relatorios' ? 'ativo' : ''}`} onClick={() => handleItemClick('/relatorios')}>
                        <img src={Relatorios} alt="" />
                        <span>Relatórios</span>
                    </div>
                    <div className={`menu-select ${itemActive === '/configuracoes' ? 'ativo' : ''}`} onClick={() => handleItemClick('/configuracoes')}>
                        <img src={ConfigIcon} alt="" />
                        <span>Configurações</span>
                    </div>
                </div>
                <div className="footer-sidebar">
                    <div className="footer-user-info">
                        <div className="footer-avatar">
                            {(user?.nome || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="footer-user-text">
                            <span className="footer-user-name">{user?.nome || 'Usuário'}</span>
                            <span className="footer-user-role">{tipoLabel}</span>
                        </div>
                    </div>
                    <button className="footer-logout-btn" onClick={handleLogout} title="Sair">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;