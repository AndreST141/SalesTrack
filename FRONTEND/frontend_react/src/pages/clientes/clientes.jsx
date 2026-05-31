import { useState, useEffect } from 'react';
import Sidebar from '../../components/SideBar/sidebar';
import Table from '../../components/Table/Table';
import Modal from '../../components/Modal/Modal';
import FilterModal from '../../components/FilterModal/FilterModal';
import ModalConvenio from './ModalConvenio';
import api from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import './style.css';

const formInicial = {
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    endereco: '',
    convenio: false,
    limiteConvenio: '',
};

function Clientes() {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalForm, setModalForm] = useState(false);
    const [modalConfirmarInativar, setModalConfirmarInativar] = useState(false);
    const [modalConvenio, setModalConvenio] = useState(false);
    const [clienteSelecionado, setClienteSelecionado] = useState(null);
    const [clienteConvenio, setClienteConvenio] = useState(null);
    const [form, setForm] = useState(formInicial);
    const [salvando, setSalvando] = useState(false);
    const [inativando, setInativando] = useState(false);

    const [modalFiltros, setModalFiltros] = useState(false);
    // Padrão: exibir somente ativos
    const [activeFilters, setActiveFilters] = useState({ _status: 'ativo' });

    const { showNotification } = useNotification();

    const fmtCurrency = (val) =>
        Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const formatCurrencyStr = (num) => {
        return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleCurrencyInput = (value, field) => {
        const onlyNums = String(value).replace(/\D/g, '');
        if (!onlyNums) {
            handleFormChange(field, '');
            return;
        }
        const numeric = parseInt(onlyNums, 10) / 100;
        handleFormChange(field, formatCurrencyStr(numeric));
    };

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
        setForm({
            nome: cliente.nome || '',
            cpf: cliente.cpf || '',
            telefone: cliente.telefone || '',
            email: cliente.email || '',
            endereco: cliente.endereco || '',
            convenio: cliente.convenio || false,
            limiteConvenio: cliente.limiteConvenio ? formatCurrencyStr(cliente.limiteConvenio) : '',
        });
        setModalForm(true);
    }

    function abrirConvenio(cliente) {
        setClienteConvenio(cliente);
        setModalConvenio(true);
    }

    async function salvarCliente() {
        if (!form.nome) {
            showNotification('Preencha ao menos o nome do cliente', 'warning');
            return;
        }

        setSalvando(true);
        try {
            const getNumericValue = (str) => {
                if (!str) return 0;
                return parseFloat(String(str).replace(/\./g, '').replace(',', '.'));
            };

            const dados = {
                nome: form.nome,
                cpf: form.cpf || null,
                telefone: form.telefone || null,
                email: form.email || null,
                endereco: form.endereco || null,
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
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    const estaAtivo = clienteSelecionado
        ? clienteSelecionado.ativo !== false && clienteSelecionado.ativo !== 0
        : true;

    const filterDefinitions = [
        { key: 'idCliente', label: 'ID do Cliente', type: 'text', placeholder: 'Ex: 1' },
        { key: 'nome', label: 'Nome', type: 'text', placeholder: 'Nome do cliente...' },
        { key: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00' },
        {
            key: '_status',
            label: 'Status',
            type: 'select',
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
                                + Novo Cliente
                            </button>
                        }
                        actions={(item) => (
                            <>
                                <button className="btn-action" onClick={() => abrirModalEditar(item)}>
                                    Editar
                                </button>
                                {item.convenio && (
                                    <button
                                        className="btn-action btn-convenio"
                                        onClick={() => abrirConvenio(item)}
                                        title="Ver convênio do cliente"
                                    >
                                        🤝 Convênio
                                    </button>
                                )}
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
                    <div className="form-group">
                        <label>Nome *</label>
                        <input
                            type="text"
                            value={form.nome}
                            onChange={(e) => handleFormChange('nome', e.target.value)}
                            placeholder="Nome completo"
                        />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>CPF</label>
                            <input
                                type="text"
                                value={form.cpf}
                                onChange={(e) => handleFormChange('cpf', e.target.value)}
                                placeholder="000.000.000-00"
                            />
                        </div>
                        <div className="form-group">
                            <label>Telefone</label>
                            <input
                                type="text"
                                value={form.telefone}
                                onChange={(e) => handleFormChange('telefone', e.target.value)}
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => handleFormChange('email', e.target.value)}
                            placeholder="email@exemplo.com"
                        />
                    </div>
                    <div className="form-group">
                        <label>Endereço</label>
                        <textarea
                            value={form.endereco}
                            onChange={(e) => handleFormChange('endereco', e.target.value)}
                            placeholder="Endereço completo"
                            rows={2}
                        />
                    </div>

                    {/* ── Seção Convênio ── */}
                    <div className="convenio-section">
                        <div className="convenio-toggle-row">
                            <div className="convenio-toggle-info">
                                <span className="convenio-toggle-label">🤝 Habilitar Convênio</span>
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
            </div>
        </div>
    );
}

export default Clientes;