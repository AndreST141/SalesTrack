import { useState, useEffect } from 'react';
import Sidebar from '../../components/SideBar/sidebar';
import Table from '../../components/Table/Table';
import Modal from '../../components/Modal/Modal';
import FilterModal from '../../components/FilterModal/FilterModal';
import api from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import './style.css';

const formInicial = {
    nome: '',
    descricao: '',
    preco: '',
    estoque: '',
    idCategoria: '',
    codigoBarras: '',
};

function Produtos() {
    const [produtos, setProdutos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalForm, setModalForm] = useState(false);
    const [modalConfirmarInativar, setModalConfirmarInativar] = useState(false);
    const [produtoSelecionado, setProdutoSelecionado] = useState(null);
    const [form, setForm] = useState(formInicial);
    const [salvando, setSalvando] = useState(false);
    const [inativando, setInativando] = useState(false);

    const [modalFiltros, setModalFiltros] = useState(false);
    // Padrão: exibir somente ativos
    const [activeFilters, setActiveFilters] = useState({ _status: 'ativo' });

    const { showNotification } = useNotification();

    const fmt = (val) =>
        Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    async function carregarDados() {
        setLoading(true);
        try {
            // Inclui inativos na API apenas quando o filtro pede ou quando quer "todos"
            const incluirInativos = activeFilters._status === 'inativo' || activeFilters._status === 'todos';

            const [resProdutos, resCategorias] = await Promise.all([
                api.get(`/produtos${incluirInativos ? '?incluir_inativos=true' : ''}`),
                api.get('/categorias'),
            ]);
            setProdutos(resProdutos.data);
            setCategorias(resCategorias.data);
        } catch (err) {
            console.error('Erro ao carregar produtos:', err);
            showNotification('Erro ao carregar produtos', 'error');
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        carregarDados();
    }, [activeFilters._status]);

    function abrirModalNovo() {
        setProdutoSelecionado(null);
        setForm(formInicial);
        setModalForm(true);
    }

    function abrirModalEditar(produto) {
        setProdutoSelecionado(produto);
        setForm({
            nome: produto.nome || '',
            descricao: produto.descricao || '',
            preco: produto.preco || '',
            estoque: produto.estoque || '',
            idCategoria: produto.idCategoria || '',
            codigoBarras: produto.codigoBarras || '',
        });
        setModalForm(true);
    }

    async function salvarProduto() {
        if (!form.nome || !form.preco) {
            showNotification('Preencha ao menos o nome e o preço', 'warning');
            return;
        }

        setSalvando(true);
        try {
            const dados = {
                nome: form.nome,
                descricao: form.descricao || '',
                preco: parseFloat(form.preco),
                estoque: parseInt(form.estoque) || 0,
                idCategoria: form.idCategoria || null,
                codigoBarras: form.codigoBarras || null,
            };

            if (produtoSelecionado) {
                await api.put(`/produtos/${produtoSelecionado.idProduto}`, dados);
                showNotification('Produto atualizado com sucesso!', 'success');
            } else {
                await api.post('/produtos', dados);
                showNotification('Produto cadastrado com sucesso!', 'success');
            }

            setModalForm(false);
            await carregarDados();
        } catch (err) {
            console.error('Erro ao salvar produto:', err);
            showNotification('Erro ao salvar produto', 'error');
        } finally {
            setSalvando(false);
        }
    }

    async function inativarOuReativar() {
        if (!produtoSelecionado) return;
        setInativando(true);
        try {
            const estaAtivo = produtoSelecionado.ativo !== false && produtoSelecionado.ativo !== 0;
            if (estaAtivo) {
                // Inativar via DELETE (soft delete)
                await api.delete(`/produtos/${produtoSelecionado.idProduto}`);
                showNotification('Produto inativado com sucesso!', 'success');
            } else {
                // Reativar via PATCH (conforme instrução)
                await api.patch(`/produtos/${produtoSelecionado.idProduto}`);
                showNotification('Produto reativado com sucesso!', 'success');
            }
            setModalConfirmarInativar(false);
            setModalForm(false);
            await carregarDados();
        } catch (err) {
            console.error('Erro ao alterar status do produto:', err);
            showNotification('Erro ao alterar status do produto', 'error');
        } finally {
            setInativando(false);
        }
    }

    function handleFormChange(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    const estaAtivo = produtoSelecionado
        ? produtoSelecionado.ativo !== false && produtoSelecionado.ativo !== 0
        : true;

    const filterDefinitions = [
        { key: 'idProduto', label: 'ID do Produto', type: 'text', placeholder: 'Ex: 1' },
        { key: 'nome', label: 'Nome', type: 'text', placeholder: 'Nome do produto...' },
        {
            key: 'categoriaNome',
            label: 'Categoria',
            type: 'select',
            options: categorias.map((c) => ({ value: c.nome, label: c.nome })),
        },
        {
            key: '_estoqueStatus',
            label: 'Estoque',
            type: 'select',
            options: [
                { value: 'positivo', label: 'Estoque Positivo' },
                { value: 'zero', label: 'Estoque Zerado' },
                { value: 'negativo', label: 'Estoque Negativo' },
            ],
        },
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
        { key: 'idProduto', label: 'ID' },
        { key: 'nome', label: 'Nome' },
        {
            key: 'categoriaNome',
            label: 'Categoria',
            render: (val) => val || '-',
        },
        {
            key: 'preco',
            label: 'Preço',
            render: (val) => fmt(val),
        },
        {
            key: 'estoque',
            label: 'Estoque',
            render: (val) => (
                <span className={`badge ${val < 0 ? 'badge-danger' : val < 10 ? 'badge-warning' : 'badge-success'}`}>
                    {val}
                </span>
            ),
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
        <div className="body-produtos">
            <Sidebar />
            <div className="content-produtos">
                <div className="title-page">
                    <h1>Produtos</h1>
                </div>
                <div className="produtos-body">
                    <Table
                        columns={columns}
                        data={produtos}
                        loading={loading}
                        searchPlaceholder="Pesquisar por nome, categoria ou código de barras..."
                        searchKeys={['nome', 'categoriaNome', 'codigoBarras']}
                        emptyMessage="Nenhum produto cadastrado"
                        advancedFilters={filterDefinitions}
                        activeFilters={activeFilters}
                        onFilterClick={() => setModalFiltros(true)}
                        headerActions={
                            <button className="btn-primary" onClick={abrirModalNovo}>
                                + Novo Produto
                            </button>
                        }
                        actions={(item) => (
                            <button className="btn-action" onClick={() => abrirModalEditar(item)}>
                                Editar
                            </button>
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

                {/* Modal Editar / Novo Produto */}
                <Modal
                    isOpen={modalForm}
                    onClose={() => setModalForm(false)}
                    title={produtoSelecionado ? 'Editar Produto' : 'Novo Produto'}
                    onConfirm={salvarProduto}
                    // className='modal-footer-buttons'
                    footer={
                        <div className="modal-footer-split">
                            {/* Lado esquerdo: inativar/reativar (somente ao editar) */}
                            {produtoSelecionado && (
                                <button
                                    className={`btn-modal-status ${estaAtivo ? 'btn-modal-inativar' : 'btn-modal-reativar'}`}
                                    onClick={() => setModalConfirmarInativar(true)}
                                >
                                    {estaAtivo ? 'Inativar' : 'Reativar'}
                                </button>
                            )}
                            {/* Lado direito: cancelar + salvar */}
                            <div className="modal-footer-actions">
                                <button className="btn-modal-cancel" onClick={() => setModalForm(false)}>Cancelar</button>
                                <button className="btn-modal-confirm" onClick={salvarProduto} disabled={salvando}>
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
                            placeholder="Nome do produto"
                        />
                    </div>
                    <div className="form-group">
                        <label>Descrição</label>
                        <textarea
                            value={form.descricao}
                            onChange={(e) => handleFormChange('descricao', e.target.value)}
                            placeholder="Descrição do produto"
                            rows={3}
                        />
                    </div>
                    <div className="form-row-3">
                        <div className="form-group">
                            <label>Preço *</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.preco}
                                onChange={(e) => handleFormChange('preco', e.target.value)}
                                placeholder="0,00"
                            />
                        </div>
                        <div className="form-group">
                            <label>Estoque</label>
                            <input
                                type="number"
                                value={form.estoque}
                                onChange={(e) => handleFormChange('estoque', e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <div className="form-group">
                            <label>Categoria</label>
                            <select
                                value={form.idCategoria}
                                onChange={(e) => handleFormChange('idCategoria', e.target.value)}
                            >
                                <option value="">Selecione</option>
                                {categorias.map((cat) => (
                                    <option key={cat.idCategoria} value={cat.idCategoria}>
                                        {cat.nome}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Código de Barras</label>
                        <input
                            type="text"
                            value={form.codigoBarras}
                            onChange={(e) => handleFormChange('codigoBarras', e.target.value)}
                            placeholder="Ex: 7891234567890"
                        />
                    </div>

                    {/* Indicador de status atual */}
                    {produtoSelecionado && (
                        <div className={`status-indicator ${estaAtivo ? 'status-ativo' : 'status-inativo'}`}>
                            <span className="status-dot" />
                            Status atual: <strong>{estaAtivo ? 'Ativo' : 'Inativo'}</strong>
                        </div>
                    )}
                </Modal>

                {/* Modal confirmar inativar/reativar */}
                <Modal
                    className="modal-footer-buttons"
                    isOpen={modalConfirmarInativar}
                    onClose={() => setModalConfirmarInativar(false)}
                    title={estaAtivo ? 'Inativar Produto' : 'Reativar Produto'}
                    maxWidth="420px"
                    onConfirm={inativarOuReativar}
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
                                Deseja inativar o produto<br />
                                <strong>"{produtoSelecionado?.nome}"</strong>?<br />
                                Ele não aparecerá nas vendas, mas poderá ser reativado.
                            </>
                        ) : (
                            <>
                                Deseja reativar o produto<br />
                                <strong>"{produtoSelecionado?.nome}"</strong>?<br />
                                Ele voltará a aparecer nas vendas normalmente.
                            </>
                        )}
                    </p>
                </Modal>
            </div>
        </div>
    );
}

export default Produtos;