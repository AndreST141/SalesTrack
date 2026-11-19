import { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/SideBar/sidebar';
import Table from '../../components/Table/Table';
import Modal from '../../components/Modal/Modal';
import FilterModal from '../../components/FilterModal/FilterModal';
import api from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { formatarDataAtual } from '../../utils/data';
import './style.css';

const DESCRICAO_RESUMIDA_MAX = 30;

// Mesmo range da coluna margemLucro DECIMAL(6,2) no banco — travar aqui evita
// mandar um valor que o backend vai rejeitar (ex: custo quase zero + venda
// alta, calculado com a base interna de 0,01). Usa 9999.9 (não 9999.99)
// porque o valor é exibido com toFixed(1): arredondar 9999.99 pra 1 casa
// decimal dá "10000.0", que estouraria o limite de novo.
const MARGEM_LUCRO_MAX = 9999.9;
const clampMargem = (num) => Math.max(-MARGEM_LUCRO_MAX, Math.min(MARGEM_LUCRO_MAX, num));

const UNIDADES_MEDIDA = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT', 'DZ', 'M', 'PAR'];

const formInicial = {
    codigoBarras: '',
    nome: '',
    descricaoResumida: '',
    unidadeMedida: 'UN',
    precoCusto: '',
    margemLucro: '',
    preco: '',
    estoque: '',
    estoqueMinimo: '10',
    idCategoria: '',
};

function formatPreco(value) {
    const onlyNums = String(value).replace(/\D/g, '');
    if (!onlyNums) return '';
    const numeric = parseInt(onlyNums, 10) / 100;
    return numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePreco(str) {
    return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
}

function numToMoedaStr(num) {
    return (Number(num) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Produtos() {
    const dataAtual = formatarDataAtual();
    const [produtos, setProdutos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalForm, setModalForm] = useState(false);
    const [modalConfirmarInativar, setModalConfirmarInativar] = useState(false);
    const [produtoSelecionado, setProdutoSelecionado] = useState(null);
    const [form, setForm] = useState(formInicial);
    const [salvando, setSalvando] = useState(false);
    const [inativando, setInativando] = useState(false);
    const [gerandoCodigo, setGerandoCodigo] = useState(false);

    const [mostrarNovaCategoria, setMostrarNovaCategoria] = useState(false);
    const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
    const [criandoCategoria, setCriandoCategoria] = useState(false);
    const [modalExcluirCategoria, setModalExcluirCategoria] = useState(false);
    const [excluindoCategoria, setExcluindoCategoria] = useState(false);

    const descricaoResumidaRef = useRef(null);
    const precoCustoRef = useRef(null);
    const margemRef = useRef(null);
    const precoVendaRef = useRef(null);
    const estoqueRef = useRef(null);
    const estoqueMinimoRef = useRef(null);

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
        setMostrarNovaCategoria(false);
        setNovaCategoriaNome('');
        setModalForm(true);
    }

    function abrirModalEditar(produto) {
        setProdutoSelecionado(produto);
        setForm({
            codigoBarras: produto.codigoBarras || '',
            nome: produto.nome || '',
            descricaoResumida: produto.descricaoResumida || '',
            unidadeMedida: produto.unidadeMedida || 'UN',
            precoCusto: produto.precoCusto ? parseFloat(produto.precoCusto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
            margemLucro: produto.margemLucro != null ? Number(produto.margemLucro).toFixed(1) : '',
            preco: produto.preco ? parseFloat(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
            estoque: produto.estoque ?? '',
            estoqueMinimo: produto.estoqueMinimo ?? '10',
            idCategoria: produto.idCategoria || '',
        });
        setMostrarNovaCategoria(false);
        setNovaCategoriaNome('');
        setModalForm(true);
    }

    async function salvarProduto() {
        const precoNum = parsePreco(form.preco);
        if (!form.codigoBarras.trim()) {
            showNotification('Preencha o código de barras', 'warning');
            return;
        }
        if (!form.nome.trim() || precoNum <= 0) {
            showNotification('Preencha a descrição e um preço de venda válido (maior que zero)', 'warning');
            return;
        }

        setSalvando(true);
        try {
            const idCategoriaFinal = form.idCategoria
                || categorias.find(c => c.nome === 'Geral')?.idCategoria
                || null;

            const dados = {
                codigoBarras: form.codigoBarras.trim(),
                nome: form.nome,
                descricaoResumida: form.descricaoResumida || null,
                unidadeMedida: form.unidadeMedida || 'UN',
                preco: precoNum,
                precoCusto: form.precoCusto ? parsePreco(form.precoCusto) : null,
                margemLucro: form.margemLucro ? parseFloat(String(form.margemLucro).replace(',', '.')) : null,
                estoque: parseInt(form.estoque) || 0,
                estoqueMinimo: form.estoqueMinimo !== '' ? parseInt(form.estoqueMinimo) : 10,
                idCategoria: idCategoriaFinal,
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
            showNotification(err.response?.data?.error || 'Erro ao salvar produto', 'error');
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

    function handleDescricaoKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            setForm((prev) => ({
                ...prev,
                descricaoResumida: prev.nome.trim().slice(0, DESCRICAO_RESUMIDA_MAX),
            }));
            descricaoResumidaRef.current?.focus();
        }
    }

    function handleEnterFoco(proximoRef) {
        return (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            e.stopPropagation();
            proximoRef.current?.focus();
        };
    }

    function handleEnterSalvar(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        salvarProduto();
    }

    function handlePrecoCustoChange(value) {
        const formatted = formatPreco(value);
        setForm((prev) => {
            const custo = parsePreco(formatted);
            if (prev.margemLucro) {
                const margem = parseFloat(String(prev.margemLucro).replace(',', '.')) || 0;
                return { ...prev, precoCusto: formatted, preco: numToMoedaStr(custo * (1 + margem / 100)) };
            }
            if (prev.preco && custo > 0) {
                const venda = parsePreco(prev.preco);
                const novaMargem = clampMargem(((venda - custo) / custo) * 100);
                return { ...prev, precoCusto: formatted, margemLucro: novaMargem.toFixed(1) };
            }
            return { ...prev, precoCusto: formatted };
        });
    }

    function handleMargemChange(value) {
        const limpo = value.replace(/[^0-9,.-]/g, '');
        setForm((prev) => {
            const custo = parsePreco(prev.precoCusto);
            const margem = parseFloat(limpo.replace(',', '.')) || 0;
            if (custo > 0) {
                return { ...prev, margemLucro: limpo, preco: numToMoedaStr(custo * (1 + margem / 100)) };
            }
            return { ...prev, margemLucro: limpo };
        });
    }

    function handlePrecoVendaChange(value) {
        const formatted = formatPreco(value);
        setForm((prev) => {
            if (!formatted) {
                return { ...prev, preco: '', margemLucro: '' };
            }
            const custoReal = parsePreco(prev.precoCusto);
            // Sem custo definido, usa 0,01 só para o cálculo (nunca escreve
            // isso no campo Preço de Custo) pra evitar divisão por zero
            // (Infinity) e ainda assim mostrar uma margem coerente.
            const custoCalculo = custoReal > 0 ? custoReal : 0.01;
            const venda = parsePreco(formatted);
            const novaMargem = clampMargem(((venda - custoCalculo) / custoCalculo) * 100);
            return { ...prev, preco: formatted, margemLucro: novaMargem.toFixed(1) };
        });
    }

    async function gerarCodigoBarras() {
        setGerandoCodigo(true);
        try {
            const res = await api.get('/produtos/gerar-codigo-barras');
            setForm((prev) => ({ ...prev, codigoBarras: res.data.codigoBarras }));
        } catch (err) {
            console.error('Erro ao gerar código de barras:', err);
            showNotification('Erro ao gerar código de barras', 'error');
        } finally {
            setGerandoCodigo(false);
        }
    }

    async function criarCategoria() {
        const nome = novaCategoriaNome.trim();
        if (!nome) {
            showNotification('Digite o nome da nova categoria', 'warning');
            return;
        }
        setCriandoCategoria(true);
        try {
            const res = await api.post('/categorias', { nome });
            const resCategorias = await api.get('/categorias');
            setCategorias(resCategorias.data);
            handleFormChange('idCategoria', res.data.id);
            setMostrarNovaCategoria(false);
            setNovaCategoriaNome('');
            showNotification('Categoria criada com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao criar categoria:', err);
            showNotification(err.response?.data?.error || 'Erro ao criar categoria', 'error');
        } finally {
            setCriandoCategoria(false);
        }
    }

    async function confirmarExcluirCategoria() {
        if (!form.idCategoria) return;
        setExcluindoCategoria(true);
        try {
            await api.delete(`/categorias/${form.idCategoria}`);
            const resCategorias = await api.get('/categorias');
            setCategorias(resCategorias.data);
            handleFormChange('idCategoria', '');
            setModalExcluirCategoria(false);
            showNotification('Categoria excluída com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao excluir categoria:', err);
            showNotification(err.response?.data?.error || 'Erro ao excluir categoria', 'error');
        } finally {
            setExcluindoCategoria(false);
        }
    }

    const estaAtivo = produtoSelecionado
        ? produtoSelecionado.ativo !== false && produtoSelecionado.ativo !== 0
        : true;

    const filterDefinitions = [
        { key: 'idProduto', label: 'ID do Produto', type: 'text', placeholder: 'Ex: 1', exactMatch: true },
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
            defaultValue: 'ativo',
            options: [
                { value: 'ativo', label: 'Ativos' },
                { value: 'inativo', label: 'Inativos' },
                { value: 'todos', label: 'Todos' },
            ],
        },
    ];

    const columns = [
        { key: 'idProduto', label: 'ID' },
        { key: 'nome', label: 'Descrição' },
        {
            key: 'codigoBarras',
            label: 'Código',
            render: (val) => val || '-',
        },
        {
            key: 'categoriaNome',
            label: 'Categoria',
            render: (val) => val || 'Geral',
        },
        {
            key: 'preco',
            label: 'Preço',
            render: (val) => fmt(val),
        },
        {
            key: 'estoque',
            label: 'Estoque',
            render: (val, item) => {
                const minimo = item.estoqueMinimo ?? 10;
                return (
                    <span className={`badge ${val < 0 ? 'badge-danger' : val < minimo ? 'badge-warning' : 'badge-success'}`}>
                        {val}
                    </span>
                );
            },
        },
        {
            key: 'unidadeMedida',
            label: 'Unidade',
            render: (val) => val || 'UN',
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
                    <span>{dataAtual}</span>
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
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                                Novo Produto
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
                    maxWidth="760px"
                    closeOnOverlayClick={false}
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
                    {/* Linha 1: Código de Barras */}
                    <div className="form-group">
                        <label>Código de Barras *</label>
                        <div className="campo-codigo-barras">
                            <input
                                type="text"
                                className="input-codigo-barras"
                                value={form.codigoBarras}
                                onChange={(e) => handleFormChange('codigoBarras', e.target.value)}
                                placeholder="Digite ou gere um código"
                            />
                            <button
                                type="button"
                                className="btn-gerar-codigo"
                                onClick={gerarCodigoBarras}
                                disabled={gerandoCodigo}
                                title="Gerar código automaticamente"
                            >
                                {gerandoCodigo ? (
                                    '...'
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 20 15 9" />
                                        <path d="M17 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
                                        <path d="M20 9l.6 1.4L22 11l-1.4.6L20 13l-.6-1.4L18 11l1.4-.6z" />
                                        <path d="M7 3l.8 1.8L10 5.6l-2.2.8L7 8.4l-.8-2L4 5.6l2.2-.8z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Linha 2: Descrição, Descrição Resumida, Unidade */}
                    <div className="linha-descricao">
                        <div className="form-group campo-descricao">
                            <label>Descrição *</label>
                            <input
                                type="text"
                                value={form.nome}
                                onChange={(e) => handleFormChange('nome', e.target.value)}
                                onKeyDown={handleDescricaoKeyDown}
                                placeholder="Nome completo do produto"
                            />
                        </div>
                        <div className="form-group campo-descricao">
                            <label>Descrição Resumida</label>
                            <input
                                type="text"
                                ref={descricaoResumidaRef}
                                value={form.descricaoResumida}
                                onChange={(e) => handleFormChange('descricaoResumida', e.target.value)}
                                onKeyDown={handleEnterFoco(precoCustoRef)}
                                placeholder="Aparece na venda e no cupom"
                                maxLength={DESCRICAO_RESUMIDA_MAX}
                            />
                        </div>
                        <div className="form-group campo-unidade">
                            <label>Unidade</label>
                            <select
                                value={form.unidadeMedida}
                                onChange={(e) => handleFormChange('unidadeMedida', e.target.value)}
                            >
                                {UNIDADES_MEDIDA.map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Linha 3: Preço de Custo, Margem de Lucro, Preço de Venda */}
                    <div className="form-row-3">
                        <div className="form-group">
                            <label>Preço de Custo</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                ref={precoCustoRef}
                                value={form.precoCusto}
                                onChange={(e) => handlePrecoCustoChange(e.target.value)}
                                onKeyDown={handleEnterFoco(margemRef)}
                                placeholder="0,00"
                            />
                        </div>
                        <div className="form-group">
                            <label>Margem de Lucro (%)</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                ref={margemRef}
                                value={form.margemLucro}
                                onChange={(e) => handleMargemChange(e.target.value)}
                                onKeyDown={handleEnterFoco(precoVendaRef)}
                                placeholder="Ex: 30"
                            />
                        </div>
                        <div className="form-group">
                            <label>Preço de Venda *</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                ref={precoVendaRef}
                                value={form.preco}
                                onChange={(e) => handlePrecoVendaChange(e.target.value)}
                                onKeyDown={handleEnterFoco(estoqueRef)}
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    {/* Linha 4: Estoque, Estoque Mínimo */}
                    <div className="linha-estoque">
                        <div className="form-group campo-estoque">
                            <label>Estoque</label>
                            <input
                                type="number"
                                ref={estoqueRef}
                                value={form.estoque}
                                onChange={(e) => handleFormChange('estoque', e.target.value)}
                                onKeyDown={handleEnterFoco(estoqueMinimoRef)}
                                placeholder="0"
                            />
                        </div>
                        <div className="form-group campo-estoque">
                            <label>Estoque Mínimo</label>
                            <input
                                type="number"
                                min="0"
                                ref={estoqueMinimoRef}
                                value={form.estoqueMinimo}
                                onChange={(e) => handleFormChange('estoqueMinimo', e.target.value)}
                                onKeyDown={handleEnterSalvar}
                                placeholder="10"
                            />
                        </div>
                    </div>

                    {/* Linha 5: Categoria */}
                    <div className="form-group">
                        <label>Categoria</label>
                        <div className="linha-categoria">
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
                            <button
                                type="button"
                                className="btn-nova-categoria"
                                onClick={() => setMostrarNovaCategoria((v) => !v)}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                                Nova Categoria
                            </button>
                            <button
                                type="button"
                                className="btn-excluir-categoria"
                                onClick={() => setModalExcluirCategoria(true)}
                                disabled={!form.idCategoria || categorias.find((c) => String(c.idCategoria) === String(form.idCategoria))?.nome === 'Geral'}
                                title={
                                    !form.idCategoria
                                        ? 'Selecione uma categoria para excluir'
                                        : categorias.find((c) => String(c.idCategoria) === String(form.idCategoria))?.nome === 'Geral'
                                            ? 'A categoria "Geral" não pode ser excluída'
                                            : 'Excluir a categoria selecionada'
                                }
                            >
                                Excluir Categoria
                            </button>
                        </div>
                        {mostrarNovaCategoria && (
                            <div className="categoria-nova-row">
                                <input
                                    type="text"
                                    value={novaCategoriaNome}
                                    onChange={(e) => setNovaCategoriaNome(e.target.value)}
                                    placeholder="Nome da nova categoria"
                                />
                                <button type="button" onClick={criarCategoria} disabled={criandoCategoria}>
                                    {criandoCategoria ? 'Criando...' : 'Criar'}
                                </button>
                            </div>
                        )}
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

                {/* Modal confirmar exclusão de categoria */}
                <Modal
                    className="modal-footer-buttons"
                    isOpen={modalExcluirCategoria}
                    onClose={() => setModalExcluirCategoria(false)}
                    title="Excluir Categoria"
                    maxWidth="420px"
                    onConfirm={confirmarExcluirCategoria}
                    footer={
                        <>
                            <button className="btn-modal-cancel" onClick={() => setModalExcluirCategoria(false)}>
                                Cancelar
                            </button>
                            <button
                                className="btn-modal-danger"
                                onClick={confirmarExcluirCategoria}
                                disabled={excluindoCategoria}
                            >
                                {excluindoCategoria ? 'Excluindo...' : 'Sim, Excluir'}
                            </button>
                        </>
                    }
                >
                    <p className="confirm-message">
                        Deseja excluir a categoria<br />
                        <strong>"{categorias.find((c) => String(c.idCategoria) === String(form.idCategoria))?.nome}"</strong>?<br />
                        Só é possível excluir categorias sem produtos vinculados.
                    </p>
                </Modal>
            </div>
        </div>
    );
}

export default Produtos;
