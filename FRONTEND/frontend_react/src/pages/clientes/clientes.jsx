import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../../components/SideBar/sidebar';
import Table from '../../components/Table/Table';
import Modal from '../../components/Modal/Modal';
import FilterModal from '../../components/FilterModal/FilterModal';
import ModalConvenio from './ModalConvenio';
import api from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { formatarDataAtual } from '../../utils/data';
import { mascaraCPF, mascaraTelefone, mascaraCEP } from '../../utils/mascaras';
import './style.css';

// ── Validação CPF ─────────────────────────────────────────
function validarCPF(cpf) {
    const n = cpf.replace(/\D/g, '');
    if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
    const calc = (len) => {
        let s = 0;
        for (let i = 0; i < len; i++) s += parseInt(n[i]) * (len + 1 - i);
        const r = (s * 10) % 11;
        return r === 10 ? 0 : r;
    };
    return parseInt(n[9]) === calc(9) && parseInt(n[10]) === calc(10);
}

const formInicial = {
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    // endereço estruturado
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    observacoes: '',
    convenio: false,
    limiteConvenio: '',
};

function Clientes() {
    const dataAtual = formatarDataAtual();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalForm, setModalForm] = useState(false);
    const [modalConfirmarInativar, setModalConfirmarInativar] = useState(false);
    const [modalConvenio, setModalConvenio] = useState(false);
    const [modalHabilitarConvenio, setModalHabilitarConvenio] = useState(false);
    const [clienteSelecionado, setClienteSelecionado] = useState(null);
    const [clienteConvenio, setClienteConvenio] = useState(null);
    const [clienteParaHabilitar, setClienteParaHabilitar] = useState(null);
    const [limiteHabilitar, setLimiteHabilitar] = useState('');
    const [habilitandoConvenio, setHabilitandoConvenio] = useState(false);
    const [form, setForm] = useState(formInicial);
    const [salvando, setSalvando] = useState(false);
    const [inativando, setInativando] = useState(false);
    const [cpfErro, setCpfErro] = useState('');
    const [cepLoading, setCepLoading] = useState(false);
    const cepTimerRef = useRef(null);
    const cepAbortRef = useRef(null);

    const [modalFiltros, setModalFiltros] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ _status: 'ativo' });

    const { showNotification } = useNotification();

    const formatCurrencyStr = (num) =>
        num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handleCurrencyInput = (value, field) => {
        const onlyNums = String(value).replace(/\D/g, '');
        if (!onlyNums) { handleFormChange(field, ''); return; }
        const numeric = parseInt(onlyNums, 10) / 100;
        handleFormChange(field, formatCurrencyStr(numeric));
    };

    // ── CEP lookup ───────────────────────────────────────
    const buscarCep = useCallback((cepValue) => {
        if (cepTimerRef.current) clearTimeout(cepTimerRef.current);
        if (cepAbortRef.current) cepAbortRef.current.abort();
        const nums = cepValue.replace(/\D/g, '');
        if (nums.length !== 8) return;
        cepTimerRef.current = setTimeout(async () => {
            const controller = new AbortController();
            cepAbortRef.current = controller;
            setCepLoading(true);
            try {
                const res = await fetch(`https://viacep.com.br/ws/${nums}/json/`, { signal: controller.signal });
                const data = await res.json();
                if (data.erro) { showNotification('CEP não encontrado.', 'warning'); return; }
                setForm(prev => ({
                    ...prev,
                    logradouro: data.logradouro || '',
                    bairro: data.bairro || '',
                    cidade: data.localidade || '',
                    estado: data.uf || '',
                }));
            } catch (e) {
                if (e.name !== 'AbortError') showNotification('Não foi possível consultar o CEP.', 'error');
            } finally {
                setCepLoading(false);
            }
        }, 700);
    }, [showNotification]);

    async function carregarClientes() {
        setLoading(true);
        try {
            // Inclui inativos na API apenas quando o filtro pede ou quando quer "todos"
            const incluirInativos = activeFilters._status === 'inativo' || activeFilters._status === 'todos';
            const res = await api.get(`/clientes${incluirInativos ? '?incluir_inativos=true' : ''}`);
            setClientes(res.data);
        } catch (err) {
            console.error('Erro ao carregar clientes:', err);
            showNotification('Erro ao carregar clientes', 'error');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        carregarClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFilters._status]);

    function abrirModalNovo() {
        setClienteSelecionado(null);
        setForm(formInicial);
        setModalForm(true);
    }

    function abrirModalEditar(cliente) {
        setClienteSelecionado(cliente);
        setCpfErro('');
        setForm({
            nome: cliente.nome || '',
            cpf: cliente.cpf || '',
            telefone: cliente.telefone || '',
            email: cliente.email || '',
            cep: '',
            logradouro: cliente.endereco || '',
            numero: '',
            complemento: '',
            bairro: '',
            cidade: '',
            estado: '',
            observacoes: cliente.observacoes || '',
            convenio: cliente.convenio || false,
            limiteConvenio: cliente.limiteConvenio ? formatCurrencyStr(cliente.limiteConvenio) : '',
        });
        setModalForm(true);
    }

    function abrirConvenio(cliente) {
        setClienteConvenio(cliente);
        setModalConvenio(true);
    }

    function abrirHabilitarConvenio(cliente) {
        setClienteParaHabilitar(cliente);
        setLimiteHabilitar('');
        setModalHabilitarConvenio(true);
    }

    function handleLimiteHabilitarChange(value) {
        const onlyNums = String(value).replace(/\D/g, '');
        if (!onlyNums) { setLimiteHabilitar(''); return; }
        const numeric = parseInt(onlyNums, 10) / 100;
        setLimiteHabilitar(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }

    async function confirmarHabilitarConvenio() {
        const limiteNum = parseFloat(String(limiteHabilitar).replace(/\./g, '').replace(',', '.')) || 0;
        if (limiteNum <= 0) {
            showNotification('Informe um limite de crédito válido', 'warning');
            return;
        }
        setHabilitandoConvenio(true);
        try {
            await api.put(`/clientes/${clienteParaHabilitar.idCliente}`, {
                nome: clienteParaHabilitar.nome,
                cpf: clienteParaHabilitar.cpf || null,
                telefone: clienteParaHabilitar.telefone || null,
                email: clienteParaHabilitar.email || null,
                endereco: clienteParaHabilitar.endereco || null,
                observacoes: clienteParaHabilitar.observacoes || null,
                convenio: true,
                limiteConvenio: limiteNum,
            });
            showNotification('Convênio habilitado com sucesso!', 'success');
            setModalHabilitarConvenio(false);
            await carregarClientes();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Erro ao habilitar convênio', 'error');
        } finally {
            setHabilitandoConvenio(false);
        }
    }

    async function salvarCliente() {
        if (!form.nome.trim()) {
            showNotification('Preencha ao menos o nome do cliente', 'warning');
            return;
        }
        const cpfNums = form.cpf.replace(/\D/g, '');
        if (cpfNums.length > 0 && !validarCPF(form.cpf)) {
            showNotification('CPF inválido. Verifique o número.', 'warning');
            return;
        }

        setSalvando(true);
        try {
            const getNumericValue = (str) => {
                if (!str) return 0;
                return parseFloat(String(str).replace(/\./g, '').replace(',', '.'));
            };

            // Monta o endereço a partir dos campos estruturados
            const enderecoFinal = buildEndereco() || form.logradouro || null;

            const dados = {
                nome: form.nome.trim(),
                cpf: form.cpf || null,
                telefone: form.telefone || null,
                email: form.email || null,
                endereco: enderecoFinal,
                observacoes: form.observacoes || null,
                convenio: form.convenio,
                limiteConvenio: form.convenio ? getNumericValue(form.limiteConvenio) : null,
            };

            if (clienteSelecionado) {
                // Backend ainda não possui PUT /clientes/:id
                // Quando o backend implementar, remover este bloco try/catch interno
                try {
                    await api.put(`/clientes/${clienteSelecionado.idCliente}`, dados);
                    showNotification('Cliente atualizado com sucesso!', 'success');
                } catch (putErr) {
                    if (putErr?.response?.status === 405) {
                        showNotification(
                            'Backend ainda não suporta edição de clientes (PUT). Implemente PUT /api/clientes/:id no servidor.',
                            'warning'
                        );
                        setModalForm(false);
                        return;
                    }
                    throw putErr;
                }
            } else {
                await api.post('/clientes', dados);
                showNotification('Cliente cadastrado com sucesso!', 'success');
            }

            setModalForm(false);
            await carregarClientes();
        } catch (err) {
            console.error('Erro ao salvar cliente:', err);
            showNotification('Erro ao salvar cliente', 'error');
        } finally {
            setSalvando(false);
        }
    }

    async function inativarOuReativar() {
        if (!clienteSelecionado) return;
        setInativando(true);
        try {
            const estaAtivo = clienteSelecionado.ativo !== false && clienteSelecionado.ativo !== 0;
            if (estaAtivo) {
                // Inativar via DELETE
                await api.delete(`/clientes/${clienteSelecionado.idCliente}`);
                showNotification('Cliente inativado com sucesso!', 'success');
            } else {
                // Reativar via PATCH (seguindo padrão sugerido para produtos)
                await api.patch(`/clientes/${clienteSelecionado.idCliente}`);
                showNotification('Cliente reativado com sucesso!', 'success');
            }
            setModalConfirmarInativar(false);
            setModalForm(false);
            await carregarClientes();
        } catch (err) {
            console.error('Erro ao alterar status do cliente:', err);
            showNotification('Erro ao alterar status do cliente', 'error');
        } finally {
            setInativando(false);
        }
    }

    function handleFormChange(field, value) {
        if (field === 'cpf') {
            const masked = mascaraCPF(value);
            const nums = masked.replace(/\D/g, '');
            if (nums.length === 11) {
                setCpfErro(validarCPF(masked) ? '' : 'CPF inválido');
            } else {
                setCpfErro('');
            }
            setForm(prev => ({ ...prev, cpf: masked }));
            return;
        }
        if (field === 'telefone') {
            setForm(prev => ({ ...prev, telefone: mascaraTelefone(value) }));
            return;
        }
        if (field === 'cep') {
            const masked = mascaraCEP(value);
            setForm(prev => ({ ...prev, cep: masked }));
            buscarCep(masked);
            return;
        }
        setForm(prev => ({ ...prev, [field]: value }));
    }

    function buildEndereco() {
        const partes = [
            form.logradouro,
            form.numero   ? `Nº ${form.numero}` : '',
            form.complemento,
            form.bairro,
            form.cidade && form.estado ? `${form.cidade} - ${form.estado}` : (form.cidade || form.estado),
            form.cep      ? `CEP: ${form.cep}` : '',
        ].filter(Boolean);
        return partes.join(', ');
    }

    const estaAtivo = clienteSelecionado
        ? clienteSelecionado.ativo !== false && clienteSelecionado.ativo !== 0
        : true;

    const filterDefinitions = [
        { key: 'idCliente', label: 'ID do Cliente', type: 'text', placeholder: 'Ex: 1', exactMatch: true },
        { key: 'nome', label: 'Nome', type: 'text', placeholder: 'Nome do cliente...' },
        { key: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00', mask: 'cpf', digitsOnly: true },
        { key: 'telefone', label: 'Telefone', type: 'text', placeholder: '(00) 00000-0000', mask: 'telefone', digitsOnly: true },
        { key: 'email', label: 'Email', type: 'text', placeholder: 'email@exemplo.com' },
        {
            key: '_status',
            label: 'Status',
            type: 'select',
            defaultValue: 'ativo',
            options: [
                { value: 'ativo', label: 'Ativos' },
                { value: 'inativo', label: 'Inativos' },
                { value: 'todos', label: 'Todos' },
            ],
        },
    ];

    const columns = [
        { key: 'idCliente', label: 'ID' },
        { key: 'nome', label: 'Nome' },
        {
            key: 'cpf',
            label: 'CPF',
            render: (val) => val || '-',
        },
        {
            key: 'telefone',
            label: 'Telefone',
            render: (val) => val || '-',
        },
        {
            key: 'email',
            label: 'Email',
            render: (val) => val || '-',
        },
        {
            key: 'ativo',
            label: 'Status',
            render: (val) => (
                <span className={`badge ${val === false || val === 0 ? 'badge-danger' : 'badge-success'}`}>
                    {val === false || val === 0 ? 'Inativo' : 'Ativo'}
                </span>
            ),
        },
    ];

    return (
        <div className="body-clientes">
            <Sidebar />
            <div className="content-clientes">
                <div className="title-page">
                    <h1>Clientes</h1>
                    <span>{dataAtual}</span>
                </div>
                <div className="clientes-body">
                    <Table
                        columns={columns}
                        data={clientes}
                        loading={loading}
                        searchPlaceholder="Pesquisar por nome, CPF, telefone ou email..."
                        searchKeys={['nome', 'cpf', 'telefone', 'email']}
                        emptyMessage="Nenhum cliente cadastrado"
                        advancedFilters={filterDefinitions}
                        activeFilters={activeFilters}
                        onFilterClick={() => setModalFiltros(true)}
                        headerActions={
                            <button className="btn-primary" onClick={abrirModalNovo}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                                Novo Cliente
                            </button>
                        }
                        actions={(item) => (
                            <>
                                {item.convenio ? (
                                    <button
                                        className="btn-action btn-convenio"
                                        onClick={() => abrirConvenio(item)}
                                        title="Ver convênio do cliente"
                                    >
                                        Visualizar Convênio
                                    </button>
                                ) : (
                                    <button
                                        className="btn-action btn-habilitar-convenio"
                                        onClick={() => abrirHabilitarConvenio(item)}
                                        title="Habilitar convênio para este cliente"
                                    >
                                        Habilitar Convênio
                                    </button>
                                )}
                                <button className="btn-action" onClick={() => abrirModalEditar(item)}>
                                    Editar
                                </button>
                            </>
                        )}
                    />
                </div>

                <FilterModal
                    isOpen={modalFiltros}
                    onClose={() => setModalFiltros(false)}
                    filters={filterDefinitions}
                    activeFilters={activeFilters}
                    onApply={setActiveFilters}
                />

                {/* Modal Editar / Novo Cliente */}
                <Modal
                    isOpen={modalForm}
                    onClose={() => setModalForm(false)}
                    title={clienteSelecionado ? 'Editar Cliente' : 'Novo Cliente'}
                    onConfirm={salvarCliente}
                    closeOnOverlayClick={false}
                    footer={
                        <div className="modal-footer-split">
                            {clienteSelecionado && (
                                <button
                                    className={`btn-modal-status ${estaAtivo ? 'btn-modal-inativar' : 'btn-modal-reativar'}`}
                                    onClick={() => setModalConfirmarInativar(true)}
                                >
                                    {estaAtivo ? 'Inativar' : 'Reativar'}
                                </button>
                            )}
                            <div className="modal-footer-actions">
                                <button className="btn-modal-cancel" onClick={() => setModalForm(false)}>Cancelar</button>
                                <button className="btn-modal-confirm" onClick={salvarCliente} disabled={salvando}>
                                    {salvando ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    }
                >
                    {/* ── Dados pessoais ── */}
                    <div className="form-group">
                        <label>Nome <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="text" value={form.nome}
                            onChange={e => handleFormChange('nome', e.target.value)}
                            placeholder="Nome completo" autoFocus />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>CPF</label>
                            <input type="text" value={form.cpf}
                                onChange={e => handleFormChange('cpf', e.target.value)}
                                placeholder="000.000.000-00"
                                className={cpfErro ? 'input-error' : ''} />
                            {cpfErro && <span className="field-error">{cpfErro}</span>}
                        </div>
                        <div className="form-group">
                            <label>Telefone</label>
                            <input type="text" value={form.telefone}
                                onChange={e => handleFormChange('telefone', e.target.value)}
                                placeholder="(00) 00000-0000" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>E-mail</label>
                        <input type="email" value={form.email}
                            onChange={e => handleFormChange('email', e.target.value)}
                            placeholder="email@exemplo.com" />
                    </div>

                    {/* ── Endereço ── */}
                    <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0 10px', paddingTop: '10px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>ENDEREÇO</p>
                    </div>
                    <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div className="form-group">
                            <label>CEP</label>
                            <div style={{ position: 'relative' }}>
                                <input type="text" value={form.cep}
                                    onChange={e => handleFormChange('cep', e.target.value)}
                                    placeholder="00000-000" />
                                {cepLoading && (
                                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid #1570EF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                                )}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Número</label>
                            <input type="text" value={form.numero}
                                onChange={e => handleFormChange('numero', e.target.value)}
                                placeholder="Nº" />
                        </div>
                        <div className="form-group">
                            <label>Complemento</label>
                            <input type="text" value={form.complemento}
                                onChange={e => handleFormChange('complemento', e.target.value)}
                                placeholder="Apto, sala..." />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Logradouro</label>
                        <input type="text" value={form.logradouro}
                            onChange={e => handleFormChange('logradouro', e.target.value)}
                            placeholder="Rua, Avenida..." />
                    </div>
                    <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 80px' }}>
                        <div className="form-group">
                            <label>Bairro</label>
                            <input type="text" value={form.bairro}
                                onChange={e => handleFormChange('bairro', e.target.value)}
                                placeholder="Bairro" />
                        </div>
                        <div className="form-group">
                            <label>Cidade</label>
                            <input type="text" value={form.cidade}
                                onChange={e => handleFormChange('cidade', e.target.value)}
                                placeholder="Cidade" />
                        </div>
                        <div className="form-group">
                            <label>UF</label>
                            <input type="text" value={form.estado} maxLength={2}
                                onChange={e => handleFormChange('estado', e.target.value.toUpperCase())}
                                placeholder="UF" />
                        </div>
                    </div>

                    {/* ── Observações ── */}
                    <div className="form-group">
                        <label>Observações</label>
                        <textarea value={form.observacoes}
                            onChange={e => handleFormChange('observacoes', e.target.value)}
                            placeholder="Anotações sobre o cliente..." rows={2} />
                    </div>

                    {/* ── Seção Convênio ── */}
                    <div className="convenio-section">
                        <div className="convenio-toggle-row">
                            <div className="convenio-toggle-info">
                                <span className="convenio-toggle-label">Habilitar Convênio</span>
                                <span className="convenio-toggle-desc">
                                    Permite que o cliente compre a prazo com limite definido
                                </span>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={form.convenio}
                                    onChange={(e) => handleFormChange('convenio', e.target.checked)}
                                />
                                <span className="toggle-slider" />
                            </label>
                        </div>

                        {form.convenio && (
                            <div className="form-group convenio-limite-field">
                                <label>Limite de Crédito (R$)</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.limiteConvenio}
                                    onChange={(e) => handleCurrencyInput(e.target.value, 'limiteConvenio')}
                                    placeholder="Ex: 500,00"
                                />
                            </div>
                        )}
                    </div>

                    {/* Status atual */}
                    {clienteSelecionado && (
                        <div className={`status-indicator ${estaAtivo ? 'status-ativo' : 'status-inativo'}`}>
                            <span className="status-dot" />
                            Status atual: <strong>{estaAtivo ? 'Ativo' : 'Inativo'}</strong>
                        </div>
                    )}
                </Modal>

                {/* Modal confirmar inativar/reativar */}
                <Modal
                    isOpen={modalConfirmarInativar}
                    onClose={() => setModalConfirmarInativar(false)}
                    title={estaAtivo ? 'Inativar Cliente' : 'Reativar Cliente'}
                    maxWidth="420px"
                    onConfirm={inativarOuReativar}
                    className="modal-footer-buttons"
                    footer={
                        <>
                            <button className="btn-modal-cancel" onClick={() => setModalConfirmarInativar(false)}>
                                Cancelar
                            </button>
                            <button
                                className={estaAtivo ? 'btn-modal-inativar-confirm' : 'btn-modal-reativar-confirm'}
                                onClick={inativarOuReativar}
                                disabled={inativando}
                            >
                                {inativando ? 'Aguarde...' : estaAtivo ? 'Sim, Inativar' : 'Sim, Reativar'}
                            </button>
                        </>
                    }
                >
                    <p className="confirm-message">
                        {estaAtivo ? (
                            <>
                                Deseja inativar o cliente<br />
                                <strong>"{clienteSelecionado?.nome}"</strong>?<br />
                                Ele não aparecerá nas seleções de venda, mas poderá ser reativado.
                            </>
                        ) : (
                            <>
                                Deseja reativar o cliente<br />
                                <strong>"{clienteSelecionado?.nome}"</strong>?<br />
                                Ele voltará a aparecer normalmente.
                            </>
                        )}
                    </p>
                </Modal>

                {/* Modal Convênio */}
                <ModalConvenio
                    isOpen={modalConvenio}
                    onClose={() => { setModalConvenio(false); setClienteConvenio(null); }}
                    cliente={clienteConvenio}
                    onUpdate={carregarClientes}
                />

                {/* Modal Habilitar Convênio (atalho rápido pela tabela) */}
                <Modal
                    isOpen={modalHabilitarConvenio}
                    onClose={() => setModalHabilitarConvenio(false)}
                    title="Habilitar Convênio"
                    maxWidth="400px"
                    onConfirm={confirmarHabilitarConvenio}
                    closeOnOverlayClick={false}
                    footer={
                        <>
                            <button className="btn-modal-cancel" onClick={() => setModalHabilitarConvenio(false)}>
                                Cancelar
                            </button>
                            <button className="btn-modal-confirm" onClick={confirmarHabilitarConvenio} disabled={habilitandoConvenio}>
                                {habilitandoConvenio ? 'Salvando...' : 'Habilitar'}
                            </button>
                        </>
                    }
                >
                    <p className="confirm-message" style={{ marginBottom: 16 }}>
                        Habilitar convênio para <strong>"{clienteParaHabilitar?.nome}"</strong>
                    </p>
                    <div className="form-group">
                        <label>Limite de Crédito (R$) *</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            autoFocus
                            value={limiteHabilitar}
                            onChange={(e) => handleLimiteHabilitarChange(e.target.value)}
                            placeholder="0,00"
                        />
                    </div>
                </Modal>
            </div>
        </div>
    );
}

export default Clientes;