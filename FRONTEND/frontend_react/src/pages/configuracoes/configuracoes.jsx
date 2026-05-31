import Sidebar from '../../components/SideBar/sidebar';
import { useConfig } from '../../contexts/ConfigContext';
import './style.css';

function Configuracoes() {
    const { permiteEstoqueNegativo, setPermiteEstoqueNegativo } = useConfig();

    return (
        <div className="body-configuracoes">
            <Sidebar />
            <div className="content-configuracoes">
                <div className="title-page">
                    <h1>Configurações</h1>
                </div>
                <div className="configuracoes-body">
                    {/* Comportamento de Vendas */}
                    <div className="config-card">
                        <div className="config-card-header">
                            <div className="config-card-icon config-card-icon--green">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                </svg>
                            </div>
                            <div>
                                <h2>Comportamento de Vendas</h2>
                                <p>Controle de estoque e permissões no ponto de venda</p>
                            </div>
                        </div>
                        <div className="config-card-body">
                            <div className="config-toggle-row">
                                <div className="config-toggle-info">
                                    <span className="config-toggle-label">Permitir venda com estoque zerado ou negativo</span>
                                    <span className="config-toggle-desc">
                                        Quando ativado, produtos com saldo zero ou negativo podem ser adicionados à venda. O estoque ficará negativo no cadastro do produto.
                                    </span>
                                </div>
                                <button
                                    id="toggle-estoque-negativo"
                                    className={`config-toggle-btn ${permiteEstoqueNegativo ? 'active' : ''}`}
                                    onClick={() => setPermiteEstoqueNegativo(!permiteEstoqueNegativo)}
                                    aria-pressed={permiteEstoqueNegativo}
                                    title={permiteEstoqueNegativo ? 'Desativar' : 'Ativar'}
                                >
                                    <span className="config-toggle-track">
                                        <span className="config-toggle-thumb" />
                                    </span>
                                    <span className="config-toggle-status">
                                        {permiteEstoqueNegativo ? 'Ativado' : 'Desativado'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Dados da Empresa */}
                    <div className="config-card">
                        <div className="config-card-header">
                            <div className="config-card-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                            </div>
                            <div>
                                <h2>Dados da Empresa</h2>
                                <p>Informações cadastrais do estabelecimento</p>
                            </div>
                        </div>
                        <div className="config-card-body">
                            <div className="config-field">
                                <label>Nome da Empresa</label>
                                <input type="text" placeholder="SalesTrack Ltda." disabled />
                            </div>
                            <div className="config-row">
                                <div className="config-field">
                                    <label>CNPJ</label>
                                    <input type="text" placeholder="00.000.000/0000-00" disabled />
                                </div>
                                <div className="config-field">
                                    <label>Telefone</label>
                                    <input type="text" placeholder="(00) 0000-0000" disabled />
                                </div>
                            </div>
                            <div className="config-field">
                                <label>Endereço</label>
                                <input type="text" placeholder="Rua Exemplo, 123" disabled />
                            </div>
                        </div>
                        <div className="config-card-badge">Em desenvolvimento</div>
                    </div>

                    {/* Impressão */}
                    <div className="config-card">
                        <div className="config-card-header">
                            <div className="config-card-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="6 9 6 2 18 2 18 9" />
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                    <rect x="6" y="14" width="12" height="8" />
                                </svg>
                            </div>
                            <div>
                                <h2>Impressão</h2>
                                <p>Configurações de impressora e cupom fiscal</p>
                            </div>
                        </div>
                        <div className="config-card-body">
                            <div className="config-row">
                                <div className="config-field">
                                    <label>Impressora padrão</label>
                                    <select disabled>
                                        <option>Selecione uma impressora</option>
                                    </select>
                                </div>
                                <div className="config-field">
                                    <label>Formato</label>
                                    <select disabled>
                                        <option>Cupom (80mm)</option>
                                        <option>A4</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="config-card-badge">Em desenvolvimento</div>
                    </div>

                    {/* Integração Pinpad */}
                    <div className="config-card">
                        <div className="config-card-header">
                            <div className="config-card-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="2" y="3" width="20" height="18" rx="2" />
                                    <path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01M8 15h8" />
                                </svg>
                            </div>
                            <div>
                                <h2>Integração Pinpad</h2>
                                <p>Configuração de máquina de cartão</p>
                            </div>
                        </div>
                        <div className="config-card-body">
                            <div className="config-row">
                                <div className="config-field">
                                    <label>Provedor</label>
                                    <select disabled>
                                        <option>Selecione o provedor</option>
                                        <option>Stone</option>
                                        <option>Cielo</option>
                                        <option>Rede</option>
                                        <option>PagSeguro</option>
                                    </select>
                                </div>
                                <div className="config-field">
                                    <label>Porta COM</label>
                                    <input type="text" placeholder="COM3" disabled />
                                </div>
                            </div>
                        </div>
                        <div className="config-card-badge">Em desenvolvimento</div>
                    </div>

                    {/* Backup */}
                    <div className="config-card">
                        <div className="config-card-header">
                            <div className="config-card-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </div>
                            <div>
                                <h2>Backup</h2>
                                <p>Exportar e importar dados do sistema</p>
                            </div>
                        </div>
                        <div className="config-card-body">
                            <div className="config-actions-row">
                                <button className="config-btn" disabled>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Exportar Dados
                                </button>
                                <button className="config-btn" disabled>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    Importar Dados
                                </button>
                            </div>
                        </div>
                        <div className="config-card-badge">Em desenvolvimento</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Configuracoes;
