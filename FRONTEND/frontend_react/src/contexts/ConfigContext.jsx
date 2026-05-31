import { createContext, useContext, useState, useCallback } from 'react';

const FORMAS_PADRAO = [
    { value: 'dinheiro',       label: 'Dinheiro',        icon: '💵', shortcut: 'F1' },
    { value: 'cartao_credito', label: 'Cartão de Crédito', icon: '💳', shortcut: 'F2' },
    { value: 'cartao_debito',  label: 'Cartão de Débito',  icon: '💳', shortcut: 'F3' },
    { value: 'pix',            label: 'PIX',              icon: '📱', shortcut: 'F4' },
    { value: 'outro',          label: 'Outro',            icon: '📋', shortcut: 'F5' },
    { value: 'convenio',       label: 'Convênio',         icon: '🤝', shortcut: 'F6' },
];

function carregarFormas() {
    try {
        const salvo = localStorage.getItem('formasPagamento');
        if (salvo) {
            const parsed = JSON.parse(salvo);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (_) { /* ignore */ }
    return FORMAS_PADRAO;
}

function carregarPermiteExcluir() {
    try {
        return localStorage.getItem('permiteExcluir') === 'true';
    } catch (_) {
        return false;
    }
}

function carregarPermiteEstoqueNegativo() {
    try {
        return localStorage.getItem('permiteEstoqueNegativo') === 'true';
    } catch (_) {
        return false;
    }
}

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
    const [formasPagamento, setFormasPagamento] = useState(carregarFormas);
    const [permiteExcluir, setPermiteExcluirState] = useState(carregarPermiteExcluir);
    const [permiteEstoqueNegativo, setPermiteEstoqueNegativoState] = useState(carregarPermiteEstoqueNegativo);

    const salvarFormas = useCallback((novasFormas) => {
        // Reatribuir atalhos F1, F2... na ordem
        const comAtalhos = novasFormas.map((f, i) => ({
            ...f,
            shortcut: `F${i + 1}`,
        }));
        setFormasPagamento(comAtalhos);
        localStorage.setItem('formasPagamento', JSON.stringify(comAtalhos));
    }, []);

    const setPermiteExcluir = useCallback((valor) => {
        setPermiteExcluirState(valor);
        localStorage.setItem('permiteExcluir', String(valor));
    }, []);

    const setPermiteEstoqueNegativo = useCallback((valor) => {
        setPermiteEstoqueNegativoState(valor);
        localStorage.setItem('permiteEstoqueNegativo', String(valor));
    }, []);

    const resetFormas = useCallback(() => {
        setFormasPagamento(FORMAS_PADRAO);
        localStorage.removeItem('formasPagamento');
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
            FORMAS_PADRAO,
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
