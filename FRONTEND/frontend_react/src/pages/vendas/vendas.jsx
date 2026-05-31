import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../../components/SideBar/sidebar';
import Modal from '../../components/Modal/Modal';
import api from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useConfig } from '../../contexts/ConfigContext';
import './style.css';

function normalizeStr(str) {
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function Vendas() {
    const { formasPagamento, permiteEstoqueNegativo } = useConfig();

    const [produtos, setProdutos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [itensVenda, setItensVenda] = useState([]);
    const [termoBusca, setTermoBusca] = useState('');
    const [quantidade, setQuantidade] = useState(1);
    const [sugestoes, setSugestoes] = useState([]);
    const [desconto, setDesconto] = useState('');
    const [acrescimo, setAcrescimo] = useState('');
    const [cpfNota, setCpfNota] = useState('');
    const [clienteId, setClienteId] = useState('');
    const [finalizando, setFinalizando] = useState(false);

    const [pagamentos, setPagamentos] = useState([]);
    const [pagamentoForma, setPagamentoForma] = useState('');
    const [pagamentoValor, setPagamentoValor] = useState('');

    const [modalDesconto, setModalDesconto] = useState(false);
    const [modalAcrescimo, setModalAcrescimo] = useState(false);
    const [modalCpf, setModalCpf] = useState(false);
    const [modalPagamento, setModalPagamento] = useState(false);
    const [modalTroco, setModalTroco] = useState(false);
    const [valorTroco, setValorTroco] = useState(0);
    const [modalCancelarVenda, setModalCancelarVenda] = useState(false);
    const [modalCancelarItem, setModalCancelarItem] = useState(false);
    const [itemParaCancelar, setItemParaCancelar] = useState(null);

    const [pagamentoIndex, setPagamentoIndex] = useState(0);

    // Convênio
    const [buscaConvenio, setBuscaConvenio] = useState('');
    const [clienteConvenioSelecionado, setClienteConvenioSelecionado] = useState(null);
    const [sugestoesConvenio, setSugestoesConvenio] = useState([]);

    const inputBarcodeRef = useRef(null);
    const inputDescontoRef = useRef(null);
    const inputAcrescimoRef = useRef(null);
    const inputCpfRef = useRef(null);
    const inputPagamentoValorRef = useRef(null);
    const inputConvenioRef = useRef(null);
    const { showNotification } = useNotification();

    const formaAtiva = formasPagamento[pagamentoIndex] || formasPagamento[0];
    const isConvenio = pagamentoForma === 'convenio';

    // Inicializar forma padrão quando formasPagamento carrega
    useEffect(() => {
        if (formasPagamento.length > 0 && !pagamentoForma) {
            setPagamentoForma(formasPagamento[0].value);
        }
    }, [formasPagamento]);

    const fmt = (val) =>
        Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const formatCurrencyStr = (num) => {
        return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleCurrencyInput = (value, setter) => {
        const onlyNums = String(value).replace(/\D/g, '');
        if (!onlyNums) {
            setter('');
            return;
        }
        const numeric = parseInt(onlyNums, 10) / 100;
        setter(formatCurrencyStr(numeric));
    };

    const getNumericValue = (str) => {
        if (!str) return 0;
        return parseFloat(String(str).replace(/\./g, '').replace(',', '.'));
    };
    const subtotal = itensVenda.reduce((sum, item) => sum + item.subtotal, 0);
    const descontoValor = getNumericValue(desconto);
    const acrescimoValor = getNumericValue(acrescimo);
    const total = subtotal - descontoValor + acrescimoValor;
    const totalPago = pagamentos.reduce((sum, p) => sum + p.valor, 0);
    const restante = Math.max(0, total - totalPago);

    useEffect(() => {
        async function carregarDados() {
            try {
                const [resProdutos, resClientes] = await Promise.all([
                    api.get('/produtos'),
                    api.get('/clientes'),
                ]);
                setProdutos(resProdutos.data);
                setClientes(resClientes.data);
            } catch (err) {
                console.error('Erro ao carregar dados:', err);
                showNotification('Erro ao carregar dados', 'error');
            }
        }
        carregarDados();
    }, []);

    useEffect(() => {
        inputBarcodeRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!termoBusca.trim()) {
            setSugestoes([]);
            return;
        }
        const termoNorm = normalizeStr(termoBusca);
        const resultados = produtos.filter(
            (p) =>
                (p.nome && normalizeStr(p.nome).includes(termoNorm)) ||
                (p.codigoBarras && p.codigoBarras.includes(termoBusca))
        ).slice(0, 8);
        setSugestoes(resultados);
    }, [termoBusca, produtos]);

    // Busca clientes conveniados
    useEffect(() => {
        if (!buscaConvenio.trim()) {
            setSugestoesConvenio([]);
            return;
        }
        const termoNorm = normalizeStr(buscaConvenio);
        const conveniados = clientes.filter(
            (c) => c.convenio && (
                (c.nome && normalizeStr(c.nome).includes(termoNorm)) ||
                (c.cpf && c.cpf.includes(buscaConvenio))
            )
        ).slice(0, 6);
        setSugestoesConvenio(conveniados);
    }, [buscaConvenio, clientes]);

    function adicionarProduto(produto) {
        if (!produto) return;

        const qtd = Math.max(1, quantidade);

        if (!permiteEstoqueNegativo) {
            if (produto.estoque <= 0) {
                showNotification('Produto sem estoque disponível', 'warning');
                return;
            }
            if (qtd > produto.estoque) {
                showNotification(`Estoque insuficiente! Disponível: ${produto.estoque}`, 'warning');
                return;
            }
        }

        setItensVenda((prev) => {
            const existente = prev.find((i) => i.idProduto === produto.idProduto);
            if (existente) {
                const novaQtd = existente.quantidade + qtd;
                if (!permiteEstoqueNegativo && novaQtd > produto.estoque) {
                    showNotification(`Estoque insuficiente! Disponível: ${produto.estoque}`, 'warning');
                    return prev;
                }
                return prev.map((i) =>
                    i.idProduto === produto.idProduto
                        ? { ...i, quantidade: novaQtd, subtotal: novaQtd * i.precoUnitario }
                        : i
                );
            }
            return [
                ...prev,
                {
                    idProduto: produto.idProduto,
                    nome: produto.nome,
                    quantidade: qtd,
                    precoUnitario: produto.preco,
                    subtotal: qtd * produto.preco,
                },
            ];
        });

        setTermoBusca('');
        setQuantidade(1);
        setSugestoes([]);
        inputBarcodeRef.current?.focus();
    }

    function selecionarSugestao(produto) {
        adicionarProduto(produto);
    }

    function handleBuscaKeyDown(e) {
        if (e.key === 'Enter' && sugestoes.length > 0) {
            e.preventDefault();
            selecionarSugestao(sugestoes[0]);
        }
    }

    function removerItem(index) {
        setItensVenda((prev) => prev.filter((_, i) => i !== index));
        showNotification('Item removido', 'info');
    }

    function cancelarVenda() {
        setItensVenda([]);
        setDesconto('');
        setAcrescimo('');
        setCpfNota('');
        setClienteId('');
        setPagamentos([]);
        setPagamentoForma(formasPagamento[0]?.value || 'dinheiro');
        setPagamentoValor('');
        setClienteConvenioSelecionado(null);
        setBuscaConvenio('');
        setModalCancelarVenda(false);
        showNotification('Venda cancelada', 'info');
        inputBarcodeRef.current?.focus();
    }

    function adicionarPagamento() {
        // Validação convênio
        if (isConvenio && !clienteConvenioSelecionado) {
            showNotification('Selecione um cliente conveniado', 'warning');
            return;
        }

        let valor = getNumericValue(pagamentoValor);

        if (valor <= 0) {
            if (restante <= 0) {
                showNotification('Informe um valor válido', 'warning');
                return;
            }
            valor = restante;
        }

        if (valor > restante + 0.009 && pagamentoForma !== 'dinheiro') {
            showNotification(`Valor excede o restante: ${fmt(restante)}`, 'warning');
            return;
        }

        const novoPagamento = {
            forma: pagamentoForma,
            valor: valor,
        };

        if (isConvenio && clienteConvenioSelecionado) {
            novoPagamento.clienteConvenio = clienteConvenioSelecionado;
        }

        setPagamentos((prev) => [...prev, novoPagamento]);
        setPagamentoValor('');
        setPagamentoForma(formasPagamento[0]?.value || 'dinheiro');
        setPagamentoIndex(0);
        setClienteConvenioSelecionado(null);
        setBuscaConvenio('');
        setTimeout(() => inputPagamentoValorRef.current?.focus(), 50);
    }

    function removerPagamento(index) {
        setPagamentos((prev) => prev.filter((_, i) => i !== index));
    }

    function preencherRestante() {
        if (restante <= 0) return;

        if (isConvenio && !clienteConvenioSelecionado) {
            showNotification('Selecione um cliente conveniado primeiro', 'warning');
            return;
        }

        const novoPagamento = {
            forma: pagamentoForma,
            valor: restante,
        };
        if (isConvenio && clienteConvenioSelecionado) {
            novoPagamento.clienteConvenio = clienteConvenioSelecionado;
        }
        setPagamentos((prev) => [...prev, novoPagamento]);
        setPagamentoValor('');
        setClienteConvenioSelecionado(null);
        setBuscaConvenio('');
    }

    async function finalizarVenda() {
        if (itensVenda.length === 0) {
            showNotification('Adicione pelo menos um produto', 'warning');
            return;
        }

        if (pagamentos.length === 0) {
            showNotification('Selecione ao menos uma forma de pagamento', 'warning');
            setModalPagamento(true);
            return;
        }

        const totalPagoAtual = pagamentos.reduce((sum, p) => sum + p.valor, 0);
        const temDinheiro = pagamentos.some(p => p.forma === 'dinheiro');

        if (totalPagoAtual < total - 0.01) {
            showNotification(`O total pago (${fmt(totalPagoAtual)}) é menor que o total da venda (${fmt(total)})`, 'warning');
            setModalPagamento(true);
            return;
        }

        if (totalPagoAtual > total + 0.01 && !temDinheiro) {
            showNotification(`O total pago (${fmt(totalPagoAtual)}) excede o total da venda. Somente pagamentos em dinheiro permitem troco.`, 'warning');
            setModalPagamento(true);
            return;
        }

        setFinalizando(true);
        try {
            const venda = {
                idCliente: clienteId || null,
                valorTotal: subtotal,
                desconto: descontoValor,
                valorFinal: total,
                formaPagamento: pagamentos[0]?.forma || 'dinheiro',
                pagamentos,
                observacoes: cpfNota ? `CPF: ${cpfNota}` : '',
                itens: itensVenda,
            };

            await api.post('/vendas', venda);
            showNotification('Venda finalizada com sucesso!', 'success');

            // Lógica de Troco
            const totalPagoDinheiro = pagamentos
                .filter(p => p.forma === 'dinheiro')
                .reduce((sum, p) => sum + p.valor, 0);
            
            // Se o total pago em dinheiro + outras formas for maior que o total da venda, há troco
            if (totalPagoAtual > total && totalPagoDinheiro > 0) {
                setValorTroco(totalPagoAtual - total);
                setModalTroco(true);
                // Fecha automaticamente após 5 segundos
                setTimeout(() => setModalTroco(false), 5000);
            }

            setItensVenda([]);
            setDesconto('');
            setAcrescimo('');
            setCpfNota('');
            setClienteId('');
            setPagamentos([]);
            setPagamentoForma(formasPagamento[0]?.value || 'dinheiro');
            setPagamentoValor('');
            setModalPagamento(false);
            setClienteConvenioSelecionado(null);
            setBuscaConvenio('');

            const res = await api.get('/produtos');
            setProdutos(res.data);

            inputBarcodeRef.current?.focus();
        } catch (err) {
            console.error('Erro ao finalizar venda:', err);
            showNotification('Erro ao finalizar venda', 'error');
        } finally {
            setFinalizando(false);
        }
    }

    const selectPaymentMethod = useCallback((value, index) => {
        setPagamentoForma(value);
        setPagamentoIndex(index);
        setClienteConvenioSelecionado(null);
        setBuscaConvenio('');
        if (!pagamentoValor || getNumericValue(pagamentoValor) === 0) {
            setPagamentoValor(restante > 0 ? formatCurrencyStr(restante) : '');
        }
        if (value !== 'convenio') {
            setTimeout(() => inputPagamentoValorRef.current?.focus(), 50);
        } else {
            setTimeout(() => inputConvenioRef.current?.focus(), 50);
        }
    }, [pagamentoValor, restante]);

    const handlePaymentKeyDown = useCallback((e) => {
        if (!modalPagamento) return;

        // F12 dentro do modal finaliza a venda
        if (e.key === 'F12') {
            e.preventDefault();
            finalizarVenda();
            return;
        }

        // Atalhos das formas de pagamento (F1-Fn dinamicamente)
        formasPagamento.forEach((forma, idx) => {
            if (e.key === `F${idx + 1}`) {
                e.preventDefault();
                selectPaymentMethod(forma.value, idx);
            }
        });

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setPagamentoIndex((prev) => {
                const next = Math.min(prev + 1, formasPagamento.length - 1);
                selectPaymentMethod(formasPagamento[next].value, next);
                return next;
            });
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setPagamentoIndex((prev) => {
                const next = Math.max(prev - 1, 0);
                selectPaymentMethod(formasPagamento[next].value, next);
                return next;
            });
            return;
        }
    }, [modalPagamento, selectPaymentMethod, formasPagamento, finalizarVenda]);

    const handleKeyDown = useCallback((e) => {
        const algumodalAberto = modalDesconto || modalAcrescimo || modalCpf || modalPagamento || modalCancelarVenda || modalCancelarItem || modalTroco;

        if (modalPagamento) {
            if (e.key === 'Escape') {
                e.preventDefault();
                setModalPagamento(false);
                inputBarcodeRef.current?.focus();
                return;
            }
            
            handlePaymentKeyDown(e);
            return;
        }

        if (algumodalAberto && e.key !== 'Escape') return;

        switch (e.key) {
            case 'Escape':
                if (modalTroco) {
                    setModalTroco(false);
                } else if (algumodalAberto) {
                    setModalDesconto(false);
                    setModalAcrescimo(false);
                    setModalCpf(false);
                    setModalPagamento(false);
                    setModalCancelarVenda(false);
                    setModalCancelarItem(false);
                    inputBarcodeRef.current?.focus();
                }
                break;
            case 'F2':
                e.preventDefault();
                inputBarcodeRef.current?.focus();
                break;
            case 'F4':
                e.preventDefault();
                setModalDesconto(true);
                setTimeout(() => inputDescontoRef.current?.focus(), 100);
                break;
            case 'F5':
                e.preventDefault();
                setModalAcrescimo(true);
                setTimeout(() => inputAcrescimoRef.current?.focus(), 100);
                break;
            case 'F6':
                e.preventDefault();
                setModalCpf(true);
                setTimeout(() => inputCpfRef.current?.focus(), 100);
                break;
            case 'F8':
                e.preventDefault();
                if (itensVenda.length > 0) {
                    setItemParaCancelar(itensVenda.length - 1);
                    setModalCancelarItem(true);
                }
                break;
            case 'F9':
                e.preventDefault();
                if (itensVenda.length > 0) {
                    setModalCancelarVenda(true);
                }
                break;
            case 'F10':
                e.preventDefault();
                setModalPagamento(true);
                setTimeout(() => inputPagamentoValorRef.current?.focus(), 100);
                break;
            case 'F12':
                e.preventDefault();
                finalizarVenda();
                break;
            default:
                break;
        }
    }, [modalDesconto, modalAcrescimo, modalCpf, modalPagamento, modalCancelarVenda, modalCancelarItem, itensVenda, handlePaymentKeyDown]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const formatarPagamento = (forma) => {
        const item = formasPagamento.find((p) => p.value === forma);
        return item ? item.label : forma;
    };

    const fkShortcutList = formasPagamento.map((f, i) => `F${i + 1} ${f.label}`).join(' · ');

    return (
        <div className="body-vendas">
            <Sidebar />
            <div className="content-vendas">
                <div className="title-page">
                    <h1>Nova Venda</h1>
                    <div className="shortcuts-hint">
                        <span className="shortcut-badge">F2 Produto</span>
                        <span className="shortcut-badge">F4 Desconto</span>
                        <span className="shortcut-badge">F5 Acréscimo</span>
                        <span className="shortcut-badge">F6 CPF</span>
                        <span className="shortcut-badge">F8 Canc. Item</span>
                        <span className="shortcut-badge">F9 Canc. Venda</span>
                        <span className="shortcut-badge">F10 Pagamento</span>
                        <span className="shortcut-badge">F12 Finalizar</span>
                    </div>
                </div>

                <div className="vendas-content">
                    <div className="vendas-left">
                        <div className="product-input-area">
                            <div className="barcode-input-wrapper">
                                <svg className="barcode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M21 5v14" />
                                </svg>
                                <input
                                    ref={inputBarcodeRef}
                                    type="text"
                                    placeholder="Código de barras ou nome do produto..."
                                    value={termoBusca}
                                    onChange={(e) => setTermoBusca(e.target.value)}
                                    onKeyDown={handleBuscaKeyDown}
                                    className="barcode-input"
                                />
                                <div className="qty-input-wrapper">
                                    <label>Qtd:</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={quantidade}
                                        onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                                        className="qty-input"
                                    />
                                </div>
                            </div>

                            {/* Sugestões */}
                            {sugestoes.length > 0 && (
                                <div className="sugestoes-dropdown">
                                    {sugestoes.map((p) => (
                                        <div
                                            key={p.idProduto}
                                            className="sugestao-item"
                                            onClick={() => selecionarSugestao(p)}
                                        >
                                            <div className="sugestao-info">
                                                <span className="sugestao-nome">{p.nome}</span>
                                                <span className="sugestao-codigo">{p.codigoBarras || 'Sem código'}</span>
                                            </div>
                                            <div className="sugestao-preco">
                                                <span>{fmt(p.preco)}</span>
                                                <span className={`sugestao-estoque ${p.estoque < 10 ? 'baixo' : ''}`}>
                                                    Estoque: {p.estoque}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Lista de itens da venda */}
                        <div className="itens-venda-wrapper">
                            <table className="itens-venda-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Produto</th>
                                        <th>Qtd</th>
                                        <th>Preço Unit.</th>
                                        <th>Subtotal</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itensVenda.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="itens-empty">
                                                Nenhum produto adicionado
                                            </td>
                                        </tr>
                                    ) : (
                                        itensVenda.map((item, index) => (
                                            <tr key={index} className="item-row">
                                                <td className="item-num">{index + 1}</td>
                                                <td className="item-nome">{item.nome}</td>
                                                <td className="item-qtd">{item.quantidade}</td>
                                                <td>{fmt(item.precoUnitario)}</td>
                                                <td className="item-subtotal">{fmt(item.subtotal)}</td>
                                                <td>
                                                    <button
                                                        className="btn-remover-item"
                                                        onClick={() => removerItem(index)}
                                                        title="Remover item"
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Painel Direito Totais e Ações */}
                    <div className="vendas-right">
                        <div className="totais-card">
                            <div className="totais-header">
                                <h2>Resumo da Venda</h2>
                            </div>

                            <div className="totais-body">
                                <div className="totais-row">
                                    <span>Itens</span>
                                    <span>{itensVenda.length}</span>
                                </div>
                                <div className="totais-row">
                                    <span>Subtotal</span>
                                    <span>{fmt(subtotal)}</span>
                                </div>
                                {descontoValor > 0 && (
                                    <div className="totais-row desconto-row">
                                        <span>Desconto</span>
                                        <span>- {fmt(descontoValor)}</span>
                                    </div>
                                )}
                                {acrescimoValor > 0 && (
                                    <div className="totais-row acrescimo-row">
                                        <span>Acréscimo</span>
                                        <span>+ {fmt(acrescimoValor)}</span>
                                    </div>
                                )}
                                {cpfNota && (
                                    <div className="totais-row cpf-row">
                                        <span>CPF na Nota</span>
                                        <span>{cpfNota}</span>
                                    </div>
                                )}
                                <div className="totais-divider"></div>
                                <div className="totais-total">
                                    <span>TOTAL</span>
                                    <span>{fmt(total)}</span>
                                </div>
                            </div>

                            {/* Pagamentos parciais */}
                            {pagamentos.length > 0 && (
                                <div className="totais-pagamentos-split">
                                    <label>Pagamentos</label>
                                    <div className="pagamentos-list">
                                        {pagamentos.map((p, i) => (
                                            <div className="pagamento-entry" key={i}>
                                                <span className="pagamento-entry-label">
                                                    {formatarPagamento(p.forma)}
                                                    {p.clienteConvenio && ` ${p.clienteConvenio.nome}`}
                                                </span>
                                                <span className="pagamento-entry-valor">{fmt(p.valor)}</span>
                                                <button className="pagamento-entry-remove" onClick={() => removerPagamento(i)}>×</button>
                                            </div>
                                        ))}
                                        <div className="pagamento-entry pagamento-entry-total">
                                            <span>Total Pago</span>
                                            <span className={totalPago >= total ? 'pago-ok' : 'pago-pendente'}>
                                                {fmt(totalPago)}
                                            </span>
                                        </div>
                                        {restante > 0.01 && (
                                            <div className="pagamento-entry pagamento-entry-restante">
                                                <span>Restante</span>
                                                <span>{fmt(restante)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="totais-cliente">
                                <label>Cliente (opcional)</label>
                                <select
                                    value={clienteId}
                                    onChange={(e) => setClienteId(e.target.value)}
                                >
                                    <option value="">Consumidor final</option>
                                    {clientes.map((c) => (
                                        <option key={c.idCliente} value={c.idCliente}>
                                            {c.nome}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="totais-pinpad">
                                <div className="pinpad-placeholder">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <rect x="2" y="3" width="20" height="18" rx="2" />
                                        <path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01M8 15h8" />
                                    </svg>
                                    <span>Integração Pinpad</span>
                                    <span className="pinpad-status">Em desenvolvimento</span>
                                </div>
                            </div>

                            <div className="totais-actions">
                                <button
                                    className="btn-finalizar"
                                    onClick={finalizarVenda}
                                    disabled={itensVenda.length === 0 || finalizando}
                                >
                                    {finalizando ? 'Finalizando...' : 'Finalizar Venda (F12)'}
                                </button>
                                <button
                                    className="btn-cancelar-venda"
                                    onClick={() => itensVenda.length > 0 && setModalCancelarVenda(true)}
                                    disabled={itensVenda.length === 0}
                                >
                                    Cancelar Venda (F9)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Desconto */}
                <Modal
                    isOpen={modalDesconto}
                    onClose={() => setModalDesconto(false)}
                    title="Aplicar Desconto"
                    maxWidth="380px"
                    onConfirm={() => setModalDesconto(false)}
                    footer={
                        <>
                            <button className="btn-modal-cancel" onClick={() => { setDesconto(''); setModalDesconto(false); }}>Limpar</button>
                            <button className="btn-modal-confirm" onClick={() => setModalDesconto(false)}>Aplicar</button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label>Valor do Desconto (R$)</label>
                        <input
                            ref={inputDescontoRef}
                            type="text"
                            inputMode="numeric"
                            value={desconto}
                            onChange={(e) => handleCurrencyInput(e.target.value, setDesconto)}
                            placeholder="0,00"
                        />
                    </div>
                </Modal>

                {/* Modal Acréscimo */}
                <Modal
                    isOpen={modalAcrescimo}
                    onClose={() => setModalAcrescimo(false)}
                    title="Aplicar Acréscimo"
                    maxWidth="380px"
                    onConfirm={() => setModalAcrescimo(false)}
                    footer={
                        <>
                            <button className="btn-modal-cancel" onClick={() => { setAcrescimo(''); setModalAcrescimo(false); }}>Limpar</button>
                            <button className="btn-modal-confirm" onClick={() => setModalAcrescimo(false)}>Aplicar</button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label>Valor do Acréscimo (R$)</label>
                        <input
                            ref={inputAcrescimoRef}
                            type="text"
                            inputMode="numeric"
                            value={acrescimo}
                            onChange={(e) => handleCurrencyInput(e.target.value, setAcrescimo)}
                            placeholder="0,00"
                        />
                    </div>
                </Modal>

                {/* Modal CPF */}
                <Modal
                    isOpen={modalCpf}
                    onClose={() => setModalCpf(false)}
                    title="CPF na Nota"
                    maxWidth="380px"
                    onConfirm={() => setModalCpf(false)}
                    footer={
                        <>
                            <button className="btn-modal-cancel" onClick={() => { setCpfNota(''); setModalCpf(false); }}>Limpar</button>
                            <button className="btn-modal-confirm" onClick={() => setModalCpf(false)}>Confirmar</button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label>CPF / CNPJ</label>
                        <input
                            ref={inputCpfRef}
                            type="text"
                            value={cpfNota}
                            onChange={(e) => setCpfNota(e.target.value)}
                            placeholder="000.000.000-00"
                        />
                    </div>
                </Modal>

                {/* Modal Pagamento layout compacto, sem scroll do body */}
                <Modal
                    isOpen={modalPagamento}
                    onClose={() => setModalPagamento(false)}
                    title="Forma de Pagamento"
                    maxWidth="580px"
                    onConfirm={adicionarPagamento}
                    footer={
                        <div className="pagamento-modal-footer-row">
                            <button
                                className="btn-modal-cancel"
                                onClick={() => setModalPagamento(false)}
                                title="Fechar e voltar à tela de vendas (Esc)"
                            >
                                Voltar às Vendas (ESQ)
                            </button>
                            <button
                                className="btn-modal-confirm btn-finalizar-modal"
                                onClick={finalizarVenda}
                                disabled={finalizando || restante > 0.01}
                                title="Finalizar Venda (F12)"
                            >
                                {finalizando ? 'Finalizando...' : 'Finalizar Venda (F12)'}
                            </button>
                        </div>
                    }
                >
                    <div className="pagamento-modal-section">
                        {/* Info de totais */}
                        <div className="pagamento-modal-total-info">
                            <div className="pagamento-total-row">
                                <span>Total da Venda</span>
                                <span className="pagamento-total-value">{fmt(total)}</span>
                            </div>
                            {totalPago > 0 && (
                                <div className="pagamento-total-row">
                                    <span>Já Pago</span>
                                    <span className="pagamento-pago-value">{fmt(totalPago)}</span>
                                </div>
                            )}
                            {restante > 0.01 && (
                                <div className="pagamento-total-row pagamento-restante-row">
                                    <span>Restante</span>
                                    <span className="pagamento-restante-value">{fmt(restante)}</span>
                                </div>
                            )}
                        </div>

                        <label className="pagamento-modal-label">
                            Selecione a forma (↑↓ ou F1-F{formasPagamento.length})
                        </label>

                        {/* Grid 2 colunas para as formas de pagamento */}
                        <div className="pagamento-modal-grid">
                            {formasPagamento.map((p, i) => (
                                <button
                                    key={p.value}
                                    className={`pagamento-modal-option ${pagamentoForma === p.value ? 'ativo' : ''} ${pagamentoIndex === i ? 'focused' : ''}`}
                                    onClick={() => selectPaymentMethod(p.value, i)}
                                >
                                    <span className="pagamento-modal-icon">{p.icon}</span>
                                    <span className="pagamento-modal-option-label">{p.label}</span>
                                    <span className="pagamento-modal-shortcut">{p.shortcut}</span>
                                </button>
                            ))}
                        </div>

                        {/* Campo de busca convênio (somente quando convênio selecionado) */}
                        {isConvenio && (
                            <div className="convenio-busca-section">
                                <label className="pagamento-modal-label">Cliente Conveniado</label>
                                <div className="convenio-busca-wrapper">
                                    <div className="convenio-input-field-wrapper">
                                        <input
                                            ref={inputConvenioRef}
                                            type="text"
                                            placeholder="Digite o nome ou CPF/CNPJ do cliente..."
                                            value={buscaConvenio}
                                            onChange={(e) => { setBuscaConvenio(e.target.value); setClienteConvenioSelecionado(null); }}
                                            className="convenio-busca-input"
                                        />
                                        {clienteConvenioSelecionado && (
                                            <div className="convenio-selecionado-tag">
                                                🤝 {clienteConvenioSelecionado.nome}
                                                <button onClick={() => { setClienteConvenioSelecionado(null); setBuscaConvenio(''); }}>×</button>
                                            </div>
                                        )}
                                    </div>
                                    {sugestoesConvenio.length > 0 && !clienteConvenioSelecionado && (
                                        <div className="convenio-sugestoes">
                                            {sugestoesConvenio.map((c) => (
                                                <div
                                                    key={c.idCliente}
                                                    className="convenio-sugestao-item"
                                                    onClick={() => { setClienteConvenioSelecionado(c); setBuscaConvenio(c.nome); setSugestoesConvenio([]); }}
                                                >
                                                    <span>{c.nome}</span>
                                                    {c.cpf && <span className="convenio-sugestao-cpf">{c.cpf}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {buscaConvenio.length > 1 && sugestoesConvenio.length === 0 && !clienteConvenioSelecionado && (
                                        <div className="convenio-vazio">Nenhum cliente conveniado encontrado</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Valor + botões */}
                        <div className="pagamento-valor-input-row">
                            <div className="form-group">
                                <label>Valor</label>
                                <input
                                    ref={inputPagamentoValorRef}
                                    type="text"
                                    inputMode="numeric"
                                    value={pagamentoValor}
                                    onChange={(e) => handleCurrencyInput(e.target.value, setPagamentoValor)}
                                    placeholder={formatCurrencyStr(restante)}
                                />
                            </div>
                            <button className="btn-add-pagamento" onClick={adicionarPagamento} disabled={restante <= 0}>
                                Adicionar
                            </button>
                            <button className="btn-preencher-restante" onClick={preencherRestante} disabled={restante <= 0}>
                                Preencher Restante
                            </button>
                        </div>

                        {/* Pagamentos adicionados scroll interno limitado */}
                        {pagamentos.length > 0 && (
                            <div className="pagamento-entries-list">
                                <label>Pagamentos adicionados</label>
                                <div className="pagamento-entries-scroll">
                                    {pagamentos.map((p, i) => (
                                        <div className="pagamento-entry-modal" key={i}>
                                            <span className="pagamento-entry-modal-forma">
                                                {formatarPagamento(p.forma)}
                                                {p.clienteConvenio && ` ${p.clienteConvenio.nome}`}
                                            </span>
                                            <span className="pagamento-entry-modal-valor">{fmt(p.valor)}</span>
                                            <button onClick={() => removerPagamento(i)}>×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>

                {/* Modal Cancelar Venda */}
                <Modal
                    isOpen={modalCancelarVenda}
                    onClose={() => setModalCancelarVenda(false)}
                    title="Cancelar Venda"
                    maxWidth="420px"
                    onConfirm={cancelarVenda}
                    footer={
                        <>
                            <button className="btn-modal-cancel" onClick={() => setModalCancelarVenda(false)}>Voltar</button>
                            <button className="btn-modal-danger" onClick={cancelarVenda}>Cancelar Venda</button>
                        </>
                    }
                >
                    <p className="confirm-message">
                        Deseja realmente cancelar toda a venda?<br />
                        <strong>{itensVenda.length} item(ns)</strong> serão removidos.
                    </p>
                </Modal>

                {/* Modal Cancelar Item */}
                <Modal
                    isOpen={modalCancelarItem}
                    onClose={() => setModalCancelarItem(false)}
                    title="Cancelar Item"
                    maxWidth="420px"
                    onConfirm={() => {
                        if (itemParaCancelar !== null) {
                            removerItem(itemParaCancelar);
                            setModalCancelarItem(false);
                        }
                    }}
                    footer={
                        <>
                            <button className="btn-modal-cancel" onClick={() => setModalCancelarItem(false)}>Voltar</button>
                            <button className="btn-modal-danger" onClick={() => {
                                if (itemParaCancelar !== null) {
                                    removerItem(itemParaCancelar);
                                    setModalCancelarItem(false);
                                }
                            }}>Cancelar Item</button>
                        </>
                    }
                >
                    <p className="confirm-message">
                        Deseja remover o último item adicionado?<br />
                        {itemParaCancelar !== null && itensVenda[itemParaCancelar] && (
                            <strong>"{itensVenda[itemParaCancelar].nome}"</strong>
                        )}
                    </p>
                </Modal>

                {/* Modal de Troco */}
                <Modal
                    isOpen={modalTroco}
                    onClose={() => setModalTroco(false)}
                    title="Troco"
                    maxWidth="400px"
                    footer={
                        <button className="btn-modal-confirm w-full" onClick={() => setModalTroco(false)}>
                            Fechar (ESC)
                        </button>
                    }
                >
                    <div className="troco-display">
                        <span className="troco-label">Valor do Troco</span>
                        <span className="troco-valor">{fmt(valorTroco)}</span>
                        <div className="troco-timer-bar-wrapper">
                            <div className="troco-timer-bar" />
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
}

export default Vendas;