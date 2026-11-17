import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Modal from '../../components/Modal/Modal';
import api from '../../services/api';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { labelFormaPagamento } from '../../utils/pagamento';
import './style.css';

// Perfis que podem registrar pagamento (quitar saldo devedor) de convênio —
// mesmo grupo que já autoriza cancelamento de venda no backend.
const PERFIS_PAGAMENTO = ['admin', 'supervisor', 'tecnico'];

function ModalConvenio({ isOpen, onClose, cliente, onUpdate }) {
    const { formasPagamento, dadosEmpresa } = useConfig();
    const { user } = useAuth();
    const { showNotification } = useNotification();

    const [dadosConvenio, setDadosConvenio] = useState(null);
    const [carregando, setCarregando] = useState(false);

    const [modalPagamento, setModalPagamento] = useState(false);
    const [formaPagamento, setFormaPagamento] = useState('');
    const [observacaoPagamento, setObservacaoPagamento] = useState('');
    const [pagando, setPagando] = useState(false);
    const [lancamentoParaPagar, setLancamentoParaPagar] = useState(null); // null = pagar tudo
    const [ultimoRecibo, setUltimoRecibo] = useState(null);

    const podeProcessarPagamento = PERFIS_PAGAMENTO.includes(user?.tipo);
    const formasParaQuitar = formasPagamento.filter((f) => f.especial !== 'convenio');

    const fmt = (val) =>
        Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const fmtData = (iso) =>
        new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

    async function carregarConvenio() {
        if (!cliente) return;
        setCarregando(true);
        try {
            const res = await api.get(`/clientes/${cliente.idCliente}/convenio`);
            setDadosConvenio(res.data);
        } catch (err) {
            showNotification(err.response?.data?.error || 'Erro ao carregar convênio', 'error');
        } finally {
            setCarregando(false);
        }
    }

    useEffect(() => {
        if (isOpen && cliente) {
            setUltimoRecibo(null);
            carregarConvenio();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, cliente]);

    const lancamentos = dadosConvenio?.lancamentos || [];
    const pendentes = lancamentos.filter((l) => l.status === 'pendente');
    const pagos = lancamentos.filter((l) => l.status === 'pago');
    const totalDevedor = dadosConvenio?.saldoDevedor || 0;
    const limiteTotal = dadosConvenio?.limiteConvenio || 0;
    const limiteDisponivel = Math.max(0, limiteTotal - totalDevedor);
    const percentualUsado = limiteTotal > 0 ? Math.min(100, (totalDevedor / limiteTotal) * 100) : 0;

    function abrirPagamentoTotal() {
        setLancamentoParaPagar(null);
        setFormaPagamento(formasParaQuitar[0]?.value || '');
        setObservacaoPagamento('');
        setModalPagamento(true);
    }

    function abrirPagamentoItem(lancamento) {
        setLancamentoParaPagar(lancamento);
        setFormaPagamento(formasParaQuitar[0]?.value || '');
        setObservacaoPagamento('');
        setModalPagamento(true);
    }

    async function confirmarPagamento() {
        const idsLancamentos = lancamentoParaPagar
            ? [lancamentoParaPagar.idLancamento]
            : pendentes.map((l) => l.idLancamento);

        if (idsLancamentos.length === 0) return;

        setPagando(true);
        try {
            const res = await api.post(`/clientes/${cliente.idCliente}/convenio/pagamento`, {
                idsLancamentos,
                formaPagamento,
                observacao: observacaoPagamento,
            });
            showNotification('Pagamento registrado com sucesso!', 'success');
            setUltimoRecibo(res.data.recibo);
            setModalPagamento(false);
            await carregarConvenio();
            if (onUpdate) onUpdate();
        } catch (err) {
            showNotification(err.response?.data?.error || 'Erro ao registrar pagamento', 'error');
        } finally {
            setPagando(false);
        }
    }

    function gerarPDFRecibo(recibo) {
        const doc = new jsPDF({ orientation: 'portrait' });

        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.text('Recibo de Pagamento — Convênio', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        let y = 28;
        const nomeEmpresa = dadosEmpresa?.cadastro?.nomeFantasia || dadosEmpresa?.cadastro?.razaoSocial;
        if (nomeEmpresa) { doc.text(nomeEmpresa, 14, y); y += 6; }
        doc.text(`Cliente: ${recibo.cliente?.nome || cliente?.nome || ''}`, 14, y); y += 6;
        if (recibo.cliente?.cpf) { doc.text(`CPF: ${recibo.cliente.cpf}`, 14, y); y += 6; }
        doc.text(`Forma de pagamento: ${labelFormaPagamento(recibo.formaPagamento, formasPagamento)}`, 14, y); y += 6;
        doc.text(`Data: ${new Date().toLocaleString('pt-BR')}`, 14, y); y += 6;
        if (recibo.observacao) { doc.text(`Observação: ${recibo.observacao}`, 14, y); y += 6; }

        autoTable(doc, {
            head: [['Venda', 'Valor']],
            body: recibo.lancamentos.map((l) => [`#${l.idVenda}`, fmt(l.valor)]),
            startY: y + 4,
            styles: { fontSize: 9, cellPadding: 4, textColor: [30, 41, 59] },
            headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(`Total pago: ${fmt(recibo.valorTotal)}`, 14, doc.lastAutoTable.finalY + 10);

        doc.save(`recibo_convenio_${recibo.idPagamento}.pdf`);
        showNotification('PDF gerado com sucesso!', 'success');
    }

    if (!cliente) return null;

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={`Convênio — ${cliente.nome}`}
                maxWidth="720px"
                closeOnOverlayClick={false}
                footer={
                    <div className="convenio-modal-footer">
                        <button className="btn-modal-cancel" onClick={onClose}>Fechar</button>
                        {podeProcessarPagamento && totalDevedor > 0 && (
                            <button className="btn-modal-confirm btn-pagar-tudo" onClick={abrirPagamentoTotal}>
                                Pagar Total: {fmt(totalDevedor)}
                            </button>
                        )}
                    </div>
                }
            >
                {carregando && !dadosConvenio ? (
                    <div className="convenio-empty">
                        <p>Carregando dados do convênio...</p>
                    </div>
                ) : (
                    <>
                        {ultimoRecibo && (
                            <div className="convenio-recibo-banner">
                                <span>Pagamento de {fmt(ultimoRecibo.valorTotal)} registrado</span>
                                <button onClick={() => gerarPDFRecibo(ultimoRecibo)}>Baixar recibo em PDF</button>
                            </div>
                        )}

                        {/* ── Cards de resumo ── */}
                        <div className="convenio-resumo-grid">
                            <div className="convenio-resumo-card convenio-card-devedor">
                                <span className="convenio-card-label">Saldo Devedor</span>
                                <span className="convenio-card-valor devedor">{fmt(totalDevedor)}</span>
                                <span className="convenio-card-sub">{pendentes.length} lançamento(s) pendente(s)</span>
                            </div>
                            <div className="convenio-resumo-card convenio-card-limite">
                                <span className="convenio-card-label">Limite Total</span>
                                <span className="convenio-card-valor">{fmt(limiteTotal)}</span>
                                <span className="convenio-card-sub">Disponível: {fmt(limiteDisponivel)}</span>
                            </div>
                            <div className="convenio-resumo-card convenio-card-pago">
                                <span className="convenio-card-label">Total Pago</span>
                                <span className="convenio-card-valor pago">
                                    {fmt(pagos.reduce((s, l) => s + l.valor, 0))}
                                </span>
                                <span className="convenio-card-sub">{pagos.length} lançamento(s) quitado(s)</span>
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

                        {/* ── Lançamentos Pendentes ── */}
                        <div className="convenio-section-title">
                            <span>Lançamentos Pendentes</span>
                            {pendentes.length === 0 && (
                                <span className="convenio-vazio-tag">Nenhuma pendência</span>
                            )}
                        </div>

                        {pendentes.length > 0 && (
                            <div className="convenio-table-wrapper">
                                <table className="convenio-table">
                                    <thead>
                                        <tr>
                                            <th>Data</th>
                                            <th>Descrição</th>
                                            <th>Valor</th>
                                            {podeProcessarPagamento && <th>Ação</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendentes.map((l) => (
                                            <tr key={l.idLancamento}>
                                                <td className="convenio-td-data">{fmtData(l.dataLancamento)}</td>
                                                <td>Venda #{l.idVenda}</td>
                                                <td className="convenio-td-valor pendente">{fmt(l.valor)}</td>
                                                {podeProcessarPagamento && (
                                                    <td>
                                                        <button
                                                            className="btn-pagar-item"
                                                            onClick={() => abrirPagamentoItem(l)}
                                                        >
                                                            Pagar
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ── Lançamentos Quitados ── */}
                        {pagos.length > 0 && (
                            <>
                                <div className="convenio-section-title">
                                    <span>Lançamentos Quitados</span>
                                </div>
                                <div className="convenio-table-wrapper">
                                    <table className="convenio-table">
                                        <thead>
                                            <tr>
                                                <th>Data da Venda</th>
                                                <th>Descrição</th>
                                                <th>Valor</th>
                                                <th>Pago em</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pagos.map((l) => (
                                                <tr key={l.idLancamento} className="compra-paga-row">
                                                    <td className="convenio-td-data">{fmtData(l.dataLancamento)}</td>
                                                    <td>Venda #{l.idVenda}</td>
                                                    <td className="convenio-td-valor pago">{fmt(l.valor)}</td>
                                                    <td className="convenio-td-data">
                                                        {l.dataPagamento ? fmtData(l.dataPagamento) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {lancamentos.length === 0 && (
                            <div className="convenio-empty">
                                <span>📋</span>
                                <p>Nenhum lançamento registrado neste convênio</p>
                            </div>
                        )}
                    </>
                )}
            </Modal>

            {/* Modal Pagamento do Convênio */}
            <Modal
                isOpen={modalPagamento}
                onClose={() => setModalPagamento(false)}
                title={lancamentoParaPagar ? `Pagar Venda #${lancamentoParaPagar.idVenda}` : 'Pagar Saldo Total'}
                maxWidth="420px"
                onConfirm={confirmarPagamento}
                closeOnOverlayClick={false}
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
                    <span className="pagamento-convenio-valor">
                        {fmt(lancamentoParaPagar ? lancamentoParaPagar.valor : totalDevedor)}
                    </span>
                </div>

                <div className="form-group">
                    <label>Forma de Pagamento</label>
                    <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
                        {formasParaQuitar.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
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
            </Modal>
        </>
    );
}

export default ModalConvenio;
