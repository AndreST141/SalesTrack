import { useState, useEffect } from 'react';
import Sidebar from '../../components/SideBar/sidebar';
import { useNotification } from '../../contexts/NotificationContext';
import api from '../../services/api';
import { formatarDataAtual } from '../../utils/data';
import '../configuracoes/style.css';
import './style.css';

const LICENCA_STATUS_LABELS = { ativa: 'Ativa', suspensa: 'Suspensa', expirada: 'Expirada', cancelada: 'Cancelada' };

function mascaraCNPJ(value) {
    const nums = value.replace(/\D/g, '').slice(0, 14);
    return nums
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
}

function Licenca() {
    const dataAtual = formatarDataAtual();
    const { showNotification } = useNotification();

    const [licenca, setLicenca] = useState(null);
    const [licencaForm, setLicencaForm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erros, setErros] = useState({});

    useEffect(() => {
        async function carregarLicenca() {
            setLoading(true);
            try {
                const res = await api.get('/licenca');
                setLicenca(res.data);
                setLicencaForm(res.data);
            } catch (err) {
                console.error('Erro ao carregar licença:', err);
                showNotification('Erro ao carregar licença.', 'error');
            } finally {
                setLoading(false);
            }
        }
        carregarLicenca();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleChange(field, value) {
        setLicencaForm((prev) => ({ ...prev, [field]: value }));
        if (erros[field]) setErros((prev) => ({ ...prev, [field]: null }));
    }

    async function salvarLicenca() {
        const e = {};
        if (!licencaForm?.dataInicio) e.dataInicio = 'Campo obrigatório';
        if (Object.keys(e).length > 0) {
            setErros(e);
            return;
        }

        setSalvando(true);
        try {
            const res = await api.put('/licenca', licencaForm);
            setLicenca(res.data);
            setLicencaForm(res.data);
            showNotification('Licença atualizada com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao salvar licença:', err);
            showNotification(err.response?.data?.error || 'Erro ao salvar licença.', 'error');
        } finally {
            setSalvando(false);
        }
    }

    return (
        <div className="body-licenca">
            <Sidebar />
            <div className="content-licenca">
                <div className="title-page">
                    <h1>Licença</h1>
                    <span>{dataAtual}</span>
                </div>
                <div className="licenca-body">
                    <div className="config-card">
                        <div className="config-card-header">
                            <div className="config-card-icon config-card-icon--amber">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                                    <path d="M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z" />
                                </svg>
                            </div>
                            <div>
                                <h2>Licença do Sistema</h2>
                                <p>Situação da licença desta instalação do SalesTrack</p>
                            </div>
                            {licenca && (
                                <span className={`config-card-status ${licenca.ativa ? 'config-card-status--ok' : 'config-card-status--inc'}`}>
                                    {licenca.ativa ? '✓ Ativa' : '⚠ Inativa'}
                                </span>
                            )}
                        </div>
                        <div className="config-card-body">
                            {loading ? (
                                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '12px 0' }}>Carregando licença...</p>
                            ) : (
                                <>
                                    <div className="config-row">
                                        <div className="config-field">
                                            <label>Razão Social</label>
                                            <input type="text" placeholder="Razão Social da Empresa"
                                                value={licencaForm?.razaoSocial || ''}
                                                onChange={e => handleChange('razaoSocial', e.target.value)}
                                            />
                                        </div>
                                        <div className="config-field">
                                            <label>CNPJ</label>
                                            <input type="text" placeholder="00.000.000/0000-00"
                                                value={licencaForm?.cnpj || ''}
                                                onChange={e => handleChange('cnpj', mascaraCNPJ(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                    <div className="config-row config-row--3col">
                                        <div className="config-field">
                                            <label>Identificador</label>
                                            <input type="text" placeholder="Código/chave da licença"
                                                value={licencaForm?.identificador || ''}
                                                onChange={e => handleChange('identificador', e.target.value)}
                                            />
                                        </div>
                                        <div className="config-field">
                                            <label>Status</label>
                                            <select
                                                value={licencaForm?.status || 'ativa'}
                                                onChange={e => handleChange('status', e.target.value)}
                                            >
                                                {Object.entries(LICENCA_STATUS_LABELS).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="config-field">
                                            <label>Data de Início <span className="required">*</span></label>
                                            <input type="date"
                                                value={licencaForm?.dataInicio || ''}
                                                onChange={e => handleChange('dataInicio', e.target.value)}
                                                className={erros.dataInicio ? 'input-error' : ''}
                                            />
                                            {erros.dataInicio && <span className="field-error">{erros.dataInicio}</span>}
                                        </div>
                                    </div>
                                    <div className="config-row">
                                        <div className="config-field">
                                            <label>Data de Vencimento <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span></label>
                                            <input type="date"
                                                value={licencaForm?.dataVencimento || ''}
                                                onChange={e => handleChange('dataVencimento', e.target.value || null)}
                                            />
                                        </div>
                                        <div className="config-field">
                                            <label>Observações</label>
                                            <input type="text" placeholder="Anotações internas sobre a licença"
                                                value={licencaForm?.observacoes || ''}
                                                onChange={e => handleChange('observacoes', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="config-info-box">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="16" x2="12" y2="12" />
                                            <line x1="12" y1="8" x2="12.01" y2="8" />
                                        </svg>
                                        <span>Com a licença inativa ou vencida, apenas o usuário técnico consegue acessar o sistema.</span>
                                    </div>
                                    <div className="config-card-actions">
                                        <button className="btn-primary" onClick={salvarLicenca} disabled={salvando}>
                                            {salvando ? 'Salvando...' : 'Salvar Licença'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Licenca;
