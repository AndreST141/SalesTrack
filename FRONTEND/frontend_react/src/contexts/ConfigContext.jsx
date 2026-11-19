import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import StorageService from '../services/storageService';
import api from '../services/api';

const FORMAS_PADRAO = [
    { value: 'dinheiro',       label: 'Dinheiro',          shortcut: 'F1' },
    { value: 'cartao_credito', label: 'Cartão de Crédito', shortcut: 'F2' },
    { value: 'cartao_debito',  label: 'Cartão de Débito',  shortcut: 'F3' },
    { value: 'pix',            label: 'PIX',               shortcut: 'F4' },
    { value: 'outro',          label: 'Outro',             shortcut: 'F5' },
    // { value: 'convenio',       label: 'Convênio',          shortcut: 'F6' },
];

// ─── Defaults ──────────────────────────────────────────────────────

const DADOS_EMPRESA_DEFAULT = {
    cadastro: {
        razaoSocial: '',
        nomeFantasia: '',
        cnpj: '',
        inscricaoEstadual: '',
    },
    endereco: {
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        pais: 'Brasil',
    },
};

// A impressora é do computador do caixa, não da instalação: por isso esta
// configuração fica só no navegador (não vai para o backend) e é enviada ao
// Agente de Impressão local a cada impressão.
const CONFIG_IMPRESSORA_DEFAULT = {
    // 'termica_spooler' | 'termica_serial' | 'comum_windows'
    tipo: 'termica_spooler',
    impressora: '',        // nome da impressora no Windows (tipos via spooler)
    portaSerial: '',       // ex.: 'COM3' (tipo termica_serial)
    baudRate: 9600,
    colunas: 48,           // 48/42 = bobina de 80 mm, 32 = bobina de 58 mm
    acentuacao: 'sem_acentos',   // 'sem_acentos' | 'cp850' | 'cp860'
    cortarPapel: true,
};

// ─── Loaders (via StorageService) ──────────────────────────────────

function carregarFormas() {
    const salvo = StorageService.get('formasPagamento', null);
    if (Array.isArray(salvo) && salvo.length > 0) return salvo;
    return FORMAS_PADRAO;
}

function carregarPermiteExcluir() {
    return StorageService.get('permiteExcluir', false);
}

function carregarPermiteEstoqueNegativo() {
    return StorageService.get('permiteEstoqueNegativo', false);
}

function normalizarDadosEmpresa(dados) {
    if (!dados || typeof dados !== 'object') return DADOS_EMPRESA_DEFAULT;
    return {
        cadastro: {
            ...DADOS_EMPRESA_DEFAULT.cadastro,
            ...(dados.cadastro || {}),
        },
        endereco: {
            ...DADOS_EMPRESA_DEFAULT.endereco,
            ...(dados.endereco || {}),
        },
    };
}

function carregarDadosEmpresa() {
    return normalizarDadosEmpresa(StorageService.get('dadosEmpresa', DADOS_EMPRESA_DEFAULT));
}

// Mantém só os campos conhecidos: descarta o formato antigo ({ formato }) e
// completa o que faltar num valor salvo por versão anterior ou vindo de backup.
function carregarConfigImpressora() {
    const salvo = StorageService.get('configImpressora', null) || {};
    return Object.fromEntries(
        Object.entries(CONFIG_IMPRESSORA_DEFAULT).map(([chave, padrao]) => [
            chave,
            typeof salvo[chave] === typeof padrao ? salvo[chave] : padrao,
        ])
    );
}

// ─── Context ───────────────────────────────────────────────────────

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
    const [formasPagamento, setFormasPagamento] = useState(carregarFormas);
    const [permiteExcluir, setPermiteExcluirState] = useState(carregarPermiteExcluir);
    const [permiteEstoqueNegativo, setPermiteEstoqueNegativoState] = useState(carregarPermiteEstoqueNegativo);
    const [dadosEmpresa, setDadosEmpresaState] = useState(carregarDadosEmpresa);
    const [configImpressora, setConfigImpressoraState] = useState(carregarConfigImpressora);

    // formasPagamento é configuração do sistema (vale para todos os caixas) —
    // vive no backend, com o localStorage como cache. O contexto só muda depois
    // do servidor confirmar.
    const salvarFormas = useCallback(async (novasFormas) => {
        // Reatribuir atalhos F1, F2... na ordem
        const comAtalhos = novasFormas.map((f, i) => ({
            ...f,
            shortcut: `F${i + 1}`,
        }));
        await api.put('/configuracoes', { formasPagamento: comAtalhos });
        setFormasPagamento(comAtalhos);
        StorageService.set('formasPagamento', comAtalhos);
    }, []);

    const setPermiteExcluir = useCallback((valor) => {
        setPermiteExcluirState(valor);
        StorageService.set('permiteExcluir', valor);
    }, []);

    // permiteEstoqueNegativo é uma configuração do sistema (compartilhada entre
    // todos os usuários/dispositivos) — vive no backend (tabela Configuracao).
    // O localStorage é usado só como cache para não haver "flash" de valor
    // padrão antes da resposta do servidor chegar.
    // Se o servidor recusar, desfaz a mudança otimista — senão a tela mostraria
    // um valor que não vale de fato (a venda é validada pelo backend).
    const setPermiteEstoqueNegativo = useCallback(async (valor) => {
        const anterior = permiteEstoqueNegativo;
        setPermiteEstoqueNegativoState(valor);
        StorageService.set('permiteEstoqueNegativo', valor);
        try {
            await api.put('/configuracoes', { permiteEstoqueNegativo: valor });
        } catch (err) {
            setPermiteEstoqueNegativoState(anterior);
            StorageService.set('permiteEstoqueNegativo', anterior);
            throw err;
        }
    }, [permiteEstoqueNegativo]);

    const sincronizarConfiguracoesDoServidor = useCallback(async () => {
        try {
            const res = await api.get('/configuracoes');
            if (typeof res.data?.permiteEstoqueNegativo === 'boolean') {
                setPermiteEstoqueNegativoState(res.data.permiteEstoqueNegativo);
                StorageService.set('permiteEstoqueNegativo', res.data.permiteEstoqueNegativo);
            }
            if (res.data?.dadosEmpresa && typeof res.data.dadosEmpresa === 'object') {
                const normalizado = normalizarDadosEmpresa(res.data.dadosEmpresa);
                setDadosEmpresaState(normalizado);
                StorageService.set('dadosEmpresa', normalizado);
            }
            if (Array.isArray(res.data?.formasPagamento) && res.data.formasPagamento.length > 0) {
                setFormasPagamento(res.data.formasPagamento);
                StorageService.set('formasPagamento', res.data.formasPagamento);
            }
        } catch (err) {
            console.error('Erro ao sincronizar configurações do servidor:', err);
        }
    }, []);

    // Ao carregar a aplicação com um token já salvo (F5 na página, por exemplo),
    // busca a configuração real do servidor por cima do cache local.
    useEffect(() => {
        if (localStorage.getItem('token')) {
            sincronizarConfiguracoesDoServidor();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // dadosEmpresa também é uma configuração do sistema (não do navegador) —
    // persiste no backend, para valer para todos os usuários/dispositivos da
    // instalação, com o localStorage como cache.
    // Aqui o contexto só é atualizado depois do servidor confirmar: o rascunho
    // fica no formulário da tela, então não há "flash" a evitar e uma falha
    // não deixa dados não salvos valendo para o resto do app.
    const setDadosEmpresa = useCallback(async (dados) => {
        await api.put('/configuracoes', { dadosEmpresa: dados });
        setDadosEmpresaState(dados);
        StorageService.set('dadosEmpresa', dados);
    }, []);

    const setConfigImpressora = useCallback((config) => {
        setConfigImpressoraState(config);
        StorageService.set('configImpressora', config);
    }, []);

    const resetFormas = useCallback(() => salvarFormas(FORMAS_PADRAO), [salvarFormas]);

    return (
        <ConfigContext.Provider value={{
            formasPagamento,
            salvarFormas,
            resetFormas,
            permiteExcluir,
            setPermiteExcluir,
            permiteEstoqueNegativo,
            setPermiteEstoqueNegativo,
            sincronizarConfiguracoesDoServidor,
            dadosEmpresa,
            setDadosEmpresa,
            configImpressora,
            setConfigImpressora,
            FORMAS_PADRAO,
            DADOS_EMPRESA_DEFAULT,
            CONFIG_IMPRESSORA_DEFAULT,
        }}>
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfig() {
    const ctx = useContext(ConfigContext);
    if (!ctx) throw new Error('useConfig deve ser usado dentro de ConfigProvider');
    return ctx;
}
