import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import './style.css';

const ICONS = {
    dashboard: (
        <>
            <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
            <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
            <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
            <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
        </>
    ),
    vendas: (
        <>
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="18" cy="20" r="1.4" />
            <path d="M2.5 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7H6" />
        </>
    ),
    historico: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5l3.5 2" />
        </>
    ),
    produtos: (
        <>
            <path d="M21 7.5l-9-5-9 5 9 5 9-5z" />
            <path d="M3 7.5v8.7l9 5 9-5V7.5" />
            <path d="M12 12.5v8.7" />
        </>
    ),
    clientes: (
        <>
            <circle cx="9.5" cy="8" r="3.3" />
            <path d="M3.5 20v-1.2A4.3 4.3 0 0 1 7.8 14.5h3.4a4.3 4.3 0 0 1 4.3 4.3V20" />
            <path d="M16.2 4.8a3.3 3.3 0 0 1 0 6.4" />
            <path d="M20.5 20v-1.2a4.3 4.3 0 0 0-3-4.1" />
        </>
    ),
    relatorios: (
        <>
            <line x1="5" y1="20" x2="5" y2="11" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="19" y1="20" x2="19" y2="15" />
        </>
    ),
    configuracoes: (
        <>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 13.6a7.8 7.8 0 0 0 0-3.2l2-1.5-2-3.4-2.4 1a7.8 7.8 0 0 0-1.7-1l-.3-2.6h-6l-.3 2.6a7.8 7.8 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 3.2l-2 1.5 2 3.4 2.4-1a7.8 7.8 0 0 0 1.7 1l.3 2.6h6l.3-2.6a7.8 7.8 0 0 0 1.7-1l2.4 1 2-3.4z" />
        </>
    ),
};

function MenuIcon({ name }) {
    return (
        <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[name]}
        </svg>
    );
}

function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const [itemActive, setItemActive] = useState(location.pathname);
    const [expanded, setExpanded] = useState(false);

    const handleItemClick = (path) => {
        setExpanded(false);
        setItemActive(path);
        navigate(path);
    };

    const handleBlurContainer = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setExpanded(false);
        }
    };

    async function handleLogout() {
        await logout();
        navigate('/login');
    }

    const tipoLabel = {
        admin: 'Administrador',
        supervisor: 'Supervisor',
        tecnico: 'Técnico',
    }[user?.tipo] || 'Vendedor';

    // TECNICO: usa nome fixo para evitar problema de encoding vindo do banco
    const displayNome = user?.tipo === 'tecnico'
        ? 'Técnico'
        : (user?.nome || 'Usuário');

    const isAdminOrTecnico = ['admin', 'tecnico'].includes(user?.tipo);
    const isVendedor = user?.tipo === 'vendedor';

    return (
        <div className={`body-sidebar ${expanded ? 'is-expanded' : ''}`}>
            <div
                className={`box-vertical ${expanded ? 'is-expanded' : ''}`}
                onMouseEnter={() => setExpanded(true)}
                onMouseLeave={() => setExpanded(false)}
                onFocus={() => setExpanded(true)}
                onBlur={handleBlurContainer}
            >
                <div className="header-dashboard">
                    <div className="logo">
                        <div className="logo-mark" aria-hidden="true">
                            <span style={{ height: 6 }}></span>
                            <span style={{ height: 11 }}></span>
                            <span style={{ height: 9 }}></span>
                            <span style={{ height: 15 }}></span>
                        </div>
                        <h1>SalesTrack</h1>
                    </div>
                    <hr />
                </div>
                <div className="sidebar-menu">
                    {!isVendedor && (
                        <div className={`menu-select ${itemActive === '/dashboard' ? 'ativo' : ''}`} onClick={() => handleItemClick('/dashboard')}>
                            <MenuIcon name="dashboard" />
                            <span>Dashboard</span>
                        </div>
                    )}
                    <div className={`menu-select ${itemActive === '/vendas' ? 'ativo' : ''}`} onClick={() => handleItemClick('/vendas')}>
                        <MenuIcon name="vendas" />
                        <span>Nova Venda</span>
                    </div>
                    <div className={`menu-select ${itemActive === '/historico' ? 'ativo' : ''}`} onClick={() => handleItemClick('/historico')}>
                        <MenuIcon name="historico" />
                        <span>Histórico</span>
                    </div>
                    <div className={`menu-select ${itemActive === '/produtos' ? 'ativo' : ''}`} onClick={() => handleItemClick('/produtos')}>
                        <MenuIcon name="produtos" />
                        <span>Produtos</span>
                    </div>
                    <div className={`menu-select ${itemActive === '/clientes' ? 'ativo' : ''}`} onClick={() => handleItemClick('/clientes')}>
                        <MenuIcon name="clientes" />
                        <span>Clientes</span>
                    </div>
                    {isAdminOrTecnico && (
                        <div className={`menu-select ${itemActive === '/relatorios' ? 'ativo' : ''}`} onClick={() => handleItemClick('/relatorios')}>
                            <MenuIcon name="relatorios" />
                            <span>Relatórios</span>
                        </div>
                    )}
                    {isAdminOrTecnico && (
                        <div className={`menu-select ${itemActive === '/configuracoes' ? 'ativo' : ''}`} onClick={() => handleItemClick('/configuracoes')}>
                            <MenuIcon name="configuracoes" />
                            <span>Configurações</span>
                        </div>
                    )}
                </div>
                <div className="footer-sidebar">
                    <div className="footer-user-info">
                        <div className="footer-avatar">
                            {displayNome.charAt(0).toUpperCase()}
                        </div>
                        <div className="footer-user-text">
                            <span className="footer-user-name">{displayNome}</span>
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
