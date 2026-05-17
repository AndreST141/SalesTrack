import { useState, useEffect } from 'react';
import Sidebar from '../../components/SideBar/sidebar';
import Table from '../../components/Table/Table';
import Modal from '../../components/Modal/Modal';
import FilterModal from '../../components/FilterModal/FilterModal';
import api from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import './style.css';

function Historico() {
    const [vendas, setVendas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vendaSelecionada, setVendaSelecionada] = useState(null);
    const [modalDetalhes, setModalDetalhes] = useState(false);
    const [loadingDetalhes, setLoadingDetalhes] = useState(false);

    const [modalFiltros, setModalFiltros] = useState(false);
    const [activeFilters, setActiveFilters] = useState({});

    const { showNotification } = useNotification();

    const fmt = (val) =>
        Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const formatarPagamento = (forma) => {
        const mapa = {
            dinheiro: 'Dinheiro',
            cartao_credito: 'Cartão Crédito',
            cartao_debito: 'Cartão Débito',
            pix: 'PIX',
            outro: 'Outro',
        };
        return mapa[forma] || forma;
    };

    const badgePagamento = (forma) => {
        const classes = {
            dinheiro: 'badge-success',
            cartao_credito: 'badge-info',
            cartao_debito: 'badge-info',
            pix: 'badge-warning',
            outro: 'badge-neutral',
        };
        return classes[forma] || 'badge-neutral';
    };

    async function carregarVendas() {
        setLoading(true);
        try {
            const res = await api.get('/vendas');
            setVendas(res.data);
        } catch (err) {
            console.error('Erro ao carregar histórico:', err);
            showNotification('Erro ao carregar histórico de vendas', 'error');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        carregarVendas();
    }, []);

    async function verDetalhes(venda) {
        setLoadingDetalhes(true);
        setModalDetalhes(true);
        try {
            const res = await api.get(`/vendas/${venda.idVenda}`);
            setVendaSelecionada(res.data);
        } catch (err) {
            console.error('Erro ao carregar detalhes:', err);
            showNotification('Erro ao carregar detalhes da venda', 'error');
            setModalDetalhes(false);
        } finally {
            setLoadingDetalhes(false);
        }
    }
    const filterDefinitions = [
        { key: 'idVenda', label: 'ID da Venda', type: 'text', placeholder: 'Ex: 1' },
        {
            key: 'formaPagamento',
            label: 'Forma de Pagamento',
            type: 'select',
            options: [
                { value: 'dinheiro', label: 'Dinheiro' },
                { value: 'cartao_credito', label: 'Cartão Crédito' },
                { value: 'cartao_debito', label: 'Cartão Débito' },
                { value: 'pix', label: 'PIX' },
                { value: 'outro', label: 'Outro' },
            ],
        },
        { key: '_dataInicio', label: 'Data Início', type: 'date' },
        { key: '_dataFim', label: 'Data Fim', type: 'date' },
        { key: 'vendedorNome', label: 'Vendedor', type: 'text', placeholder: 'Nome do vendedor...' },
        { key: 'clienteNome', label: 'Cliente', type: 'text', placeholder: 'Nome do cliente...' },
    ];

    const columns = [
        { key: 'idVenda', label: 'ID' },
        {
            key: 'dataVenda',
            label: 'Data',
            render: (val) => new Date(val).toLocaleString('pt-BR'),
        },
        {
            key: 'clienteNome',
            label: 'Cliente',
            render: (val) => val || 'Não informado',
        },
        { key: 'vendedorNome', label: 'Vendedor' },
        {
            key: 'valorFinal',
            label: 'Total',
            render: (val) => <strong>{fmt(val)}</strong>,
        },
        {
            key: 'pagamentos',
            label: 'Pagamento',
            render: (pagamentos, row) => {
                if (pagamentos && pagamentos.length > 0) {
                    return (
                        <div className="badges-pagamento">
                            {pagamentos.map((p, i) => (
                                <span key={i} className={`badge ${badgePagamento(p.formaPagamento)}`}>
                                    {formatarPagamento(p.formaPagamento)}
                                </span>
                            ))}
                        </div>
                    );
                }
                return (
                    <span className={`badge ${badgePagamento(row.formaPagamento)}`}>
                        {formatarPagamento(row.formaPagamento)}
                    </span>
                );
            },
        },
    ];

    return (
        <div className="body-historico">
            <Sidebar />
            <div className="content-historico">
                <div className="title-page">
                    <h1>Histórico de Vendas</h1>
                </div>
                <div className="historico-body">
                    <Table
                        columns={columns}
                        data={vendas}
                        loading={loading}
                        searchPlaceholder="Pesquisar por cliente, vendedor ou forma de pagamento..."
                        searchKeys={['clienteNome', 'vendedorNome', 'formaPagamento']}
                        emptyMessage="Nenhuma venda registrada"
                        advancedFilters={filterDefinitions}
                        activeFilters={activeFilters}
                        onFilterClick={() => setModalFiltros(true)}
                        headerActions={
                            <button className="btn-secondary" onClick={carregarVendas}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                    <path d="M1 4v6h6M23 20v-6h-6" />
                                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                                </svg>
                                Atualizar
                            </button>
                        }
                        actions={(item) => (
                            <button className="btn-action" onClick={() => verDetalhes(item)}>
                                Ver detalhes
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
                <Modal
                    isOpen={modalDetalhes}
                    onClose={() => { setModalDetalhes(false); setVendaSelecionada(null); }}
                    title={vendaSelecionada ? `Venda #${vendaSelecionada.idVenda}` : 'Detalhes da Venda'}
                    className='modal-footer-buttons'
                    maxWidth="700px"
                >
                    {loadingDetalhes ? (
                        <p style={{ textAlign: 'center', color: '#94a3b8' }}>Carregando detalhes...</p>
                    ) : vendaSelecionada ? (
                        <>
                            <div className="detail-row">
                                <span className="detail-label">Data</span>
                                <span className="detail-value">
                                    {new Date(vendaSelecionada.dataVenda).toLocaleString('pt-BR')}
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Cliente</span>
                                <span className="detail-value">
                                    {vendaSelecionada.clienteNome || 'Não informado'}
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Vendedor</span>
                                <span className="detail-value">{vendaSelecionada.vendedorNome}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Pagamento</span>
                                <span className="detail-value">
                                    {vendaSelecionada.pagamentos && vendaSelecionada.pagamentos.length > 1 ? (
                                        <div className="detail-pagamentos-lista">
                                            {vendaSelecionada.pagamentos.map((p, i) => (
                                                <div key={i} className="detail-pagamento-item">
                                                    <span className={`badge ${badgePagamento(p.formaPagamento)}`}>
                                                        {formatarPagamento(p.formaPagamento)}
                                                    </span>
                                                    <span className="detail-pagamento-valor">{fmt(p.valor)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className={`badge ${badgePagamento(
                                            vendaSelecionada.pagamentos?.[0]?.formaPagamento || vendaSelecionada.formaPagamento
                                        )}`}>
                                            {formatarPagamento(
                                                vendaSelecionada.pagamentos?.[0]?.formaPagamento || vendaSelecionada.formaPagamento
                                            )}
                                        </span>
                                    )}
                                </span>
                            </div>

                            <div className="detail-section">
                                <h3>Produtos</h3>
                                <table className="detail-items-table">
                                    <thead>
                                        <tr>
                                            <th>Produto</th>
                                            <th>Qtd</th>
                                            <th>Preço Unit.</th>
                                            <th>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {vendaSelecionada.itens?.map((item, i) => (
                                            <tr key={i}>
                                                <td>{item.produtoNome}</td>
                                                <td>{item.quantidade}</td>
                                                <td>{fmt(item.precoUnitario)}</td>
                                                <td>{fmt(item.subtotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="detail-totals">
                                <div className="detail-row">
                                    <span className="detail-label">Subtotal</span>
                                    <span className="detail-value">{fmt(vendaSelecionada.valorTotal)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Desconto</span>
                                    <span className="detail-value" style={{ color: '#dc2626' }}>
                                        - {fmt(vendaSelecionada.desconto)}
                                    </span>
                                </div>
                                <div className="detail-row total-final">
                                    <span className="detail-label"><strong>TOTAL</strong></span>
                                    <span className="detail-value">{fmt(vendaSelecionada.valorFinal)}</span>
                                </div>
                            </div>
                        </>
                    ) : null}
                </Modal>
            </div>
        </div>
    );
}

export default Historico;