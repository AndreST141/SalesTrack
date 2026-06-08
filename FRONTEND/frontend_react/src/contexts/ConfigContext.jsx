import { createContext, useContext, useState, useCallback } from 'react';
import StorageService from '../services/storageService';

const FORMAS_PADRAO = [
    { value: 'dinheiro',       label: 'Dinheiro',        icon: '💵', shortcut: 'F1' },
    { value: 'cartao_credito', label: 'Cartão de Crédito', icon: '💳', shortcut: 'F2' },
    { value: 'cartao_debito',  label: 'Cartão de Débito',  icon: '💳', shortcut: 'F3' },
    { value: 'pix',            label: 'PIX',              icon: '📱', shortcut: 'F4' },
    { value: 'outro',          label: 'Outro',            icon: '📋', shortcut: 'F5' },
    // { value: 'convenio',       label: 'Convênio',         icon: '🤝', shortcut: 'F6' },
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

const CONFIG_IMPRESSORA_DEFAULT = {
    formato: 'cupom_80mm',
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

function carregarDadosEmpresa() {
    return StorageService.get('dadosEmpresa', DADOS_EMPRESA_DEFAULT);
}

function carregarConfigImpressora() {
    return StorageService.get('configImpressora', CONFIG_IMPRESSORA_DEFAULT);
}

// ─── Context ───────────────────────────────────────────────────────

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
    const [formasPagamento, setFormasPagamento] = useState(carregarFormas);
    const [permiteExcluir, setPermiteExcluirState] = useState(carregarPermiteExcluir);
    const [permiteEstoqueNegativo, setPermiteEstoqueNegativoState] = useState(carregarPermiteEstoqueNegativo);
    const [dadosEmpresa, setDadosEmpresaState] = useState(carregarDadosEmpresa);
    const [configImpressora, setConfigImpressoraState] = useState(carregarConfigImpressora);

    const salvarFormas = useCallback((novasFormas) => {
        // Reatribuir atalhos F1, F2... na ordem
        const comAtalhos = novasFormas.map((f, i) => ({
            ...f,
            shortcut: `F${i + 1}`,
        }));
        setFormasPagamento(comAtalhos);
        StorageService.set('formasPagamento', comAtalhos);
    }, []);

    const setPermiteExcluir = useCallback((valor) => {
        setPermiteExcluirState(valor);
        StorageService.set('permiteExcluir', valor);
    }, []);

    const setPermiteEstoqueNegativo = useCallback((valor) => {
        setPermiteEstoqueNegativoState(valor);
        StorageService.set('permiteEstoqueNegativo', valor);
    }, []);

    const setDadosEmpresa = useCallback((dados) => {
        setDadosEmpresaState(dados);
        StorageService.set('dadosEmpresa', dados);
    }, []);

    const setConfigImpressora = useCallback((config) => {
        setConfigImpressoraState(config);
        StorageService.set('configImpressora', config);
    }, []);

    const resetFormas = useCallback(() => {
        setFormasPagamento(FORMAS_PADRAO);
        StorageService.remove('formasPagamento');
    }, []);

    return (
        <ConfigContext.Provider value={{
            formasPagamento,
            salvarFormas,
            resetFormas,
            permiteExcluir,
            setPermiteExcluir,
            permiteEstoqueNegativo,
            setPermiteEstoqueNegativo,
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
