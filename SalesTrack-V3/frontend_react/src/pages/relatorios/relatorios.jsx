import { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/SideBar/sidebar';
import Table from '../../components/Table/Table';
import FilterModal from '../../components/FilterModal/FilterModal';
import api from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area,
} from 'recharts';
import './style.css';

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTES & HELPERS
   ═══════════════════════════════════════════════════════════════════ */

const fmt = (val) =>
    Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (val) =>
    val ? new Date(val).toLocaleDateString('pt-BR') : '-';

const fmtDateTime = (val) =>
    val ? new Date(val).toLocaleString('pt-BR') : '-';

const PAYMENT_LABELS = {
    dinheiro: 'Dinheiro',
    cartao_credito: 'Cartão Crédito',
    cartao_debito: 'Cartão Débito',
    pix: 'PIX',
    outro: 'Outro',
    convenio: 'Convênio',
};

const PIE_COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#64748b'];
const BAR_COLORS = ['#2563eb', '#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e', '#6366f1'];

/* ─── Date preset helpers ─── */
function getToday() {
    const d = new Date();
    return d.toISOString().split('T')[0];
}
function getDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}
function getMonthStart() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}
function getMonthEnd() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
}
function getLastMonthStart() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0];
}
function getLastMonthEnd() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0];
}

const DATE_PRESETS = [
    { label: 'Hoje', getRange: () => ({ start: getToday(), end: getToday() }) },
    { label: '7 dias', getRange: () => ({ start: getDaysAgo(7), end: getToday() }) },
    { label: '30 dias', getRange: () => ({ start: getDaysAgo(30), end: getToday() }) },
    { label: 'Mês atual', getRange: () => ({ start: getMonthStart(), end: getMonthEnd() }) },
    { label: 'Mês anterior', getRange: () => ({ start: getLastMonthStart(), end: getLastMonthEnd() }) },
];

/* ═══════════════════════════════════════════════════════════════════
   REPORT DEFINITIONS
   ═══════════════════════════════════════════════════════════════════ */

const REPORT_CATEGORIES = [
    {
        id: 'vendas',
        title: 'Vendas',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
            </svg>
        ),
        accent: '#2563eb',
        reports: [
            {
                id: 'vendas-periodo',
                title: 'Vendas por Período',
                desc: 'Lista completa de vendas filtráveis por data, cliente e vendedor',
                icon: '📋',
                needsDates: true,
            },
            {
                id: 'vendas-pagamento',
                title: 'Vendas por Pagamento',
                desc: 'Agrupamento de vendas por forma de pagamento com totais',
                icon: '💳',
                needsDates: true,
            },
            {
                id: 'vendas-vendedor',
                title: 'Vendas por Vendedor',
                desc: 'Ranking de vendedores por total vendido e ticket médio',
                icon: '👤',
                needsDates: true,
            },
            {
                id: 'vendas-cliente',
                title: 'Vendas por Cliente',
                desc: 'Ranking de clientes por valor de compras e frequência',
                icon: '🛒',
                needsDates: true,
            },
        ],
    },
    {
        id: 'produtos',
        title: 'Produtos',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
        accent: '#22c55e',
        reports: [
            {
                id: 'produtos-mais-vendidos',
                title: 'Mais Vendidos',
                desc: 'Ranking de produtos por unidades vendidas e receita gerada',
                icon: '🏆',
                needsDates: true,
            },
            {
                id: 'estoque-atual',
                title: 'Estoque Atual',
                desc: 'Posição de estoque de todos os produtos com valor total',
                icon: '📦',
                needsDates: false,
            },
            {
                id: 'produtos-sem-movimento',
                title: 'Sem Movimento',
                desc: 'Produtos que não tiveram venda no período selecionado',
                icon: '⚠️',
                needsDates: true,
            },
        ],
    },
    {
        id: 'clientes',
        title: 'Clientes',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
        accent: '#8b5cf6',
        reports: [
            {
                id: 'cadastro-clientes',
                title: 'Cadastro de Clientes',
                desc: 'Lista completa de clientes e dados de contato',
                icon: '📇',
                needsDates: false,
            },
            {
                id: 'clientes-convenio',
                title: 'Clientes com Convênio',
                desc: 'Clientes conveniados com limites e saldo devedor',
                icon: '🤝',
                needsDates: false,
            },
        ],
    },
    {
        id: 'financeiro',
        title: 'Financeiro',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
        ),
        accent: '#f59e0b',
        reports: [
            {
                id: 'resumo-financeiro',
                title: 'Resumo Financeiro',
                desc: 'Receita total, ticket médio e comparativo por período',
                icon: '💰',
                needsDates: true,
            },
        ],
    },
];

/* ═══════════════════════════════════════════════════════════════════
   TOOLTIPS
   ═══════════════════════════════════════════════════════════════════ */
function ChartTooltip({ active, payload, label, isCurrency = true }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rel-chart-tooltip">
            <p className="rel-tooltip-label">{label}</p>
            <p className="rel-tooltip-value">
                {isCurrency ? fmt(payload[0].value) : payload[0].value}
            </p>
        </div>
    );
}

function PieTooltipCustom({ active, payload }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rel-chart-tooltip">
            <p className="rel-tooltip-label">{payload[0].name}</p>
            <p className="rel-tooltip-value">{fmt(payload[0].payload.total)}</p>
            <p className="rel-tooltip-sub">{payload[0].value} vendas</p>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

function Relatorios() {
    // ─── State ───
    const [activeReport, setActiveReport] = useState(null);
    const [loading, setLoading] = useState(false);

    // Raw API data
    const [vendas, setVendas] = useState([]);
    const [produtos, setProdutos] = useState([]);
    const [clientes, setClientes] = useState([]);

    // Date filters
    const [dateStart, setDateStart] = useState(getDaysAgo(30));
    const [dateEnd, setDateEnd] = useState(getToday());
    const [activePreset, setActivePreset] = useState('30 dias');

    // Advanced filters
    const [modalFiltros, setModalFiltros] = useState(false);
    const [activeFilters, setActiveFilters] = useState({});

    const { showNotification } = useNotification();

    // ─── Load data when report is selected ───
    useEffect(() => {
        if (!activeReport) return;
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeReport]);

    async function loadData() {
        setLoading(true);
        try {
            const reportDef = findReport(activeReport);
            const promises = [];
            const needsVendas = ['vendas-periodo', 'vendas-pagamento', 'vendas-vendedor', 'vendas-cliente',
                'produtos-mais-vendidos', 'produtos-sem-movimento', 'resumo-financeiro'].includes(activeReport);
            const needsProdutos = ['produtos-mais-vendidos', 'estoque-atual', 'produtos-sem-movimento'].includes(activeReport);
            const needsClientes = ['cadastro-clientes', 'clientes-convenio', 'vendas-cliente'].includes(activeReport);

            if (needsVendas) promises.push(api.get('/vendas').then(r => setVendas(r.data)).catch(() => setVendas([])));
            if (needsProdutos) promises.push(api.get('/produtos?incluir_inativos=true').then(r => setProdutos(r.data)).catch(() => setProdutos([])));
            if (needsClientes) promises.push(api.get('/clientes?incluir_inativos=true').then(r => setClientes(r.data)).catch(() => setClientes([])));

            await Promise.all(promises);
        } catch (err) {
            console.error('Erro ao carregar dados do relatório:', err);
            showNotification('Erro ao carregar dados', 'error');
        } finally {
            setLoading(false);
        }
    }

    function findReport(id) {
        for (const cat of REPORT_CATEGORIES) {
            const r = cat.reports.find(rep => rep.id === id);
            if (r) return r;
        }
        return null;
    }

    function openReport(id) {
        setActiveReport(id);
        setActiveFilters({});
        setActivePreset('30 dias');
        setDateStart(getDaysAgo(30));
        setDateEnd(getToday());
    }

    function goBack() {
        setActiveReport(null);
    }

    function applyPreset(preset) {
        const range = preset.getRange();
        setDateStart(range.start);
        setDateEnd(range.end);
        setActivePreset(preset.label);
    }

    // ─── Filter vendas by date ───
    const vendasFiltradas = useMemo(() => {
        if (!vendas.length) return [];
        return vendas.filter(v => {
            const d = new Date(v.dataVenda);
            const start = new Date(dateStart);
            const end = new Date(dateEnd);
            end.setHours(23, 59, 59, 999);
            return d >= start && d <= end;
        });
    }, [vendas, dateStart, dateEnd]);

    /* ═══════════════════════════════════════════════════════════════
       REPORT DATA PROCESSING
    ═══════════════════════════════════════════════════════════════ */

    const reportData = useMemo(() => {
        switch (activeReport) {
            case 'vendas-periodo':
                return processVendasPeriodo();
            case 'vendas-pagamento':
                return processVendasPagamento();
            case 'vendas-vendedor':
                return processVendasVendedor();
            case 'vendas-cliente':
                return processVendasCliente();
            case 'produtos-mais-vendidos':
                return processProdutosMaisVendidos();
            case 'estoque-atual':
                return processEstoqueAtual();
            case 'produtos-sem-movimento':
                return processProdutosSemMovimento();
            case 'cadastro-clientes':
                return processCadastroClientes();
            case 'clientes-convenio':
                return processClientesConvenio();
            case 'resumo-financeiro':
                return processResumoFinanceiro();
            default:
                return { columns: [], data: [], kpis: [], chartData: null };
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeReport, vendasFiltradas, produtos, clientes, dateStart, dateEnd]);

    /* ─── 1. Vendas por Período ─── */
    function processVendasPeriodo() {
        const data = vendasFiltradas.map(v => ({
            ...v,
            dataFormatada: fmtDateTime(v.dataVenda),
            valorFinalFmt: fmt(v.valorFinal),
            pagamentoLabel: v.pagamentos?.length
                ? v.pagamentos.map(p => PAYMENT_LABELS[p.formaPagamento] || p.formaPagamento).join(', ')
                : (PAYMENT_LABELS[v.formaPagamento] || v.formaPagamento),
        }));

        const totalReceita = vendasFiltradas.reduce((s, v) => s + (v.valorFinal || 0), 0);
        const ticketMedio = vendasFiltradas.length ? totalReceita / vendasFiltradas.length : 0;

        // Chart: vendas por dia
        const byDay = {};
        vendasFiltradas.forEach(v => {
            const day = fmtDate(v.dataVenda);
            if (!byDay[day]) byDay[day] = { name: day, valor: 0, qtd: 0 };
            byDay[day].valor += v.valorFinal || 0;
            byDay[day].qtd += 1;
        });
        const chartData = Object.values(byDay).sort((a, b) => {
            const [da, ma, ya] = a.name.split('/');
            const [db, mb, yb] = b.name.split('/');
            return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
        });

        return {
            columns: [
                { key: 'idVenda', label: 'ID' },
                { key: 'dataFormatada', label: 'Data' },
                { key: 'clienteNome', label: 'Cliente', render: v => v || 'Consumidor Final' },
                { key: 'vendedorNome', label: 'Vendedor' },
                { key: 'pagamentoLabel', label: 'Pagamento' },
                { key: 'valorFinal', label: 'Total', render: v => <strong>{fmt(v)}</strong> },
            ],
            data,
            kpis: [
                { label: 'Total Vendas', value: fmt(totalReceita), accent: '#22c55e' },
                { label: 'Qtd. Vendas', value: vendasFiltradas.length, accent: '#2563eb' },
                { label: 'Ticket Médio', value: fmt(ticketMedio), accent: '#8b5cf6' },
            ],
            chartData,
            chartType: 'area',
            searchKeys: ['clienteNome', 'vendedorNome', 'pagamentoLabel'],
            filterDefinitions: [
                { key: 'clienteNome', label: 'Cliente', type: 'text', placeholder: 'Nome do cliente...' },
                { key: 'vendedorNome', label: 'Vendedor', type: 'text', placeholder: 'Nome do vendedor...' },
            ],
            exportColumns: ['ID', 'Data', 'Cliente', 'Vendedor', 'Pagamento', 'Total'],
            exportKeys: ['idVenda', 'dataFormatada', 'clienteNome', 'vendedorNome', 'pagamentoLabel', 'valorFinal'],
        };
    }

    /* ─── 2. Vendas por Forma de Pagamento ─── */
    function processVendasPagamento() {
        const byPayment = {};
        vendasFiltradas.forEach(v => {
            const formas = v.pagamentos?.length
                ? v.pagamentos.map(p => p.formaPagamento)
                : [v.formaPagamento || 'outro'];
            formas.forEach(forma => {
                if (!byPayment[forma]) byPayment[forma] = { formaPagamento: forma, label: PAYMENT_LABELS[forma] || forma, quantidade: 0, total: 0 };
                byPayment[forma].quantidade += 1;
                byPayment[forma].total += v.valorFinal || 0;
            });
        });
        const data = Object.values(byPayment).sort((a, b) => b.total - a.total);
        const totalGeral = data.reduce((s, d) => s + d.total, 0);
        data.forEach(d => {
            d.percentual = totalGeral > 0 ? ((d.total / totalGeral) * 100).toFixed(1) + '%' : '0%';
            d.totalFmt = fmt(d.total);
        });

        const chartData = data.map(d => ({ name: d.label, value: d.quantidade, total: d.total }));

        return {
            columns: [
                { key: 'label', label: 'Forma de Pagamento' },
                { key: 'quantidade', label: 'Qtd. Vendas' },
                { key: 'total', label: 'Total', render: v => <strong>{fmt(v)}</strong> },
                { key: 'percentual', label: '% do Total' },
            ],
            data,
            kpis: [
                { label: 'Formas Utilizadas', value: data.length, accent: '#2563eb' },
                { label: 'Total Geral', value: fmt(totalGeral), accent: '#22c55e' },
                { label: 'Mais Usada', value: data[0]?.label || '-', accent: '#f59e0b' },
            ],
            chartData,
            chartType: 'pie',
            searchKeys: ['label'],
            filterDefinitions: [],
            exportColumns: ['Forma de Pagamento', 'Qtd. Vendas', 'Total', '% do Total'],
            exportKeys: ['label', 'quantidade', 'totalFmt', 'percentual'],
        };
    }

    /* ─── 3. Vendas por Vendedor ─── */
    function processVendasVendedor() {
        const byVendedor = {};
        vendasFiltradas.forEach(v => {
            const nome = v.vendedorNome || 'Sem vendedor';
            if (!byVendedor[nome]) byVendedor[nome] = { vendedor: nome, quantidade: 0, total: 0 };
            byVendedor[nome].quantidade += 1;
            byVendedor[nome].total += v.valorFinal || 0;
        });
        const data = Object.values(byVendedor).sort((a, b) => b.total - a.total);
        data.forEach((d, i) => {
            d.ranking = i + 1;
            d.ticketMedio = d.quantidade ? d.total / d.quantidade : 0;
            d.totalFmt = fmt(d.total);
            d.ticketMedioFmt = fmt(d.ticketMedio);
        });

        const chartData = data.slice(0, 10).map(d => ({ name: d.vendedor, valor: d.total }));

        return {
            columns: [
                { key: 'ranking', label: '#' },
                { key: 'vendedor', label: 'Vendedor' },
                { key: 'quantidade', label: 'Vendas' },
                { key: 'total', label: 'Total', render: v => <strong>{fmt(v)}</strong> },
                { key: 'ticketMedio', label: 'Ticket Médio', render: v => fmt(v) },
            ],
            data,
            kpis: [
                { label: 'Total Vendedores', value: data.length, accent: '#2563eb' },
                { label: 'Top Vendedor', value: data[0]?.vendedor || '-', accent: '#22c55e' },
                { label: 'Maior Receita', value: fmt(data[0]?.total || 0), accent: '#f59e0b' },
            ],
            chartData,
            chartType: 'bar',
            searchKeys: ['vendedor'],
            filterDefinitions: [],
            exportColumns: ['#', 'Vendedor', 'Vendas', 'Total', 'Ticket Médio'],
            exportKeys: ['ranking', 'vendedor', 'quantidade', 'totalFmt', 'ticketMedioFmt'],
        };
    }

    /* ─── 4. Vendas por Cliente ─── */
    function processVendasCliente() {
        const byCliente = {};
        vendasFiltradas.forEach(v => {
            const nome = v.clienteNome || 'Consumidor Final';
            if (!byCliente[nome]) byCliente[nome] = { cliente: nome, quantidade: 0, total: 0 };
            byCliente[nome].quantidade += 1;
            byCliente[nome].total += v.valorFinal || 0;
        });
        const data = Object.values(byCliente).sort((a, b) => b.total - a.total);
        data.forEach((d, i) => {
            d.ranking = i + 1;
            d.ticketMedio = d.quantidade ? d.total / d.quantidade : 0;
            d.totalFmt = fmt(d.total);
            d.ticketMedioFmt = fmt(d.ticketMedio);
        });

        const chartData = data.slice(0, 10).map(d => ({ name: d.cliente, valor: d.total }));

        return {
            columns: [
                { key: 'ranking', label: '#' },
                { key: 'cliente', label: 'Cliente' },
                { key: 'quantidade', label: 'Compras' },
                { key: 'total', label: 'Total', render: v => <strong>{fmt(v)}</strong> },
                { key: 'ticketMedio', label: 'Ticket Médio', render: v => fmt(v) },
            ],
            data,
            kpis: [
                { label: 'Total Clientes', value: data.length, accent: '#8b5cf6' },
                { label: 'Melhor Cliente', value: data[0]?.cliente || '-', accent: '#22c55e' },
                { label: 'Maior Valor', value: fmt(data[0]?.total || 0), accent: '#f59e0b' },
            ],
            chartData,
            chartType: 'bar',
            searchKeys: ['cliente'],
            filterDefinitions: [],
            exportColumns: ['#', 'Cliente', 'Compras', 'Total', 'Ticket Médio'],
            exportKeys: ['ranking', 'cliente', 'quantidade', 'totalFmt', 'ticketMedioFmt'],
        };
    }

    /* ─── 5. Produtos Mais Vendidos ─── */
    function processProdutosMaisVendidos() {
        const byProduto = {};
        vendasFiltradas.forEach(v => {
            (v.itens || []).forEach(item => {
                const id = item.idProduto || item.produtoNome;
                if (!byProduto[id]) byProduto[id] = { produto: item.produtoNome, quantidade: 0, receita: 0 };
                byProduto[id].quantidade += item.quantidade || 0;
                byProduto[id].receita += item.subtotal || 0;
            });
        });
        const data = Object.values(byProduto).sort((a, b) => b.quantidade - a.quantidade);
        data.forEach((d, i) => {
            d.ranking = i + 1;
            d.precoMedio = d.quantidade ? d.receita / d.quantidade : 0;
            d.receitaFmt = fmt(d.receita);
            d.precoMedioFmt = fmt(d.precoMedio);
        });

        const chartData = data.slice(0, 10).map(d => ({ name: d.produto, valor: d.receita }));

        return {
            columns: [
                { key: 'ranking', label: '#' },
                { key: 'produto', label: 'Produto' },
                { key: 'quantidade', label: 'Unid. Vendidas' },
                { key: 'receita', label: 'Receita Total', render: v => <strong>{fmt(v)}</strong> },
                { key: 'precoMedio', label: 'Preço Médio', render: v => fmt(v) },
            ],
            data,
            kpis: [
                { label: 'Produtos Vendidos', value: data.length, accent: '#22c55e' },
                { label: 'Mais Vendido', value: data[0]?.produto || '-', accent: '#2563eb' },
                { label: 'Receita Total', value: fmt(data.reduce((s, d) => s + d.receita, 0)), accent: '#f59e0b' },
            ],
            chartData,
            chartType: 'bar',
            searchKeys: ['produto'],
            filterDefinitions: [],
            exportColumns: ['#', 'Produto', 'Unid. Vendidas', 'Receita Total', 'Preço Médio'],
            exportKeys: ['ranking', 'produto', 'quantidade', 'receitaFmt', 'precoMedioFmt'],
        };
    }

    /* ─── 6. Estoque Atual ─── */
    function processEstoqueAtual() {
        const data = produtos
            .filter(p => p.ativo !== false && p.ativo !== 0)
            .map(p => ({
                ...p,
                valorEstoque: (p.preco || 0) * (p.estoque || 0),
                precoFmt: fmt(p.preco),
                valorEstoqueFmt: fmt((p.preco || 0) * (p.estoque || 0)),
                estoqueStatus: (p.estoque || 0) <= 0 ? 'Sem estoque'
                    : (p.estoque || 0) < 10 ? 'Baixo' : 'Normal',
            }));

        const totalValorEstoque = data.reduce((s, p) => s + p.valorEstoque, 0);
        const semEstoque = data.filter(p => (p.estoque || 0) <= 0).length;
        const estoqueBaixo = data.filter(p => (p.estoque || 0) > 0 && (p.estoque || 0) < 10).length;

        return {
            columns: [
                { key: 'idProduto', label: 'ID' },
                { key: 'nome', label: 'Produto' },
                { key: 'categoria', label: 'Categoria', render: v => v || '-' },
                { key: 'estoque', label: 'Estoque', render: (v) => (
                    <span className={`badge ${(v || 0) <= 0 ? 'badge-danger' : (v || 0) < 10 ? 'badge-warning' : 'badge-success'}`}>
                        {v || 0}
                    </span>
                )},
                { key: 'preco', label: 'Preço Unit.', render: v => fmt(v) },
                { key: 'valorEstoque', label: 'Valor em Estoque', render: v => <strong>{fmt(v)}</strong> },
            ],
            data,
            kpis: [
                { label: 'Total Produtos', value: data.length, accent: '#2563eb' },
                { label: 'Valor em Estoque', value: fmt(totalValorEstoque), accent: '#22c55e' },
                { label: 'Sem Estoque', value: semEstoque, accent: '#dc2626' },
                { label: 'Estoque Baixo', value: estoqueBaixo, accent: '#f59e0b' },
            ],
            chartData: null,
            searchKeys: ['nome', 'categoria'],
            filterDefinitions: [
                {
                    key: '_estoqueStatus', label: 'Status Estoque', type: 'select',
                    options: [
                        { value: '', label: 'Todos' },
                        { value: 'negativo', label: 'Sem Estoque' },
                        { value: 'zero', label: 'Zerado' },
                        { value: 'positivo', label: 'Com Estoque' },
                    ]
                },
            ],
            exportColumns: ['ID', 'Produto', 'Categoria', 'Estoque', 'Preço Unit.', 'Valor em Estoque'],
            exportKeys: ['idProduto', 'nome', 'categoria', 'estoque', 'precoFmt', 'valorEstoqueFmt'],
        };
    }

    /* ─── 7. Produtos Sem Movimento ─── */
    function processProdutosSemMovimento() {
        const produtosVendidos = new Set();
        vendasFiltradas.forEach(v => {
            (v.itens || []).forEach(item => {
                if (item.idProduto) produtosVendidos.add(item.idProduto);
            });
        });

        const data = produtos
            .filter(p => (p.ativo !== false && p.ativo !== 0) && !produtosVendidos.has(p.idProduto))
            .map(p => ({
                ...p,
                valorEstoque: (p.preco || 0) * (p.estoque || 0),
                precoFmt: fmt(p.preco),
                valorEstoqueFmt: fmt((p.preco || 0) * (p.estoque || 0)),
            }));

        const totalParado = data.reduce((s, p) => s + p.valorEstoque, 0);

        return {
            columns: [
                { key: 'idProduto', label: 'ID' },
                { key: 'nome', label: 'Produto' },
                { key: 'categoria', label: 'Categoria', render: v => v || '-' },
                { key: 'estoque', label: 'Estoque' },
                { key: 'preco', label: 'Preço', render: v => fmt(v) },
                { key: 'valorEstoque', label: 'Valor Parado', render: v => <strong style={{ color: '#dc2626' }}>{fmt(v)}</strong> },
            ],
            data,
            kpis: [
                { label: 'Produtos Parados', value: data.length, accent: '#dc2626' },
                { label: 'Capital Parado', value: fmt(totalParado), accent: '#f59e0b' },
                { label: 'Total Produtos', value: produtos.filter(p => p.ativo !== false && p.ativo !== 0).length, accent: '#2563eb' },
            ],
            chartData: null,
            searchKeys: ['nome', 'categoria'],
            filterDefinitions: [],
            exportColumns: ['ID', 'Produto', 'Categoria', 'Estoque', 'Preço', 'Valor Parado'],
            exportKeys: ['idProduto', 'nome', 'categoria', 'estoque', 'precoFmt', 'valorEstoqueFmt'],
        };
    }

    /* ─── 8. Cadastro de Clientes ─── */
    function processCadastroClientes() {
        const data = clientes.map(c => ({
            ...c,
            statusLabel: (c.ativo === false || c.ativo === 0) ? 'Inativo' : 'Ativo',
            convenioLabel: c.convenio ? 'Sim' : 'Não',
        }));

        const ativos = data.filter(c => c.statusLabel === 'Ativo').length;
        const comConvenio = data.filter(c => c.convenio).length;

        return {
            columns: [
                { key: 'idCliente', label: 'ID' },
                { key: 'nome', label: 'Nome' },
                { key: 'cpf', label: 'CPF', render: v => v || '-' },
                { key: 'telefone', label: 'Telefone', render: v => v || '-' },
                { key: 'email', label: 'Email', render: v => v || '-' },
                { key: 'statusLabel', label: 'Status', render: v => (
                    <span className={`badge ${v === 'Ativo' ? 'badge-success' : 'badge-danger'}`}>{v}</span>
                )},
            ],
            data,
            kpis: [
                { label: 'Total Clientes', value: data.length, accent: '#8b5cf6' },
                { label: 'Ativos', value: ativos, accent: '#22c55e' },
                { label: 'Com Convênio', value: comConvenio, accent: '#2563eb' },
            ],
            chartData: null,
            searchKeys: ['nome', 'cpf', 'telefone', 'email'],
            filterDefinitions: [
                {
                    key: '_status', label: 'Status', type: 'select',
                    options: [
                        { value: '', label: 'Todos' },
                        { value: 'ativo', label: 'Ativos' },
                        { value: 'inativo', label: 'Inativos' },
                    ]
                },
            ],
            exportColumns: ['ID', 'Nome', 'CPF', 'Telefone', 'Email', 'Status', 'Convênio'],
            exportKeys: ['idCliente', 'nome', 'cpf', 'telefone', 'email', 'statusLabel', 'convenioLabel'],
        };
    }

    /* ─── 9. Clientes com Convênio ─── */
    function processClientesConvenio() {
        const data = clientes
            .filter(c => c.convenio)
            .map(c => ({
                ...c,
                limiteConvenioFmt: fmt(c.limiteConvenio || 0),
                saldoDevedor: c.saldoDevedor || 0,
                saldoDevedorFmt: fmt(c.saldoDevedor || 0),
                disponivel: (c.limiteConvenio || 0) - (c.saldoDevedor || 0),
                disponivelFmt: fmt((c.limiteConvenio || 0) - (c.saldoDevedor || 0)),
                statusLabel: (c.ativo === false || c.ativo === 0) ? 'Inativo' : 'Ativo',
            }));

        const totalLimite = data.reduce((s, c) => s + (c.limiteConvenio || 0), 0);
        const totalDevedor = data.reduce((s, c) => s + (c.saldoDevedor || 0), 0);

        return {
            columns: [
                { key: 'idCliente', label: 'ID' },
                { key: 'nome', label: 'Cliente' },
                { key: 'limiteConvenio', label: 'Limite', render: v => fmt(v || 0) },
                { key: 'saldoDevedor', label: 'Saldo Devedor', render: v => (
                    <strong style={{ color: (v || 0) > 0 ? '#dc2626' : '#16a34a' }}>{fmt(v || 0)}</strong>
                )},
                { key: 'disponivel', label: 'Disponível', render: v => fmt(v) },
                { key: 'statusLabel', label: 'Status', render: v => (
                    <span className={`badge ${v === 'Ativo' ? 'badge-success' : 'badge-danger'}`}>{v}</span>
                )},
            ],
            data,
            kpis: [
                { label: 'Conveniados', value: data.length, accent: '#8b5cf6' },
                { label: 'Limite Total', value: fmt(totalLimite), accent: '#2563eb' },
                { label: 'Total Devedor', value: fmt(totalDevedor), accent: '#dc2626' },
            ],
            chartData: null,
            searchKeys: ['nome'],
            filterDefinitions: [],
            exportColumns: ['ID', 'Cliente', 'Limite', 'Saldo Devedor', 'Disponível', 'Status'],
            exportKeys: ['idCliente', 'nome', 'limiteConvenioFmt', 'saldoDevedorFmt', 'disponivelFmt', 'statusLabel'],
        };
    }

    /* ─── 10. Resumo Financeiro ─── */
    function processResumoFinanceiro() {
        const totalReceita = vendasFiltradas.reduce((s, v) => s + (v.valorFinal || 0), 0);
        const totalDescontos = vendasFiltradas.reduce((s, v) => s + (v.desconto || 0), 0);
        const totalBruto = vendasFiltradas.reduce((s, v) => s + (v.valorTotal || 0), 0);
        const ticketMedio = vendasFiltradas.length ? totalReceita / vendasFiltradas.length : 0;

        // Agrupar por dia
        const byDay = {};
        vendasFiltradas.forEach(v => {
            const day = fmtDate(v.dataVenda);
            if (!byDay[day]) byDay[day] = { name: day, receita: 0, vendas: 0 };
            byDay[day].receita += v.valorFinal || 0;
            byDay[day].vendas += 1;
        });
        const chartData = Object.values(byDay).sort((a, b) => {
            const [da, ma, ya] = a.name.split('/');
            const [db, mb, yb] = b.name.split('/');
            return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
        });

        // Dados da tabela: resumo por dia
        const data = chartData.map((d, i) => ({
            ...d,
            ranking: i + 1,
            receitaFmt: fmt(d.receita),
            ticketMedio: d.vendas ? d.receita / d.vendas : 0,
            ticketMedioFmt: fmt(d.vendas ? d.receita / d.vendas : 0),
        }));

        return {
            columns: [
                { key: 'name', label: 'Data' },
                { key: 'vendas', label: 'Qtd. Vendas' },
                { key: 'receita', label: 'Receita', render: v => <strong>{fmt(v)}</strong> },
                { key: 'ticketMedio', label: 'Ticket Médio', render: v => fmt(v) },
            ],
            data,
            kpis: [
                { label: 'Receita Líquida', value: fmt(totalReceita), accent: '#22c55e' },
                { label: 'Receita Bruta', value: fmt(totalBruto), accent: '#2563eb' },
                { label: 'Descontos', value: fmt(totalDescontos), accent: '#dc2626' },
                { label: 'Ticket Médio', value: fmt(ticketMedio), accent: '#f59e0b' },
            ],
            chartData,
            chartType: 'area',
            searchKeys: ['name'],
            filterDefinitions: [],
            exportColumns: ['Data', 'Qtd. Vendas', 'Receita', 'Ticket Médio'],
            exportKeys: ['name', 'vendas', 'receitaFmt', 'ticketMedioFmt'],
        };
    }

    /* ═══════════════════════════════════════════════════════════════
       EXPORT FUNCTIONS
    ═══════════════════════════════════════════════════════════════ */

    function exportExcel() {
        if (!reportData?.data?.length) {
            showNotification('Nenhum dado para exportar', 'warning');
            return;
        }

        const reportDef = findReport(activeReport);
        const exportData = reportData.data.map(item => {
            const row = {};
            reportData.exportColumns.forEach((col, i) => {
                let value = item[reportData.exportKeys[i]];
                if (typeof value === 'object' && value !== null) value = JSON.stringify(value);
                row[col] = value ?? '';
            });
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, reportDef?.title || 'Relatório');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `${activeReport}_${dateStart}_${dateEnd}.xlsx`);
        showNotification('Excel exportado com sucesso!', 'success');
    }

    function exportPDF() {
        if (!reportData?.data?.length) {
            showNotification('Nenhum dado para exportar', 'warning');
            return;
        }

        const reportDef = findReport(activeReport);
        const doc = new jsPDF({ orientation: reportData.exportColumns.length > 5 ? 'landscape' : 'portrait' });

        // Title
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42); // #0f172a
        doc.text(reportDef?.title || 'Relatório', 14, 20);

        // Subtitle
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184); // #94a3b8
        const needsDates = findReport(activeReport)?.needsDates;
        if (needsDates) {
            doc.text(`Período: ${fmtDate(dateStart + 'T00:00:00')} a ${fmtDate(dateEnd + 'T00:00:00')}`, 14, 28);
        }
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, needsDates ? 34 : 28);

        // Table
        const tableRows = reportData.data.map(item =>
            reportData.exportKeys.map(key => {
                let val = item[key];
                if (val == null) return '-';
                return String(val);
            })
        );

        autoTable(doc, {
            head: [reportData.exportColumns],
            body: tableRows,
            startY: needsDates ? 40 : 34,
            styles: {
                fontSize: 9,
                cellPadding: 4,
                textColor: [30, 41, 59],
            },
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9,
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
            margin: { top: 40 },
        });

        doc.save(`${activeReport}_${dateStart}_${dateEnd}.pdf`);
        showNotification('PDF exportado com sucesso!', 'success');
    }

    /* ═══════════════════════════════════════════════════════════════
       RENDER
    ═══════════════════════════════════════════════════════════════ */

    const reportDef = findReport(activeReport);

    return (
        <div className="body-relatorios">
            <Sidebar />
            <div className="content-relatorios">

                {/* ─── HEADER ─── */}
                <div className="title-page">
                    {activeReport ? (
                        <>
                            <div className="title-page-left">
                                <button className="btn-voltar" onClick={goBack}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M19 12H5M12 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <h1>{reportDef?.title || 'Relatório'}</h1>
                            </div>
                            <div className="title-page-actions">
                                <button className="btn-export btn-export-excel" onClick={exportExcel} disabled={loading || !reportData?.data?.length}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7,10 12,15 17,10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Excel
                                </button>
                                <button className="btn-export btn-export-pdf" onClick={exportPDF} disabled={loading || !reportData?.data?.length}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7,10 12,15 17,10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    PDF
                                </button>
                            </div>
                        </>
                    ) : (
                        <h1>Relatórios</h1>
                    )}
                </div>

                {/* ─── HUB VIEW ─── */}
                {!activeReport && (
                    <div className="relatorios-body">
                        <div className="relatorios-hub">
                            {REPORT_CATEGORIES.map(cat => (
                                <div className="hub-category" key={cat.id}>
                                    <div className="hub-category-header" style={{ '--cat-accent': cat.accent }}>
                                        <div className="hub-category-icon">{cat.icon}</div>
                                        <h2>{cat.title}</h2>
                                    </div>
                                    <div className="hub-cards-grid">
                                        {cat.reports.map(rep => (
                                            <button
                                                key={rep.id}
                                                className="hub-card"
                                                onClick={() => openReport(rep.id)}
                                                style={{ '--card-accent': cat.accent }}
                                            >
                                                <span className="hub-card-icon">{rep.icon}</span>
                                                <div className="hub-card-info">
                                                    <span className="hub-card-title">{rep.title}</span>
                                                    <span className="hub-card-desc">{rep.desc}</span>
                                                </div>
                                                <svg className="hub-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M9 18l6-6-6-6" />
                                                </svg>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── REPORT VIEW ─── */}
                {activeReport && (
                    <div className="relatorios-body">

                        {/* Date Filters */}
                        {reportDef?.needsDates && (
                            <div className="rel-date-bar">
                                <div className="rel-presets">
                                    {DATE_PRESETS.map(preset => (
                                        <button
                                            key={preset.label}
                                            className={`rel-preset-btn ${activePreset === preset.label ? 'active' : ''}`}
                                            onClick={() => applyPreset(preset)}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="rel-date-inputs">
                                    <div className="rel-date-field">
                                        <label>De</label>
                                        <input
                                            type="date"
                                            value={dateStart}
                                            onChange={e => {
                                                setDateStart(e.target.value);
                                                setActivePreset('');
                                            }}
                                        />
                                    </div>
                                    <div className="rel-date-field">
                                        <label>Até</label>
                                        <input
                                            type="date"
                                            value={dateEnd}
                                            onChange={e => {
                                                setDateEnd(e.target.value);
                                                setActivePreset('');
                                            }}
                                        />
                                    </div>
                                    {reportData?.filterDefinitions?.length > 0 && (
                                        <button className="btn-filter" onClick={() => setModalFiltros(true)}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                                            </svg>
                                            Filtros
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Non-date filter bar */}
                        {!reportDef?.needsDates && reportData?.filterDefinitions?.length > 0 && (
                            <div className="rel-date-bar">
                                <div className="rel-date-inputs">
                                    <button className="btn-filter" onClick={() => setModalFiltros(true)}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                                        </svg>
                                        Filtros Avançados
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Loading */}
                        {loading && (
                            <div className="rel-loading">
                                <p>Carregando dados do relatório...</p>
                            </div>
                        )}

                        {!loading && reportData && (
                            <>
                                {/* KPI Cards */}
                                {reportData.kpis?.length > 0 && (
                                    <div className="rel-kpi-grid">
                                        {reportData.kpis.map((kpi, i) => (
                                            <div className="rel-kpi-card" key={i} style={{ '--kpi-accent': kpi.accent }}>
                                                <span className="rel-kpi-label">{kpi.label}</span>
                                                <span className="rel-kpi-value">{kpi.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Chart */}
                                {reportData.chartData && reportData.chartData.length > 0 && (
                                    <div className="rel-chart-card">
                                        {reportData.chartType === 'area' && (
                                            <ResponsiveContainer width="100%" height={220}>
                                                <AreaChart data={reportData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="relGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                                                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                                                    <Tooltip content={<ChartTooltip />} />
                                                    <Area type="monotone" dataKey={reportData.chartData[0]?.receita !== undefined ? 'receita' : 'valor'} stroke="#2563eb" strokeWidth={2.5} fill="url(#relGradient)" dot={false} activeDot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        )}
                                        {reportData.chartType === 'bar' && (
                                            <ResponsiveContainer width="100%" height={220}>
                                                <BarChart data={reportData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                                                    <Tooltip content={<ChartTooltip />} />
                                                    <Bar dataKey="valor" radius={[8, 8, 0, 0]} maxBarSize={50}>
                                                        {reportData.chartData.map((_, i) => (
                                                            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                        {reportData.chartType === 'pie' && (
                                            <div className="rel-pie-wrapper">
                                                <ResponsiveContainer width="100%" height={220}>
                                                    <PieChart>
                                                        <Pie
                                                            data={reportData.chartData}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={55}
                                                            outerRadius={90}
                                                            paddingAngle={4}
                                                            dataKey="value"
                                                            label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : null}
                                                            labelLine={false}
                                                        >
                                                            {reportData.chartData.map((_, i) => (
                                                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip content={<PieTooltipCustom />} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div className="rel-pie-legend">
                                                    {reportData.chartData.map((entry, i) => (
                                                        <div className="rel-pie-legend-item" key={i}>
                                                            <span className="rel-pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                            <span className="rel-pie-legend-label">{entry.name}</span>
                                                            <span className="rel-pie-legend-value">{fmt(entry.total)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Data Table */}
                                <div className="rel-table-area">
                                    <Table
                                        columns={reportData.columns}
                                        data={reportData.data}
                                        loading={false}
                                        searchPlaceholder="Pesquisar no relatório..."
                                        searchKeys={reportData.searchKeys || []}
                                        emptyMessage="Nenhum dado encontrado para o período selecionado"
                                        advancedFilters={reportData.filterDefinitions?.length ? reportData.filterDefinitions : undefined}
                                        activeFilters={activeFilters}
                                        onFilterClick={reportData.filterDefinitions?.length ? () => setModalFiltros(true) : undefined}
                                    />
                                </div>
                            </>
                        )}

                        {/* Filter Modal */}
                        {reportData?.filterDefinitions?.length > 0 && (
                            <FilterModal
                                isOpen={modalFiltros}
                                onClose={() => setModalFiltros(false)}
                                filters={reportData.filterDefinitions}
                                activeFilters={activeFilters}
                                onApply={setActiveFilters}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Relatorios;