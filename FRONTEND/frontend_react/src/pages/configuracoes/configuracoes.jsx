import { useState, useRef, useCallback, useEffect } from 'react';
import Sidebar from '../../components/SideBar/sidebar';
import Modal from '../../components/Modal/Modal';
import { useConfig } from '../../contexts/ConfigContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import StorageService from '../../services/storageService';
import ImpressaoService from '../../services/impressaoService';
import { formatarDataAtual } from '../../utils/data';
import { montarPaginaTeste } from '../../utils/comprovante';
import { MAX_FORMAS_PAGAMENTO, slugFormaPagamento } from '../../utils/pagamento';
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

// Integração com Pinpad ainda não implementada: o card fica fora da tela e
// só o esqueleto é mantido no código. Trocar para true ao implementar.
const EXIBIR_INTEGRACAO_PINPAD = false;

// Velocidades aceitas pelo Agente de Impressão para impressora em porta COM
const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];

// ─── Component ─────────────────────────────────────────────────────

function normalizarEmpresa(dados, padrao) {
    const defaultData = padrao || {
        cadastro: { razaoSocial: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '' },
        endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', pais: 'Brasil' },
    };
    if (!dados || typeof dados !== 'object') return defaultData;
    return {
        ...dados,
        cadastro: {
            ...defaultData.cadastro,
            ...(dados.cadastro || {}),
        },
        endereco: {
            ...defaultData.endereco,
            ...(dados.endereco || {}),
        },
    };
}

function Configuracoes() {
    const dataAtual = formatarDataAtual();
    const {
        permiteEstoqueNegativo, setPermiteEstoqueNegativo,
        dadosEmpresa, setDadosEmpresa,
        configImpressora, setConfigImpressora,
        formasPagamento, salvarFormas, permiteExcluir,
        FORMAS_PADRAO,
        DADOS_EMPRESA_DEFAULT,
    } = useConfig();
    const { showNotification } = useNotification();
    const { user: usuarioLogado } = useAuth();

    // ── Backup ─────────────────────────────────────────────────
    const [backupPendente, setBackupPendente] = useState(null);
    const [importando, setImportando] = useState(false);

    // ── Empresa form state (local draft) ───────────────────────
    const [empresa, setEmpresa] = useState(() => normalizarEmpresa(dadosEmpresa, DADOS_EMPRESA_DEFAULT));
    const [erros, setErros] = useState({});
    const [cepLoading, setCepLoading] = useState(false);
    const [salvandoEstoqueNegativo, setSalvandoEstoqueNegativo] = useState(false);
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

    // ── Formas de Pagamento ────────────────────────────────────
    const [novaForma, setNovaForma] = useState({ label: '' });
    const [erroForma, setErroForma] = useState('');
    const [salvandoForma, setSalvandoForma] = useState(false);
    const [formaParaExcluir, setFormaParaExcluir] = useState(null);

    // ── Impressão ──────────────────────────────────────────────
    // 'verificando' | 'conectado' | 'indisponivel'
    const [agenteStatus, setAgenteStatus] = useState('verificando');
    const [agenteInfo, setAgenteInfo] = useState(null);
    const [dispositivos, setDispositivos] = useState({ impressoras: [], portasSeriais: [] });
    const [atualizandoDispositivos, setAtualizandoDispositivos] = useState(false);
    const [impressora, setImpressora] = useState(configImpressora);   // rascunho local
    const [imprimindoTeste, setImprimindoTeste] = useState(false);

    // Sync from context when it changes (e.g. after import)
    useEffect(() => { setEmpresa(normalizarEmpresa(dadosEmpresa, DADOS_EMPRESA_DEFAULT)); }, [dadosEmpresa, DADOS_EMPRESA_DEFAULT]);
    useEffect(() => { setImpressora(configImpressora); }, [configImpressora]);

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
                setEmpresa(prev => {
                    const atual = normalizarEmpresa(prev, DADOS_EMPRESA_DEFAULT);
                    return {
                        ...atual,
                        endereco: {
                            ...atual.endereco,
                            logradouro: data.logradouro || '',
                            bairro: data.bairro || '',
                            cidade: data.localidade || '',
                            estado: data.uf || '',
                            pais: 'Brasil',
                        },
                    };
                });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    showNotification('Não foi possível consultar o CEP. Verifique sua conexão.', 'error');
                }
            } finally {
                setCepLoading(false);
            }
        }, 800);
    }, [showNotification, DADOS_EMPRESA_DEFAULT]);

    // ── Cadastro field change ──────────────────────────────────
    const handleCadastro = (field, value) => {
        const val = field === 'cnpj' ? mascaraCNPJ(value) : value;
        setEmpresa(prev => {
            const atual = normalizarEmpresa(prev, DADOS_EMPRESA_DEFAULT);
            return {
                ...atual,
                cadastro: { ...atual.cadastro, [field]: val },
            };
        });
        if (erros[field]) setErros(prev => ({ ...prev, [field]: null }));
    };

    // ── Endereco field change ──────────────────────────────────
    const handleEndereco = (field, value) => {
        const val = field === 'cep' ? mascaraCEP(value) : value;
        setEmpresa(prev => {
            const atual = normalizarEmpresa(prev, DADOS_EMPRESA_DEFAULT);
            return {
                ...atual,
                endereco: { ...atual.endereco, [field]: val },
            };
        });
        if (field === 'cep') debounceCep(val);
        if (erros[field]) setErros(prev => ({ ...prev, [field]: null }));
    };

    // ── Validação + Salvar ──────────────────────────────────────
    const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);

    const salvarEmpresa = async () => {
        const e = {};
        const c = empresa?.cadastro || {};
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
        setSalvandoEmpresa(true);
        try {
            await setDadosEmpresa(empresa);
            showNotification('Dados da empresa salvos com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao salvar dados da empresa:', err);
            showNotification('Erro ao salvar dados da empresa no servidor.', 'error');
        } finally {
            setSalvandoEmpresa(false);
        }
    };

    // ── Comportamento de Vendas ──────────────────────────────────
    async function alternarEstoqueNegativo() {
        setSalvandoEstoqueNegativo(true);
        try {
            await setPermiteEstoqueNegativo(!permiteEstoqueNegativo);
            showNotification('Configuração salva com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao salvar configuração:', err);
            showNotification('Erro ao salvar configuração no servidor.', 'error');
        } finally {
            setSalvandoEstoqueNegativo(false);
        }
    }

    // ── Formas de Pagamento ────────────────────────────────────
    const limiteFormasAtingido = formasPagamento.length >= MAX_FORMAS_PAGAMENTO;

    async function adicionarForma() {
        const label = novaForma.label.trim();
        if (label.length < 2) { setErroForma('Informe o nome da forma de pagamento.'); return; }

        // Reaproveita o identificador de uma forma padrão recadastrada com o
        // mesmo nome, para ela continuar somando com as vendas já registradas.
        const slug = slugFormaPagamento(label);
        const padrao = FORMAS_PADRAO.find(f => slugFormaPagamento(f.label) === slug);
        const value = padrao ? padrao.value : slug;

        if (!value) { setErroForma('Use letras ou números no nome.'); return; }
        if (formasPagamento.some(f => f.value === value || slugFormaPagamento(f.label) === slug)) {
            setErroForma('Já existe uma forma de pagamento com esse nome.');
            return;
        }

        setSalvandoForma(true);
        try {
            await salvarFormas([...formasPagamento, { value, label }]);
            setNovaForma({ label: '' });
            setErroForma('');
            showNotification('Forma de pagamento cadastrada!', 'success');
        } catch (err) {
            showNotification(err.response?.data?.error || 'Erro ao salvar forma de pagamento.', 'error');
        } finally {
            setSalvandoForma(false);
        }
    }

    // Só uma forma de pagamento pode ser a "especial" de convênio/controle
    // interno por vez: marcar uma desmarca automaticamente as outras.
    async function alternarEspecialConvenio(forma) {
        const ativar = forma.especial !== 'convenio';
        setSalvandoForma(true);
        try {
            await salvarFormas(formasPagamento.map(f => ({
                ...f,
                especial: f.value === forma.value && ativar ? 'convenio' : null,
            })));
            showNotification(
                ativar ? `"${forma.label}" agora é a forma de Convênio.` : 'Vínculo de Convênio removido.',
                'success'
            );
        } catch (err) {
            showNotification(err.response?.data?.error || 'Erro ao atualizar forma de pagamento.', 'error');
        } finally {
            setSalvandoForma(false);
        }
    }

    async function confirmarExclusaoForma() {
        if (!formaParaExcluir) return;
        setSalvandoForma(true);
        try {
            await salvarFormas(formasPagamento.filter(f => f.value !== formaParaExcluir.value));
            showNotification('Forma de pagamento excluída!', 'success');
            setFormaParaExcluir(null);
        } catch (err) {
            showNotification(err.response?.data?.error || 'Erro ao excluir forma de pagamento.', 'error');
        } finally {
            setSalvandoForma(false);
        }
    }

    // ── Impressora ─────────────────────────────────────────────
    // Pergunta ao agente local se ele está no ar e quais são as impressoras
    // do Windows e as portas COM deste computador.
    const carregarDispositivos = useCallback(async () => {
        setAtualizandoDispositivos(true);
        try {
            setAgenteInfo(await ImpressaoService.status());
            setAgenteStatus('conectado');
        } catch {
            setAgenteStatus('indisponivel');
            setAtualizandoDispositivos(false);
            return;
        }
        try {
            setDispositivos(await ImpressaoService.listarDispositivos());
        } catch (err) {
            showNotification(err.message, 'error');
        } finally {
            setAtualizandoDispositivos(false);
        }
    }, [showNotification]);

    useEffect(() => { carregarDispositivos(); }, [carregarDispositivos]);

    const handleImpressora = (campo, valor) => setImpressora(prev => ({ ...prev, [campo]: valor }));

    const usaSpooler = impressora?.tipo !== 'termica_serial';
    const impressoraTermica = impressora?.tipo !== 'comum_windows';
    const impressoraAlterada = JSON.stringify(impressora) !== JSON.stringify(configImpressora);
    // Dispositivo salvo que não está mais na máquina (desinstalado/desconectado)
    const impressoraAusente = !!impressora?.impressora
        && !(dispositivos?.impressoras || []).some(i => i.nome === impressora.impressora);
    const portaAusente = !!impressora?.portaSerial
        && !(dispositivos?.portasSeriais || []).some(p => p.porta === impressora.portaSerial);

    function validarImpressora() {
        if (usaSpooler && !impressora.impressora) {
            showNotification('Selecione a impressora.', 'warning');
            return false;
        }
        if (!usaSpooler && !impressora.portaSerial) {
            showNotification('Selecione a porta COM da impressora.', 'warning');
            return false;
        }
        return true;
    }

    function salvarImpressora() {
        if (!validarImpressora()) return;
        setConfigImpressora(impressora);
        showNotification('Configuração de impressão salva!', 'success');
    }

    // Usa o rascunho da tela, para dar para testar antes de salvar
    async function imprimirTeste() {
        if (!validarImpressora()) return;
        setImprimindoTeste(true);
        try {
            const linhas = montarPaginaTeste({
                empresa: dadosEmpresa,
                config: impressora,
                dispositivo: usaSpooler
                    ? impressora.impressora
                    : `${impressora.portaSerial} (${impressora.baudRate} bps)`,
                operador: usuarioLogado?.nome,
                formasPagamento,
            });
            await ImpressaoService.imprimir(impressora, linhas);
            showNotification('Página de teste enviada para a impressora.', 'success');
        } catch (err) {
            if (err.agenteIndisponivel) setAgenteStatus('indisponivel');
            showNotification(err.message, 'error');
        } finally {
            setImprimindoTeste(false);
        }
    }

    // ── Backup ─────────────────────────────────────────────────
    const exportarBackup = () => {
        try {
            // Exporta os valores em uso (contexto já sincronizado com o servidor),
            // não só o que por acaso está gravado no localStorage.
            const backup = StorageService.exportAll({
                dadosEmpresa,
                configImpressora,
                formasPagamento,
                permiteEstoqueNegativo,
                permiteExcluir,
            });
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `salestrack-backup-${date}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            // Revogar na hora pode cancelar o download em alguns navegadores
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showNotification('Backup exportado com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao exportar backup:', err);
            showNotification('Não foi possível exportar o backup.', 'error');
        }
    };

    // Lê e valida o arquivo; a restauração só acontece após a confirmação
    const importarBackup = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            let parsed;
            try {
                parsed = JSON.parse(evt.target.result);
            } catch {
                showNotification('Arquivo JSON inválido.', 'error');
                return;
            }
            const validacao = StorageService.validateBackup(parsed);
            if (!validacao.success) {
                showNotification(validacao.error, 'error');
                return;
            }
            setBackupPendente({ nomeArquivo: file.name, backup: parsed });
        };
        reader.onerror = () => showNotification('Não foi possível ler o arquivo.', 'error');
        reader.readAsText(file);
    };

    const confirmarImportacao = async () => {
        if (!backupPendente) return;
        const data = { ...backupPendente.backup.data };

        // Completa campos ausentes (backups antigos/editados) com os padrões
        if (data.dadosEmpresa) {
            data.dadosEmpresa = {
                cadastro: { ...DADOS_EMPRESA_DEFAULT.cadastro, ...data.dadosEmpresa.cadastro },
                endereco: { ...DADOS_EMPRESA_DEFAULT.endereco, ...data.dadosEmpresa.endereco },
            };
        }

        // dadosEmpresa e permiteEstoqueNegativo vivem no backend: se fossem
        // gravados só no localStorage, a sincronização com o servidor os
        // sobrescreveria logo após o recarregamento.
        const paraServidor = {};
        if ('dadosEmpresa' in data) paraServidor.dadosEmpresa = data.dadosEmpresa;
        if ('permiteEstoqueNegativo' in data) paraServidor.permiteEstoqueNegativo = data.permiteEstoqueNegativo;
        if ('formasPagamento' in data) paraServidor.formasPagamento = data.formasPagamento;

        setImportando(true);
        try {
            if (Object.keys(paraServidor).length > 0) {
                await api.put('/configuracoes', paraServidor);
            }
        } catch (err) {
            console.error('Erro ao restaurar backup no servidor:', err);
            showNotification(err.response?.data?.error || 'Erro ao restaurar o backup no servidor. Nada foi alterado.', 'error');
            setImportando(false);
            return;
        }

        const result = StorageService.importAll({ ...backupPendente.backup, data });
        setImportando(false);
        setBackupPendente(null);
        if (!result.success) {
            showNotification(result.error, 'error');
            return;
        }
        showNotification('Backup restaurado! Recarregando...', 'success');
        setTimeout(() => window.location.reload(), 1500);
    };

    // ── Usuários ───────────────────────────────────────────────
    async function carregarUsuarios() {
        setLoadingUsuarios(true);
        try {
            const res = await api.get('/usuarios');
            const lista = Array.isArray(res.data) ? res.data : [];
            setUsuarios(lista);
            return true;
        } catch (err) {
            const msg = err?.response?.data?.error ?? 'Erro ao carregar usuários.';
            showNotification(msg, 'error');
            return false;
        } finally {
            setLoadingUsuarios(false);
        }
    }

    async function abrirModalUsuarios() {
        setViewCriar(false);
        setViewEditar(false);
        setNovoUsuario({ nome: '', email: '', senha: '', tipo: 'vendedor' });
        setErrosCriar({});
        const ok = await carregarUsuarios();
        if (ok) setModalUsuarios(true);
        else setModalUsuarios(false);
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
        } catch (err) {
            showNotification(err.response?.data?.error || 'Erro ao inativar usuário.', 'error');
        }
    }

    async function reativarUsuario(usuario) {
        try {
            await api.patch(`/usuarios/${usuario.idUsuario}`);
            showNotification('Usuário reativado com sucesso!', 'success');
            carregarUsuarios();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Erro ao reativar usuário.', 'error');
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
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoUsuario.email.trim())) e.email = 'E-mail inválido';
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
    const cadastro = empresa?.cadastro || {};
    const endereco = empresa?.endereco || {};
    const cnpjValido = Boolean(cadastro.cnpj && validarCNPJ(cadastro.cnpj));
    const empresaCompleto = Boolean(
        cadastro.razaoSocial?.trim().length >= 3 &&
        cadastro.nomeFantasia?.trim().length >= 2 &&
        cnpjValido &&
        cadastro.inscricaoEstadual?.trim()
    );

    // ── Render ──────────────────────────────────────────────────
    return (
        <div className="body-configuracoes">
            <Sidebar />
            <div className="content-configuracoes">
                <div className="title-page">
                    <h1>Configurações</h1>
                    <span>{dataAtual}</span>
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
                                        value={cadastro.razaoSocial || ''}
                                        onChange={e => handleCadastro('razaoSocial', e.target.value)}
                                        className={erros.razaoSocial ? 'input-error' : (cadastro.razaoSocial?.trim().length >= 3 ? 'input-valid' : '')}
                                    />
                                    {erros.razaoSocial && <span className="field-error">{erros.razaoSocial}</span>}
                                </div>
                                <div className="config-field">
                                    <label>Nome Fantasia <span className="required">*</span></label>
                                    <input type="text" placeholder="Nome Fantasia"
                                        value={cadastro.nomeFantasia || ''}
                                        onChange={e => handleCadastro('nomeFantasia', e.target.value)}
                                        className={erros.nomeFantasia ? 'input-error' : (cadastro.nomeFantasia?.trim().length >= 2 ? 'input-valid' : '')}
                                    />
                                    {erros.nomeFantasia && <span className="field-error">{erros.nomeFantasia}</span>}
                                </div>
                            </div>
                            <div className="config-row">
                                <div className="config-field">
                                    <label>CNPJ <span className="required">*</span></label>
                                    <input type="text" placeholder="00.000.000/0000-00"
                                        value={cadastro.cnpj || ''}
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
                                        value={cadastro.inscricaoEstadual || ''}
                                        onChange={e => handleCadastro('inscricaoEstadual', e.target.value)}
                                        className={erros.inscricaoEstadual ? 'input-error' : (cadastro.inscricaoEstadual?.trim() ? 'input-valid' : '')}
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
                                            value={endereco.cep || ''}
                                            onChange={e => handleEndereco('cep', e.target.value)}
                                        />
                                        {cepLoading && <span className="cep-spinner" />}
                                    </div>
                                </div>
                                <div className="config-field">
                                    <label>Número</label>
                                    <input type="text" placeholder="Nº"
                                        value={endereco.numero || ''}
                                        onChange={e => handleEndereco('numero', e.target.value)}
                                    />
                                </div>
                                <div className="config-field">
                                    <label>Complemento</label>
                                    <input type="text" placeholder="Sala, Bloco..."
                                        value={endereco.complemento || ''}
                                        onChange={e => handleEndereco('complemento', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="config-field">
                                <label>Logradouro</label>
                                <input type="text" placeholder="Rua, Avenida..."
                                    value={endereco.logradouro || ''}
                                    onChange={e => handleEndereco('logradouro', e.target.value)}
                                />
                            </div>
                            <div className="config-row config-row--3col">
                                <div className="config-field">
                                    <label>Bairro</label>
                                    <input type="text" placeholder="Bairro"
                                        value={endereco.bairro || ''}
                                        onChange={e => handleEndereco('bairro', e.target.value)}
                                    />
                                </div>
                                <div className="config-field">
                                    <label>Cidade</label>
                                    <input type="text" placeholder="Cidade"
                                        value={endereco.cidade || ''}
                                        onChange={e => handleEndereco('cidade', e.target.value)}
                                    />
                                </div>
                                <div className="config-field">
                                    <label>Estado</label>
                                    <input type="text" placeholder="UF" maxLength={2}
                                        value={endereco.estado || ''}
                                        onChange={e => handleEndereco('estado', e.target.value.toUpperCase())}
                                    />
                                </div>
                            </div>
                            <div className="config-row">
                                <div className="config-field">
                                    <label>País</label>
                                    <input type="text" value={endereco.pais || 'Brasil'} readOnly />
                                </div>
                            </div>

                            <div className="config-card-actions">
                                <button className="btn-primary" onClick={salvarEmpresa} disabled={salvandoEmpresa}>
                                    {salvandoEmpresa ? 'Salvando...' : 'Salvar Dados'}
                                </button>
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

                    {/* ── Formas de Pagamento ─────────────────────── */}
                    <div className="config-card">
                        <div className="config-card-header">
                            <div className="config-card-icon config-card-icon--green">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="1" y="4" width="22" height="16" rx="2" />
                                    <line x1="1" y1="10" x2="23" y2="10" />
                                </svg>
                            </div>
                            <div>
                                <h2>Formas de Pagamento</h2>
                                <p>Finalizadoras disponíveis no ponto de venda</p>
                            </div>
                        </div>
                        <div className="config-card-body">
                            <div className="config-info-box">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                <span>
                                    As formas aparecem no PDV nesta ordem, com os atalhos F1 a F{MAX_FORMAS_PAGAMENTO}. Somente &quot;Dinheiro&quot; permite troco.
                                    Excluir uma forma não altera as vendas já registradas com ela.
                                </span>
                            </div>

                            <ul className="config-formas-list">
                                {(formasPagamento || []).map(f => (
                                    <li key={f.value} className="config-forma-item">
                                        <span className="config-forma-label">{f.label}</span>
                                        <span className="config-forma-shortcut">{f.shortcut}</span>
                                        <button
                                            className={`config-forma-convenio ${f.especial === 'convenio' ? 'ativo' : ''}`}
                                            onClick={() => alternarEspecialConvenio(f)}
                                            disabled={salvandoForma}
                                            title={f.especial === 'convenio' ? 'Remover vínculo de Convênio' : 'Vincular como Convênio / Controle Interno'}
                                        >
                                            {f.especial === 'convenio' ? 'Convênio' : 'Vincular Convênio'}
                                        </button>
                                        <button
                                            className="config-forma-remove"
                                            onClick={() => setFormaParaExcluir(f)}
                                            disabled={formasPagamento.length <= 1 || salvandoForma}
                                            title={formasPagamento.length <= 1 ? 'É preciso manter ao menos uma forma de pagamento' : 'Excluir'}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                <path d="M10 11v6M14 11v6" />
                                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                            </svg>
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            <div className="config-forma-nova">
                                <div className="config-field config-forma-nova-nome">
                                    <label>Nova forma de pagamento</label>
                                    <input type="text" maxLength={40} disabled={limiteFormasAtingido}
                                        placeholder={limiteFormasAtingido ? `Limite de ${MAX_FORMAS_PAGAMENTO} formas atingido` : 'Ex: Vale Alimentação'}
                                        value={novaForma.label}
                                        onChange={e => { setNovaForma(prev => ({ ...prev, label: e.target.value })); setErroForma(''); }}
                                        onKeyDown={e => { if (e.key === 'Enter') adicionarForma(); }}
                                        className={erroForma ? 'input-error' : ''}
                                    />
                                    {erroForma && <span className="field-error">{erroForma}</span>}
                                </div>
                                <button className="btn-primary" onClick={adicionarForma} disabled={limiteFormasAtingido || salvandoForma}>
                                    {salvandoForma ? 'Salvando...' : 'Adicionar'}
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
                                    onClick={alternarEstoqueNegativo}
                                    disabled={salvandoEstoqueNegativo}
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
                                <p>Impressora do comprovante de pagamento deste computador</p>
                            </div>
                        </div>
                        <div className="config-card-body">
                            {agenteStatus === 'verificando' && (
                                <p className="config-agente-procurando">Procurando o agente de impressão neste computador...</p>
                            )}

                            {agenteStatus === 'indisponivel' && (
                                <>
                                    <div className="config-info-box config-info-box--alerta">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                            <line x1="12" y1="9" x2="12" y2="13" />
                                            <line x1="12" y1="17" x2="12.01" y2="17" />
                                        </svg>
                                        <span>
                                            O agente de impressão não está respondendo neste computador. É ele que dá acesso às impressoras
                                            do Windows e às portas COM, e sobe junto com o sistema: execute o
                                            arquivo <strong>iniciar_salestrack.bat</strong> (na pasta do SalesTrack) no computador onde a
                                            impressora está ligada e clique em &quot;Tentar novamente&quot;.
                                        </span>
                                    </div>
                                    {(configImpressora.impressora || configImpressora.portaSerial) && (
                                        <p className="config-impressora-salva">
                                            Impressora configurada:{' '}
                                            <strong>
                                                {configImpressora.tipo === 'termica_serial'
                                                    ? configImpressora.portaSerial
                                                    : configImpressora.impressora}
                                            </strong>
                                        </p>
                                    )}
                                    <div className="config-actions-row">
                                        <button className="btn-secondary" onClick={carregarDispositivos} disabled={atualizandoDispositivos}>
                                            {atualizandoDispositivos ? 'Procurando...' : 'Tentar novamente'}
                                        </button>
                                    </div>
                                </>
                            )}

                            {agenteStatus === 'conectado' && (
                                <>
                                    <div className="config-agente-status">
                                        <span className="config-agente-conectado">
                                            Agente de impressão conectado
                                            {agenteInfo?.versao ? ` (v${agenteInfo.versao})` : ''}
                                            {agenteInfo?.simulacao ? ' (modo simulação, nada é enviado à impressora)' : ''}
                                        </span>
                                        <button className="btn-secondary" onClick={carregarDispositivos} disabled={atualizandoDispositivos}>
                                            {atualizandoDispositivos ? 'Atualizando...' : 'Atualizar lista'}
                                        </button>
                                    </div>

                                    <div className="config-field">
                                        <label>Tipo de impressora</label>
                                        <select id="select-tipo-impressora" value={impressora.tipo}
                                            onChange={e => handleImpressora('tipo', e.target.value)}>
                                            <option value="termica_spooler">Térmica instalada no Windows (USB, rede...)</option>
                                            <option value="termica_serial">Térmica em porta serial (COM)</option>
                                            <option value="comum_windows">Impressora comum / A4 (driver do Windows)</option>
                                        </select>
                                    </div>

                                    {usaSpooler ? (
                                        <div className="config-field">
                                            <label>Impressora <span className="required">*</span></label>
                                            <select id="select-impressora" value={impressora.impressora}
                                                onChange={e => handleImpressora('impressora', e.target.value)}>
                                                <option value="">Selecione a impressora</option>
                                                {impressoraAusente && (
                                                    <option value={impressora.impressora}>{impressora.impressora} (não encontrada)</option>
                                                )}
                                                {(dispositivos?.impressoras || []).map(i => (
                                                    <option key={i.nome} value={i.nome}>
                                                        {i.nome}
                                                        {i.porta.length <= 20 ? ` (${i.porta})` : ''}
                                                        {i.padrao ? ', padrão do Windows' : ''}
                                                        {i.offline ? ', offline' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="config-row">
                                            <div className="config-field">
                                                <label>Porta COM <span className="required">*</span></label>
                                                <select id="select-porta-serial" value={impressora.portaSerial}
                                                    onChange={e => handleImpressora('portaSerial', e.target.value)}>
                                                    <option value="">Selecione a porta</option>
                                                    {portaAusente && (
                                                        <option value={impressora.portaSerial}>{impressora.portaSerial} (não encontrada)</option>
                                                    )}
                                                    {(dispositivos?.portasSeriais || []).map(p => (
                                                        <option key={p.porta} value={p.porta}>
                                                            {p.porta}{p.descricao ? `: ${p.descricao}` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="config-field">
                                                <label>Velocidade (baud rate)</label>
                                                <select value={impressora.baudRate}
                                                    onChange={e => handleImpressora('baudRate', Number(e.target.value))}>
                                                    {BAUD_RATES.map(b => <option key={b} value={b}>{b}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    <div className="config-row">
                                        <div className="config-field">
                                            <label>Largura do papel</label>
                                            <select value={impressora.colunas}
                                                onChange={e => handleImpressora('colunas', Number(e.target.value))}>
                                                <option value={48}>80 mm (48 colunas)</option>
                                                <option value={42}>80 mm (42 colunas)</option>
                                                <option value={32}>58 mm (32 colunas)</option>
                                            </select>
                                        </div>
                                        {impressoraTermica && (
                                            <div className="config-field">
                                                <label>Acentuação</label>
                                                <select value={impressora.acentuacao}
                                                    onChange={e => handleImpressora('acentuacao', e.target.value)}>
                                                    <option value="sem_acentos">Sem acentos (padrão)</option>
                                                    <option value="cp850">Com acentos (CP850)</option>
                                                    <option value="cp860">Com acentos (CP860)</option>
                                                </select>
                                                <span className="config-field-hint">
                                                    Se os acentos saírem trocados na página de teste, escolha outra opção.
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {impressoraTermica && (
                                        <div className="config-toggle-row config-toggle-row--campo">
                                            <div className="config-toggle-info">
                                                <span className="config-toggle-label">Cortar o papel ao final</span>
                                                <span className="config-toggle-desc">
                                                    Aciona a guilhotina depois do comprovante. Desative se a impressora não tiver guilhotina.
                                                </span>
                                            </div>
                                            <button
                                                id="toggle-cortar-papel"
                                                className={`config-toggle-btn ${impressora.cortarPapel ? 'active' : ''}`}
                                                onClick={() => handleImpressora('cortarPapel', !impressora.cortarPapel)}
                                                aria-pressed={impressora.cortarPapel}
                                                title={impressora.cortarPapel ? 'Desativar' : 'Ativar'}
                                            >
                                                <span className="config-toggle-track">
                                                    <span className="config-toggle-thumb" />
                                                </span>
                                                <span className="config-toggle-status">
                                                    {impressora.cortarPapel ? 'Ativado' : 'Desativado'}
                                                </span>
                                            </button>
                                        </div>
                                    )}

                                    <div className="config-card-actions config-card-actions--entre">
                                        <button className="btn-secondary" onClick={imprimirTeste} disabled={imprimindoTeste}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                <polyline points="6 9 6 2 18 2 18 9" />
                                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                                <rect x="6" y="14" width="12" height="8" />
                                            </svg>
                                            {imprimindoTeste ? 'Imprimindo...' : 'Imprimir Página de Teste'}
                                        </button>
                                        <div className="config-card-actions-direita">
                                            {impressoraAlterada && <span className="config-nao-salvo">Alterações não salvas</span>}
                                            <button className="btn-primary" onClick={salvarImpressora}>Salvar Configuração</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── 5. Integração Pinpad (oculto — ver EXIBIR_INTEGRACAO_PINPAD) ── */}
                    {EXIBIR_INTEGRACAO_PINPAD && (
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
                    )}

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
                                <span>O backup inclui dados da empresa, formas de pagamento e demais configurações desta tela, em arquivo JSON versionado. Não inclui produtos, clientes, vendas nem usuários.</span>
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
                closeOnOverlayClick={false}
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
                                                <button onClick={() => abrirEditar(u)} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1570EF', padding: '4px 6px', borderRadius: '6px' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                </button>
                                                {!u.ativo ? (
                                                    <button onClick={() => reativarUsuario(u)} title="Reativar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: '4px 6px', borderRadius: '6px' }}>
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                                            <polyline points="1 4 1 10 7 10" />
                                                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                                        </svg>
                                                    </button>
                                                ) : u.idUsuario !== usuarioLogado?.id && (
                                                    <button onClick={() => setUsuarioParaExcluir(u)} title="Inativar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px 6px', borderRadius: '6px' }}>
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                            <path d="M10 11v6M14 11v6" />
                                                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </Modal>

            {/* ── Modal Confirmação Exclusão de Forma de Pagamento ─ */}
            <Modal
                isOpen={!!formaParaExcluir}
                onClose={() => { if (!salvandoForma) setFormaParaExcluir(null); }}
                title="Excluir Forma de Pagamento"
                maxWidth="420px"
                footer={
                    <>
                        <button className="btn-modal-cancel" onClick={() => setFormaParaExcluir(null)} disabled={salvandoForma}>Cancelar</button>
                        <button className="btn-modal-danger" onClick={confirmarExclusaoForma} disabled={salvandoForma}>
                            {salvandoForma ? 'Excluindo...' : 'Confirmar Exclusão'}
                        </button>
                    </>
                }
            >
                <p className="confirm-message">
                    Deseja excluir a forma de pagamento <strong>{formaParaExcluir?.label}</strong>?<br />
                    Ela deixará de aparecer no PDV. As vendas já registradas com ela são mantidas.
                </p>
            </Modal>

            {/* ── Modal Confirmação Importação de Backup ────────── */}
            <Modal
                isOpen={!!backupPendente}
                onClose={() => { if (!importando) setBackupPendente(null); }}
                title="Restaurar Backup"
                maxWidth="460px"
                footer={
                    <>
                        <button className="btn-modal-cancel" onClick={() => setBackupPendente(null)} disabled={importando}>Cancelar</button>
                        <button className="btn-modal-danger" onClick={confirmarImportacao} disabled={importando}>
                            {importando ? 'Restaurando...' : 'Restaurar Backup'}
                        </button>
                    </>
                }
            >
                <p className="confirm-message">
                    Deseja restaurar o backup <strong>{backupPendente?.nomeArquivo}</strong>
                    {backupPendente?.backup?.exportedAt && !Number.isNaN(Date.parse(backupPendente.backup.exportedAt)) && (
                        <> (exportado em {new Date(backupPendente.backup.exportedAt).toLocaleString('pt-BR')})</>
                    )}?<br />
                    As configurações atuais serão substituídas pelas do arquivo, para todos os usuários do sistema.
                </p>
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
