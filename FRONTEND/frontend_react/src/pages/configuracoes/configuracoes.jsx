import { useState, useRef, useCallback, useEffect } from 'react';
import Sidebar from '../../components/SideBar/sidebar';
import { useConfig } from '../../contexts/ConfigContext';
import { useNotification } from '../../contexts/NotificationContext';
import StorageService from '../../services/storageService';
import './style.css';

// ─── Helpers ───────────────────────────────────────────────────────

function validarCNPJ(cnpj) {
    const nums = cnpj.replace(/\D/g, '');
    if (nums.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(nums)) return false; // todos iguais
    const calc = (slice, weights) =>
        slice.split('').reduce((sum, d, i) => sum + Number(d) * weights[i], 0);
    const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
    const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const r1 = calc(nums.slice(0,12), w1) % 11;
    const d1 = r1 < 2 ? 0 : 11 - r1;
    if (Number(nums[12]) !== d1) return false;
    const r2 = calc(nums.slice(0,13), w2) % 11;
    const d2 = r2 < 2 ? 0 : 11 - r2;
    return Number(nums[13]) === d2;
}

function mascaraCNPJ(value) {
    const nums = value.replace(/\D/g, '').slice(0, 14);
    return nums
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
}

function mascaraCEP(value) {
    const nums = value.replace(/\D/g, '').slice(0, 8);
    if (nums.length > 5) return nums.slice(0, 5) + '-' + nums.slice(5);
    return nums;
}

// ─── Component ─────────────────────────────────────────────────────

function Configuracoes() {
    const {
        permiteEstoqueNegativo, setPermiteEstoqueNegativo,
        dadosEmpresa, setDadosEmpresa,
        configImpressora, setConfigImpressora,
        DADOS_EMPRESA_DEFAULT,
    } = useConfig();
    const { showNotification } = useNotification();

    // ── Empresa form state (local draft) ───────────────────────
    const [empresa, setEmpresa] = useState(dadosEmpresa);
    const [erros, setErros] = useState({});
    const [cepLoading, setCepLoading] = useState(false);
    const cepAbortRef = useRef(null);
    const cepTimerRef = useRef(null);
    const fileInputRef = useRef(null);

    // Sync from context when it changes (e.g. after import)
    useEffect(() => { setEmpresa(dadosEmpresa); }, [dadosEmpresa]);

    // ── Cadastro field change ──────────────────────────────────
    const handleCadastro = (field, value) => {
        const val = field === 'cnpj' ? mascaraCNPJ(value) : value;
        setEmpresa(prev => ({
            ...prev,
            cadastro: { ...prev.cadastro, [field]: val },
        }));
        if (erros[field]) setErros(prev => ({ ...prev, [field]: null }));
    };

    // ── Endereco field change ──────────────────────────────────
    const handleEndereco = (field, value) => {
        const val = field === 'cep' ? mascaraCEP(value) : value;
        setEmpresa(prev => ({
            ...prev,
            endereco: { ...prev.endereco, [field]: val },
        }));
        if (field === 'cep') debounceCep(val);
        if (erros[field]) setErros(prev => ({ ...prev, [field]: null }));
    };

    // ── CEP lookup with debounce + AbortController ─────────────
    const debounceCep = useCallback((cepValue) => {
        if (cepTimerRef.current) clearTimeout(cepTimerRef.current);
        if (cepAbortRef.current) cepAbortRef.current.abort();

        const nums = cepValue.replace(/\D/g, '');
        if (nums.length !== 8) return;

        cepTimerRef.current = setTimeout(async () => {
            const controller = new AbortController();
            cepAbortRef.current = controller;
            setCepLoading(true);
            try {
                const res = await fetch(
                    `https://viacep.com.br/ws/${nums}/json/`,
                    { signal: controller.signal }
                );
                const data = await res.json();

                // Concurrency guard: verify CEP hasn't changed
                const currentCep = document.getElementById('input-cep')?.value?.replace(/\D/g, '');
                if (currentCep !== nums) return;

                if (data.erro) {
                    showNotification('CEP não encontrado. Verifique o número.', 'warning');
                    return;
                }
                setEmpresa(prev => ({
                    ...prev,
                    endereco: {
                        ...prev.endereco,
                        logradouro: data.logradouro || '',
                        bairro: data.bairro || '',
                        cidade: data.localidade || '',
                        estado: data.uf || '',
                        pais: 'Brasil',
                    },
                }));
            } catch (err) {
                if (err.name !== 'AbortError') {
                    showNotification('Não foi possível consultar o CEP. Verifique sua conexão.', 'error');
                }
            } finally {
                setCepLoading(false);
            }
        }, 800);
    }, [showNotification]);

    // ── Validação + Salvar ──────────────────────────────────────
    const salvarEmpresa = () => {
        const e = {};
        const c = empresa.cadastro;
        if (!c.razaoSocial || c.razaoSocial.trim().length < 3) e.razaoSocial = 'Mínimo 3 caracteres';
        if (!c.nomeFantasia || c.nomeFantasia.trim().length < 2) e.nomeFantasia = 'Mínimo 2 caracteres';
        if (!c.cnpj || !validarCNPJ(c.cnpj)) e.cnpj = 'CNPJ inválido';
        if (!c.inscricaoEstadual || !c.inscricaoEstadual.trim()) e.inscricaoEstadual = 'Campo obrigatório';

        if (Object.keys(e).length > 0) {
            setErros(e);
            showNotification('Corrija os campos destacados.', 'warning');
            return;
        }
        setErros({});
        setDadosEmpresa(empresa);
        showNotification('Dados da empresa salvos com sucesso!', 'success');
    };

    // ── Impressora ─────────────────────────────────────────────
    const handleFormato = (value) => {
        const novo = { ...configImpressora, formato: value };
        setConfigImpressora(novo);
    };

    const imprimirTeste = () => {
        window.print();
    };

    // ── Backup ─────────────────────────────────────────────────
    const exportarBackup = () => {
        const backup = StorageService.exportAll();
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `salestrack-backup-${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Backup exportado com sucesso!', 'success');
    };

    const importarBackup = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result);
                const result = StorageService.importAll(parsed);
                if (!result.success) {
                    showNotification(result.error, 'error');
                    return;
                }
                showNotification('Backup restaurado! Recarregando...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } catch {
                showNotification('Arquivo JSON inválido.', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // ── Render ──────────────────────────────────────────────────
    return (
        <div className="body-configuracoes">
            <Sidebar />
            <div className="content-configuracoes">
                <div className="title-page">
                    <h1>Configurações</h1>
                </div>
                <div className="configuracoes-body">

                    {/* ── 1. Dados da Empresa ────────────────────── */}
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
                            {/* Cadastro */}
                            <div className="config-row">
                                <div className="config-field">
                                    <label>Razão Social <span className="required">*</span></label>
                                    <input type="text" placeholder="Razão Social da Empresa"
                                        value={empresa.cadastro.razaoSocial}
                                        onChange={e => handleCadastro('razaoSocial', e.target.value)}
                                        className={erros.razaoSocial ? 'input-error' : ''}
                                    />
                                    {erros.razaoSocial && <span className="field-error">{erros.razaoSocial}</span>}
                                </div>
                                <div className="config-field">
                                    <label>Nome Fantasia <span className="required">*</span></label>
                                    <input type="text" placeholder="Nome Fantasia"
                                        value={empresa.cadastro.nomeFantasia}
                                        onChange={e => handleCadastro('nomeFantasia', e.target.value)}
                                        className={erros.nomeFantasia ? 'input-error' : ''}
                                    />
                                    {erros.nomeFantasia && <span className="field-error">{erros.nomeFantasia}</span>}
                                </div>
                            </div>
                            <div className="config-row">
                                <div className="config-field">
                                    <label>CNPJ <span className="required">*</span></label>
                                    <input type="text" placeholder="00.000.000/0000-00"
                                        value={empresa.cadastro.cnpj}
                                        onChange={e => handleCadastro('cnpj', e.target.value)}
                                        className={erros.cnpj ? 'input-error' : ''}
                                    />
                                    {erros.cnpj && <span className="field-error">{erros.cnpj}</span>}
                                </div>
                                <div className="config-field">
                                    <label>Inscrição Estadual <span className="required">*</span></label>
                                    <input type="text" placeholder="000.000.000.000"
                                        value={empresa.cadastro.inscricaoEstadual}
                                        onChange={e => handleCadastro('inscricaoEstadual', e.target.value)}
                                        className={erros.inscricaoEstadual ? 'input-error' : ''}
                                    />
                                    {erros.inscricaoEstadual && <span className="field-error">{erros.inscricaoEstadual}</span>}
                                </div>
                            </div>

                            {/* Divisor */}
                            <div className="config-divider">
                                <span>Endereço</span>
                            </div>

                            {/* Endereço */}
                            <div className="config-row config-row--3col">
                                <div className="config-field">
                                    <label>CEP</label>
                                    <div className="cep-input-group">
                                        <input id="input-cep" type="text" placeholder="00000-000"
                                            value={empresa.endereco.cep}
                                            onChange={e => handleEndereco('cep', e.target.value)}
                                        />
                                        {cepLoading && <span className="cep-spinner" />}
                                    </div>
                                </div>
                                <div className="config-field">
                                    <label>Número</label>
                                    <input type="text" placeholder="Nº"
                                        value={empresa.endereco.numero}
                                        onChange={e => handleEndereco('numero', e.target.value)}
                                    />
                                </div>
                                <div className="config-field">
                                    <label>Complemento</label>
                                    <input type="text" placeholder="Sala, Bloco..."
                                        value={empresa.endereco.complemento}
                                        onChange={e => handleEndereco('complemento', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="config-field">
                                <label>Logradouro</label>
                                <input type="text" placeholder="Rua, Avenida..."
                                    value={empresa.endereco.logradouro}
                                    onChange={e => handleEndereco('logradouro', e.target.value)}
                                    readOnly={!!empresa.endereco.cidade}
                                />
                            </div>
                            <div className="config-row config-row--3col">
                                <div className="config-field">
                                    <label>Bairro</label>
                                    <input type="text" placeholder="Bairro"
                                        value={empresa.endereco.bairro}
                                        onChange={e => handleEndereco('bairro', e.target.value)}
                                        readOnly={!!empresa.endereco.cidade}
                                    />
                                </div>
                                <div className="config-field">
                                    <label>Cidade</label>
                                    <input type="text" placeholder="Cidade"
                                        value={empresa.endereco.cidade} readOnly
                                    />
                                </div>
                                <div className="config-field">
                                    <label>Estado</label>
                                    <input type="text" placeholder="UF"
                                        value={empresa.endereco.estado} readOnly
                                    />
                                </div>
                            </div>
                            <div className="config-row">
                                <div className="config-field">
                                    <label>País</label>
                                    <input type="text" value={empresa.endereco.pais} readOnly />
                                </div>
                            </div>

                            <div className="config-card-actions">
                                <button className="btn-primary" onClick={salvarEmpresa}>Salvar Dados</button>
                            </div>
                        </div>
                    </div>

                    {/* ── 2. Comportamento de Vendas ──────────────── */}
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

                    {/* ── 3. Impressão ────────────────────────────── */}
                    <div className="config-card">
                        <div className="config-card-header">
                            <div className="config-card-icon config-card-icon--purple">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="6 9 6 2 18 2 18 9" />
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                    <rect x="6" y="14" width="12" height="8" />
                                </svg>
                            </div>
                            <div>
                                <h2>Impressão</h2>
                                <p>Configurações de impressora e comprovante</p>
                            </div>
                        </div>
                        <div className="config-card-body">
                            <div className="config-info-box">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                <span>A impressora será selecionada através do diálogo do Windows ao imprimir.</span>
                            </div>
                            <div className="config-row">
                                <div className="config-field">
                                    <label>Formato do Comprovante</label>
                                    <select value={configImpressora.formato} onChange={e => handleFormato(e.target.value)}>
                                        <option value="cupom_80mm">Cupom (80mm)</option>
                                        <option value="a4">A4</option>
                                    </select>
                                </div>
                                <div className="config-field config-field--btn-align">
                                    <label>&nbsp;</label>
                                    <button className="btn-secondary" onClick={imprimirTeste}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                            <polyline points="6 9 6 2 18 2 18 9" />
                                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                            <rect x="6" y="14" width="12" height="8" />
                                        </svg>
                                        Imprimir Página de Teste
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── 4. Integração Pinpad ────────────────────── */}
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

                    {/* ── 5. Backup ───────────────────────────────── */}
                    <div className="config-card">
                        <div className="config-card-header">
                            <div className="config-card-icon config-card-icon--amber">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </div>
                            <div>
                                <h2>Backup</h2>
                                <p>Exportar e importar configurações do sistema</p>
                            </div>
                        </div>
                        <div className="config-card-body">
                            <div className="config-info-box">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                <span>O backup inclui dados da empresa, formas de pagamento e configurações locais. Arquivo versionado em JSON.</span>
                            </div>
                            <div className="config-actions-row">
                                <button className="btn-secondary" onClick={exportarBackup}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Exportar Dados
                                </button>
                                <button className="btn-secondary btn-secondary--import" onClick={() => fileInputRef.current?.click()}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    Importar Dados
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    style={{ display: 'none' }}
                                    onChange={importarBackup}
                                />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default Configuracoes;
