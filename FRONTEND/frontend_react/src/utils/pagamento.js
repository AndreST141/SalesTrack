// Helpers das formas de pagamento (cadastráveis em Configurações).

// Atalhos F1..F8 no PDV — F9 e F12 já são usados para cancelar/finalizar.
export const MAX_FORMAS_PAGAMENTO = 8;

/**
 * Gera o identificador gravado na venda a partir do nome digitado.
 * Ex.: "Vale Alimentação" → "vale_alimentacao"
 */
export function slugFormaPagamento(label) {
    return String(label || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50);
}

/**
 * Nome de exibição de uma forma de pagamento gravada numa venda.
 *
 * @param {string} value — identificador gravado (ex.: "cartao_credito")
 * @param {Array} formas — formas cadastradas (ConfigContext.formasPagamento)
 * @param {object} labelsFixos — rótulos próprios da tela, com prioridade
 *
 * Vendas antigas podem ter uma forma que já foi excluída do cadastro; nesse
 * caso o identificador é convertido de volta em texto legível.
 */
export function labelFormaPagamento(value, formas = [], labelsFixos = {}) {
    if (!value) return '-';
    if (labelsFixos[value]) return labelsFixos[value];
    const cadastrada = formas.find((f) => f.value === value);
    if (cadastrada) return cadastrada.label;
    return String(value)
        .split('_')
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
}
