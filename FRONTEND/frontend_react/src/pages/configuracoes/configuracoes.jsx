import { useState, useRef, useCallback, useEffect } from 'react';
import Sidebar from '../../components/SideBar/sidebar';
import Modal from '../../components/Modal/Modal';
import { useConfig } from '../../contexts/ConfigContext';
import { useNotification } from '../../contexts/NotificationContext';
import api from '../../services/api';
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

const TIPO_LABELS = { admin: 'Administrador', supervisor: 'Supervisor', vendedor: 'Vendedor' };
const TIPO_BADGE  = { admin: 'badge-info', supervisor: 'badge-warning', vendedor: 'badge-success' };

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

    // ── Gerenciamento de Usuários ──────────────────────────────
    const [modalUsuarios, setModalUsuarios] = useState(false);
    const [usuarios, setUsuarios] = useState([]);
    const [loadingUsuarios, setLoadingUsuarios] = useState(false);
    const [viewCriar, setViewCriar] = useState(false);
    const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '', tipo: 'vendedor' });
    const [errosCriar, setErrosCriar] = useState({});
    const [criando, setCriando] = useState(false);

    const [viewEditar, setViewEditar] = useState(false);
    const [usuarioEditando, setUsuarioEditando] = useState(null);
    const [errosEditar, setErrosEditar] = useState({});
    const [editando, setEditando] = useState(false);
    const [usuarioParaExcluir, setUsuarioParaExcluir] = useState(null);

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

    // ── Usuários ───────────────────────────────────────────────
    async function carregarUsuarios() {
        setLoadingUsuarios(true);
        try {
            const res = await api.get('/usuarios');
            setUsuarios(res.data);
        } catch {
            showNotification('Erro ao carregar usuários.', 'error');
        } finally {
            setLoadingUsuarios(false);
        }
    }

    function abrirModalUsuarios() {
        setViewCriar(false);
        setViewEditar(false);
        setNovoUsuario({ nome: '', email: '', senha: '', tipo: 'vendedor' });
        setErrosCriar({});
        setModalUsuarios(true);
        carregarUsuarios();
    }

    function abrirEditar(usuario) {
        setUsuarioEditando({ ...usuario, senha: '' });
        setErrosEditar({});
        setViewEditar(true);
        setViewCriar(false);
    }

    function handleEditarChange(field, value) {
        setUsuarioEditando(prev => ({ ...prev, [field]: value }));
        if (errosEditar[field]) setErrosEditar(prev => ({ ...prev, [field]: null }));
    }

    async function salvarEdicao() {
        const e = {};
        if (!usuarioEditando.nome.trim()) e.nome = 'Campo obrigatório';
        if (!usuarioEditando.tipo) e.tipo = 'Selecione um perfil';
        if (usuarioEditando.senha && usuarioEditando.senha.length < 4) e.senha = 'Mínimo 4 caracteres';

        if (Object.keys(e).length > 0) { setErrosEditar(e); return; }

        setEditando(true);
        try {
            await api.put(`/usuarios/${usuarioEditando.idUsuario}`, {
                nome: usuarioEditando.nome,
                tipo: usuarioEditando.tipo,
                senha: usuarioEditando.senha || undefined,
            });
            showNotification('Usuário atualizado com sucesso!', 'success');
            setViewEditar(false);
            setUsuarioEditando(null);
            carregarUsuarios();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Erro ao atualizar usuário.', 'error');
        } finally {
            setEditando(false);
        }
    }

    async function confirmarExclusao() {
        if (!usuarioParaExcluir) return;
        try {
            await api.delete(`/usuarios/${usuarioParaExcluir.idUsuario}`);
            showNotification('Usuário inativado com sucesso!', 'success');
            setUsuarioParaExcluir(null);
            carregarUsuarios();
        } catch {
            showNotification('Erro ao inativar usuário.', 'error');
        }
    }

    function handleNovoUsuarioChange(field, value) {
        setNovoUsuario(prev => ({ ...prev, [field]: value }));
        if (errosCriar[field]) setErrosCriar(prev => ({ ...prev, [field]: null }));
    }

    async function criarUsuario() {
        const e = {};
        if (!novoUsuario.nome.trim())  e.nome  = 'Campo obrigatório';
        if (!novoUsuario.email.trim()) e.email = 'Campo obrigatório';
        if (!novoUsuario.senha.trim() || novoUsuario.senha.length < 4) e.senha = 'Mínimo 4 caracteres';
        if (!novoUsuario.tipo)         e.tipo  = 'Selecione um perfil';

        if (Object.keys(e).length > 0) {
            setErrosCriar(e);
            return;
        }

        setCriando(true);
        try {
            await api.post('/usuarios', novoUsuario);
            showNotification('Usuário cadastrado com sucesso!', 'success');
            setViewCriar(false);
            setNovoUsuario({ nome: '', email: '', senha: '', tipo: 'vendedor' });
            setErrosCriar({});
            carregarUsuarios();
        } catch (err) {
            const msg = err.response?.data?.error || 'Erro ao cadastrar usuário.';
            showNotification(msg, 'error');
        } finally {
            setCriando(false);
        }
    }

    // ── Computed: status do formulário de empresa ──────────────
    const cnpjValido = empresa.cadastro.cnpj && validarCNPJ(empresa.cadastro.cnpj);
    const empresaCompleto =
        empresa.cadastro.razaoSocial?.trim().length >= 3 &&
        empresa.cadastro.nomeFantasia?.trim().length >= 2 &&
        !!cnpjValido &&
        !!empresa.cadastro.inscricaoEstadual?.trim();

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
                            <span className={`config-card-status ${empresaCompleto ? 'config-card-status--ok' : 'config-card-status--inc'}`}>
                                {empresaCompleto ? '✓ Completo' : 'Incompleto'}
                            </span>
                        </div>
                        <div className="config-card-body">
                            {/* Seção: Cadastro Fiscal */}
                            <div className="config-section-label">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" />
                                    <path d="M16 2v4M8 2v4M3 10h18" />
                                </svg>
                                Cadastro Fiscal
                            </div>
                            <div className="config-row">
                                <div className="config-field">
                                    <label>Razão Social <span className="required">*</span></label>
                                    <input type="text" placeholder="Razão Social da Empresa"
                                        value={empresa.cadastro.razaoSocial}
                                        onChange={e => handleCadastro('razaoSocial', e.target.value)}
                                        className={erros.razaoSocial ? 'input-error' : (empresa.cadastro.razaoSocial?.trim().length >= 3 ? 'input-valid' : '')}
                                    />
                                    {erros.razaoSocial && <span className="field-error">{erros.razaoSocial}</span>}
                                </div>
                                <div className="config-field">
                                    <label>Nome Fantasia <span className="required">*</span></label>
                                    <input type="text" placeholder="Nome Fantasia"
                                        value={empresa.cadastro.nomeFantasia}
                                        onChange={e => handleCadastro('nomeFantasia', e.target.value)}
                                        className={erros.nomeFantasia ? 'input-error' : (empresa.cadastro.nomeFantasia?.trim().length >= 2 ? 'input-valid' : '')}
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
                                        className={erros.cnpj ? 'input-error' : (cnpjValido ? 'input-valid' : '')}
                                    />
                                    {erros.cnpj && <span className="field-error">{erros.cnpj}</span>}
                                    {cnpjValido && !erros.cnpj && (
                                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 500, marginTop: '3px', display: 'block' }}>✓ CNPJ válido</span>
                                    )}
                                </div>
                                <div className="config-field">
                                    <label>Inscrição Estadual <span className="required">*</span></label>
                                    <input type="text" placeholder="000.000.000.000"
                                        value={empresa.cadastro.inscricaoEstadual}
                                        onChange={e => handleCadastro('inscricaoEstadual', e.target.value)}
                                        className={erros.inscricaoEstadual ? 'input-error' : (empresa.cadastro.inscricaoEstadual?.trim() ? 'input-valid' : '')}
                                    />
                                    {erros.inscricaoEstadual && <span className="field-error">{erros.inscricaoEstadual}</span>}
                                </div>
                            </div>

                            {/* Seção: Endereço Fiscal */}
                            <div className="config-divider">
                                <span>Endereço Fiscal</span>
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
                                />
                            </div>
                            <div className="config-row config-row--3col">
                                <div className="config-field">
                                    <label>Bairro</label>
                                    <input type="text" placeholder="Bairro"
                                        value={empresa.endereco.bairro}
                                        onChange={e => handleEndereco('bairro', e.target.value)}
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

                    {/* ── 2. Usuários ─────────────────────────────── */}
                    <div className="config-card">
                        <div className="config-card-header">
                            <div className="config-card-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <div>
                                <h2>Usuários</h2>
                                <p>Gerencie os usuários e perfis de acesso do sistema</p>
                            </div>
                        </div>
                        <div className="config-card-body">
                            <div className="config-actions-row">
                                <button className="btn-primary" onClick={abrirModalUsuarios}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                    Gerenciar Usuários
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── 3. Comportamento de Vendas ──────────────── */}
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

                    {/* ── 4. Impressão ────────────────────────────── */}
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
                        <div className="config-card-badge">Em desenvolvimento</div>
                    </div>

                    {/* ── 5. Integração Pinpad ────────────────────── */}
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

                    {/* ── 6. Backup ───────────────────────────────── */}
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

            {/* ── Modal Gerenciar Usuários ──────────────────────── */}
            <Modal
                isOpen={modalUsuarios}
                onClose={() => { setModalUsuarios(false); setViewCriar(false); setViewEditar(false); }}
                title={viewCriar ? 'Cadastrar Novo Usuário' : viewEditar ? 'Editar Usuário' : 'Gerenciar Usuários'}
                maxWidth="680px"
                footer={
                    viewCriar ? (
                        <>
                            <button className="btn-modal-cancel" onClick={() => { setViewCriar(false); setErrosCriar({}); }}>Voltar</button>
                            <button className="btn-primary" onClick={criarUsuario} disabled={criando}>
                                {criando ? 'Cadastrando...' : 'Cadastrar Usuário'}
                            </button>
                        </>
                    ) : viewEditar ? (
                        <>
                            <button className="btn-modal-cancel" onClick={() => { setViewEditar(false); setUsuarioEditando(null); setErrosEditar({}); }}>Voltar</button>
                            <button className="btn-primary" onClick={salvarEdicao} disabled={editando}>
                                {editando ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn-modal-cancel" onClick={() => setModalUsuarios(false)}>Fechar</button>
                            <button className="btn-primary" onClick={() => { setViewCriar(true); setErrosCriar({}); setNovoUsuario({ nome: '', email: '', senha: '', tipo: 'vendedor' }); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Cadastrar Novo
                            </button>
                        </>
                    )
                }
            >
                {viewCriar ? (
                    <div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Nome <span className="required">*</span></label>
                                <input type="text" placeholder="Nome completo" value={novoUsuario.nome}
                                    onChange={e => handleNovoUsuarioChange('nome', e.target.value)}
                                    className={errosCriar.nome ? 'input-error' : ''} />
                                {errosCriar.nome && <span className="field-error">{errosCriar.nome}</span>}
                            </div>
                            <div className="form-group">
                                <label>Perfil <span className="required">*</span></label>
                                <select value={novoUsuario.tipo} onChange={e => handleNovoUsuarioChange('tipo', e.target.value)}
                                    className={errosCriar.tipo ? 'input-error' : ''}>
                                    <option value="vendedor">Vendedor</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="admin">Administrador</option>
                                </select>
                                {errosCriar.tipo && <span className="field-error">{errosCriar.tipo}</span>}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>E-mail <span className="required">*</span></label>
                            <input type="email" placeholder="usuario@empresa.com" value={novoUsuario.email}
                                onChange={e => handleNovoUsuarioChange('email', e.target.value)}
                                className={errosCriar.email ? 'input-error' : ''} autoComplete="off" />
                            {errosCriar.email && <span className="field-error">{errosCriar.email}</span>}
                        </div>
                        <div className="form-group">
                            <label>Senha <span className="required">*</span></label>
                            <input type="password" placeholder="Mínimo 4 caracteres" value={novoUsuario.senha}
                                onChange={e => handleNovoUsuarioChange('senha', e.target.value)}
                                className={errosCriar.senha ? 'input-error' : ''} autoComplete="new-password" />
                            {errosCriar.senha && <span className="field-error">{errosCriar.senha}</span>}
                        </div>
                    </div>
                ) : viewEditar && usuarioEditando ? (
                    <div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Nome <span className="required">*</span></label>
                                <input type="text" placeholder="Nome completo" value={usuarioEditando.nome}
                                    onChange={e => handleEditarChange('nome', e.target.value)}
                                    className={errosEditar.nome ? 'input-error' : ''} />
                                {errosEditar.nome && <span className="field-error">{errosEditar.nome}</span>}
                            </div>
                            <div className="form-group">
                                <label>Perfil <span className="required">*</span></label>
                                <select value={usuarioEditando.tipo} onChange={e => handleEditarChange('tipo', e.target.value)}
                                    className={errosEditar.tipo ? 'input-error' : ''}>
                                    <option value="vendedor">Vendedor</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="admin">Administrador</option>
                                </select>
                                {errosEditar.tipo && <span className="field-error">{errosEditar.tipo}</span>}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>E-mail</label>
                            <input type="text" value={usuarioEditando.email} disabled
                                style={{ background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' }} />
                        </div>
                        <div className="form-group">
                            <label>Nova Senha <span style={{ color: '#94a3b8', fontWeight: 400 }}>(deixe em branco para manter)</span></label>
                            <input type="password" placeholder="Mínimo 4 caracteres" value={usuarioEditando.senha}
                                onChange={e => handleEditarChange('senha', e.target.value)}
                                className={errosEditar.senha ? 'input-error' : ''} autoComplete="new-password" />
                            {errosEditar.senha && <span className="field-error">{errosEditar.senha}</span>}
                        </div>
                    </div>
                ) : (
                    loadingUsuarios ? (
                        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0' }}>Carregando usuários...</p>
                    ) : usuarios.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0' }}>Nenhum usuário cadastrado.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>Nome</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>E-mail</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>Perfil</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>Status</th>
                                        <th style={{ padding: '8px 12px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usuarios.map(u => (
                                        <tr key={u.idUsuario} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: 500 }}>{u.nome}</td>
                                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{u.email}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span className={`badge ${TIPO_BADGE[u.tipo] || 'badge-neutral'}`}>
                                                    {TIPO_LABELS[u.tipo] || u.tipo}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span className={`badge ${u.ativo ? 'badge-success' : 'badge-danger'}`}>
                                                    {u.ativo ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                                <button onClick={() => abrirEditar(u)} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '4px 6px', borderRadius: '6px' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                </button>
                                                <button onClick={() => setUsuarioParaExcluir(u)} title="Inativar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px 6px', borderRadius: '6px' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                        <path d="M10 11v6M14 11v6" />
                                                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </Modal>

            {/* ── Modal Confirmação Exclusão ────────────────────── */}
            <Modal
                isOpen={!!usuarioParaExcluir}
                onClose={() => setUsuarioParaExcluir(null)}
                title="Inativar Usuário"
                maxWidth="420px"
                footer={
                    <>
                        <button className="btn-modal-cancel" onClick={() => setUsuarioParaExcluir(null)}>Cancelar</button>
                        <button className="btn-modal-danger" onClick={confirmarExclusao}>Confirmar Inativação</button>
                    </>
                }
            >
                <p className="confirm-message">
                    Deseja inativar o usuário <strong>{usuarioParaExcluir?.nome}</strong>?<br />
                    O usuário perderá o acesso ao sistema, mas seu histórico será mantido.
                </p>
            </Modal>
        </div>
    );
}

export default Configuracoes;
