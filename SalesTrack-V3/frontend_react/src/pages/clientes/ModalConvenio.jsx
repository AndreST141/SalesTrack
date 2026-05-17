import { useState, useEffect } from 'react';
import Modal from '../../components/Modal/Modal';
import './style.css';

// ─── Dados mock de compras do convênio ────────────────────────────────────────
// Quando o back estiver pronto, trocar por chamadas api.get('/convenio/:idCliente')
function gerarComprasMock(idCliente) {
    if (!idCliente) return [];
    // Simula compras baseadas no ID para ser consistente
    const seed = idCliente * 17;
    const compras = [
        {
            id: seed + 1,
            data: '2026-03-28T14:30:00',
            descricao: 'Compra #' + (seed + 1),
            valor: 87.50,
            status: 'pendente',
        },
        {
            id: seed + 2,
            data: '2026-04-02T09:15:00',
            descricao: 'Compra #' + (seed + 2),
            valor: 124.00,
            status: 'pendente',
        },
        {
            id: seed + 3,
            data: '2026-04-05T16:45:00',
            descricao: 'Compra #' + (seed + 3),
            valor: 56.75,
            status: 'pago',
            dataPagamento: '2026-04-06T10:00:00',
        },
        {
            id: seed + 4,
            data: '2026-04-09T11:20:00',
            descricao: 'Compra #' + (seed + 4),
            valor: 200.00,
            status: 'pendente',
        },
    ];
    return compras;
}

function ModalConvenio({ isOpen, onClose, cliente, onUpdate }) {
    const [compras, setCompras] = useState([]);
    const [modalPagamento, setModalPagamento] = useState(false);
    const [valorPagamento, setValorPagamento] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('dinheiro');
    const [observacaoPagamento, setObservacaoPagamento] = useState('');
    const [pagando, setPagando] = useState(false);
    const [compraParaPagar, setCompraParaPagar] = useState(null); // null = pagar tudo

    const fmt = (val) =>
        Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const fmtData = (iso) =>
        new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

    useEffect(() => {
        if (isOpen && cliente) {
            // TODO: substituir por api.get(`/convenio/${cliente.idCliente}`)
            setCompras(gerarComprasMock(cliente.idCliente));
        }
    }, [isOpen, cliente]);

    const comprasPendentes = compras.filter((c) => c.status === 'pendente');
    const comprasPagas = compras.filter((c) => c.status === 'pago');
    const totalDevedor = comprasPendentes.reduce((s, c) => s + c.valor, 0);
    const limiteUsado = totalDevedor;
    const limiteTotal = cliente?.limiteConvenio || 0;
    const limiteDisponivel = Math.max(0, limiteTotal - limiteUsado);
    const percentualUsado = limiteTotal > 0 ? Math.min(100, (limiteUsado / limiteTotal) * 100) : 0;

    function abrirPagamentoTotal() {
        setCompraParaPagar(null);
        setValorPagamento(totalDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        setFormaPagamento('dinheiro');
        setObservacaoPagamento('');
        setModalPagamento(true);
    }

    function abrirPagamentoItem(compra) {
        setCompraParaPagar(compra);
        setValorPagamento(compra.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        setFormaPagamento('dinheiro');
        setObservacaoPagamento('');
        setModalPagamento(true);
    }

    async function confirmarPagamento() {
        setPagando(true);
        try {
            // TODO: chamar api.post('/convenio/pagamento', { ... })
            await new Promise((r) => setTimeout(r, 800)); // simula delay

            if (compraParaPagar) {
                setCompras((prev) =>
                    prev.map((c) =>
                        c.id === compraParaPagar.id
                            ? { ...c, status: 'pago', dataPagamento: new Date().toISOString() }
                            : c
                    )
                );
            } else {
                // Pagar tudo
                setCompras((prev) =>
                    prev.map((c) =>
                        c.status === 'pendente'
                            ? { ...c, status: 'pago', dataPagamento: new Date().toISOString() }
                            : c
                    )
                );
            }

            setModalPagamento(false);
            if (onUpdate) onUpdate();
        } finally {
            setPagando(false);
        }
    }

    if (!cliente) return null;

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={`Convênio — ${cliente.nome}`}
                maxWidth="720px"
                footer={
                    <div className="convenio-modal-footer">
                        <button className="btn-modal-cancel" onClick={onClose}>Fechar</button>
                        {totalDevedor > 0 && (
                            <button className="btn-modal-confirm btn-pagar-tudo" onClick={abrirPagamentoTotal}>
                                💳 Pagar Tudo ({fmt(totalDevedor)})
                            </button>
                        )}
                    </div>
                }
            >
                {/* ── Cards de resumo ── */}
                <div className="convenio-resumo-grid">
                    <div className="convenio-resumo-card convenio-card-devedor">
                        <span className="convenio-card-label">Saldo Devedor</span>
                        <span className="convenio-card-valor devedor">{fmt(totalDevedor)}</span>
                        <span className="convenio-card-sub">{comprasPendentes.length} compra(s) pendente(s)</span>
                    </div>
                    <div className="convenio-resumo-card convenio-card-limite">
                        <span className="convenio-card-label">Limite Total</span>
                        <span className="convenio-card-valor">{fmt(limiteTotal)}</span>
                        <span className="convenio-card-sub">Disponível: {fmt(limiteDisponivel)}</span>
                    </div>
                    <div className="convenio-resumo-card convenio-card-pago">
                        <span className="convenio-card-label">Total Pago</span>
                        <span className="convenio-card-valor pago">
                            {fmt(comprasPagas.reduce((s, c) => s + c.valor, 0))}
                        </span>
                        <span className="convenio-card-sub">{comprasPagas.length} compra(s) quitada(s)</span>
                    </div>
                </div>

                {/* ── Barra de uso do limite ── */}
                {limiteTotal > 0 && (
                    <div className="convenio-limite-bar-wrapper">
                        <div className="convenio-limite-bar-header">
                            <span>Uso do Limite</span>
                            <span className={percentualUsado >= 80 ? 'limite-critico' : ''}>
                                {percentualUsado.toFixed(0)}%
                            </span>
                        </div>
                        <div className="convenio-limite-bar">
                            <div
                                className={`convenio-limite-fill ${percentualUsado >= 90 ? 'fill-critico' : percentualUsado >= 60 ? 'fill-alerta' : 'fill-ok'}`}
                                style={{ width: `${percentualUsado}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* ── Compras Pendentes ── */}
                <div className="convenio-section-title">
                    <span>⏳ Compras Pendentes</span>
                    {comprasPendentes.length === 0 && (
                        <span className="convenio-vazio-tag">Nenhuma pendência</span>
                    )}
                </div>

                {comprasPendentes.length > 0 && (
                    <div className="convenio-table-wrapper">
                        <table className="convenio-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Descrição</th>
                                    <th>Valor</th>
                                    <th>Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comprasPendentes.map((c) => (
                                    <tr key={c.id}>
                                        <td className="convenio-td-data">{fmtData(c.data)}</td>
                                        <td>{c.descricao}</td>
                                        <td className="convenio-td-valor pendente">{fmt(c.valor)}</td>
                                        <td>
                                            <button
                                                className="btn-pagar-item"
                                                onClick={() => abrirPagamentoItem(c)}
                                            >
                                                Pagar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Compras Pagas ── */}
                {comprasPagas.length > 0 && (
                    <>
                        <div className="convenio-section-title">
                            <span>✅ Compras Quitadas</span>
                        </div>
                        <div className="convenio-table-wrapper">
                            <table className="convenio-table">
                                <thead>
                                    <tr>
                                        <th>Data da Compra</th>
                                        <th>Descrição</th>
                                        <th>Valor</th>
                                        <th>Pago em</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comprasPagas.map((c) => (
                                        <tr key={c.id} className="compra-paga-row">
                                            <td className="convenio-td-data">{fmtData(c.data)}</td>
                                            <td>{c.descricao}</td>
                                            <td className="convenio-td-valor pago">{fmt(c.valor)}</td>
                                            <td className="convenio-td-data">
                                                {c.dataPagamento ? fmtData(c.dataPagamento) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {compras.length === 0 && (
                    <div className="convenio-empty">
                        <span>📋</span>
                        <p>Nenhuma compra registrada neste convênio</p>
                    </div>
                )}
            </Modal>

            {/* Modal Pagamento do Convênio */}
            <Modal
                isOpen={modalPagamento}
                onClose={() => setModalPagamento(false)}
                title={compraParaPagar ? `Pagar Compra #${compraParaPagar.id}` : 'Pagar Saldo Total'}
                maxWidth="420px"
                onConfirm={confirmarPagamento}
                footer={
                    <>
                        <button className="btn-modal-cancel" onClick={() => setModalPagamento(false)}>
                            Cancelar
                        </button>
                        <button
                            className="btn-modal-confirm"
                            onClick={confirmarPagamento}
                            disabled={pagando}
                        >
                            {pagando ? 'Registrando...' : '✓ Confirmar Pagamento'}
                        </button>
                    </>
                }
            >
                <div className="pagamento-convenio-info">
                    <span className="pagamento-convenio-cliente">{cliente.nome}</span>
                    <span className="pagamento-convenio-valor">{fmt(compraParaPagar ? compraParaPagar.valor : totalDevedor)}</span>
                </div>

                <div className="form-group">
                    <label>Forma de Pagamento</label>
                    <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="pix">PIX</option>
                        <option value="cartao_debito">Cartão de Débito</option>
                        <option value="cartao_credito">Cartão de Crédito</option>
                        <option value="outro">Outro</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Observação (opcional)</label>
                    <textarea
                        value={observacaoPagamento}
                        onChange={(e) => setObservacaoPagamento(e.target.value)}
                        placeholder="Ex: Pago em duas vezes..."
                        rows={2}
                    />
                </div>

                <div className="pagamento-convenio-aviso">
                    ⚠️ Este registro é local (protótipo). O backend será integrado em breve.
                </div>
            </Modal>
        </>
    );
}

export default ModalConvenio;
