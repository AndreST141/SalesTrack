// Monta o comprovante de pagamento como linhas de texto de largura fixa,
// prontas para o Agente de Impressão (services/impressaoService.js).
//
// O layout fica aqui, e não no agente, para que mudar o cupom não exija
// atualizar o agente instalado em cada caixa. Cada linha é
// { texto, negrito?, duplo? } — "duplo" é altura dupla, a largura não muda,
// então toda linha tem no máximo `colunas` caracteres.

import { labelFormaPagamento } from './pagamento';

const moeda = (valor) =>
    Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const limpar = (texto) => String(texto ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();

const linha = (texto = '', estilo = {}) => ({ texto, ...estilo });

function centralizar(texto, colunas) {
    const recorte = texto.slice(0, colunas);
    return ' '.repeat(Math.floor((colunas - recorte.length) / 2)) + recorte;
}

// Rótulo à esquerda e valor encostado na margem direita
function duasColunas(esquerda, direita, colunas) {
    const rotulo = esquerda.slice(0, Math.max(0, colunas - direita.length - 1));
    return rotulo + ' '.repeat(Math.max(1, colunas - rotulo.length - direita.length)) + direita;
}

// Quebra por palavras sem passar da largura do papel
function quebrar(texto, colunas) {
    const linhas = [];
    let atual = '';
    for (let palavra of limpar(texto).split(' ').filter(Boolean)) {
        while (palavra.length > colunas) {
            if (atual) { linhas.push(atual); atual = ''; }
            linhas.push(palavra.slice(0, colunas));
            palavra = palavra.slice(colunas);
        }
        if (!atual) atual = palavra;
        else if (atual.length + 1 + palavra.length <= colunas) atual += ` ${palavra}`;
        else { linhas.push(atual); atual = palavra; }
    }
    if (atual) linhas.push(atual);
    return linhas;
}

function cabecalhoEmpresa(empresa, colunas) {
    const cadastro = empresa?.cadastro || {};
    const endereco = empresa?.endereco || {};
    const linhas = [];
    const centro = (texto, estilo) =>
        quebrar(texto, colunas).forEach((t) => linhas.push(linha(centralizar(t, colunas), estilo)));

    const nomeFantasia = limpar(cadastro.nomeFantasia);
    const razaoSocial = limpar(cadastro.razaoSocial);

    if (nomeFantasia || razaoSocial) {
        centro((nomeFantasia || razaoSocial).toUpperCase(), { negrito: true, duplo: true });
    }
    if (nomeFantasia && razaoSocial && nomeFantasia !== razaoSocial) centro(razaoSocial);
    if (limpar(cadastro.cnpj)) centro(`CNPJ: ${limpar(cadastro.cnpj)}`);
    if (limpar(cadastro.inscricaoEstadual)) centro(`IE: ${limpar(cadastro.inscricaoEstadual)}`);

    const rua = [endereco.logradouro, endereco.numero].map(limpar).filter(Boolean).join(', ');
    const ruaCompleta = [rua, limpar(endereco.complemento), limpar(endereco.bairro)].filter(Boolean).join(' - ');
    if (ruaCompleta) centro(ruaCompleta);

    const cidade = [endereco.cidade, endereco.estado].map(limpar).filter(Boolean).join('/');
    const cep = limpar(endereco.cep) ? `CEP ${limpar(endereco.cep)}` : '';
    const cidadeCep = [cidade, cep].filter(Boolean).join(' - ');
    if (cidadeCep) centro(cidadeCep);

    return linhas;
}

/**
 * Comprovante de pagamento de uma venda.
 *
 * @param {object} params
 * @param {object} params.empresa — dadosEmpresa (ConfigContext)
 * @param {object} params.venda — venda no formato de GET /vendas/:id
 *   (idVenda, dataVenda, vendedorNome, clienteNome, observacoes, valorTotal,
 *   desconto, acrescimo, valorFinal, itens[], pagamentos[])
 * @param {number} params.colunas — configImpressora.colunas
 * @param {Array} params.formasPagamento — formas cadastradas, para os nomes
 * @returns {Array<{ texto: string, negrito?: boolean, duplo?: boolean }>}
 */
export function montarComprovante({ empresa, venda, colunas, formasPagamento = [] }) {
    const separador = linha('-'.repeat(colunas));
    const linhas = cabecalhoEmpresa(empresa, colunas);
    if (linhas.length) linhas.push(separador);

    linhas.push(linha(centralizar('COMPROVANTE DE PAGAMENTO', colunas), { negrito: true }));
    linhas.push(linha(centralizar('NÃO É DOCUMENTO FISCAL', colunas)));
    linhas.push(separador);

    const data = venda.dataVenda ? new Date(venda.dataVenda) : new Date();
    const dataHora = data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    linhas.push(linha(duasColunas(venda.idVenda ? `Venda: ${venda.idVenda}` : 'Venda', dataHora, colunas)));
    if (limpar(venda.vendedorNome)) {
        linhas.push(linha(`Operador: ${limpar(venda.vendedorNome)}`.slice(0, colunas)));
    }
    linhas.push(linha(`Cliente: ${limpar(venda.clienteNome) || 'Consumidor final'}`.slice(0, colunas)));
    // É em observacoes que o PDV grava o CPF informado na venda ("CPF: ...")
    quebrar(venda.observacoes, colunas).forEach((t) => linhas.push(linha(t)));
    linhas.push(separador);

    linhas.push(linha('# DESCRIÇÃO', { negrito: true }));
    linhas.push(linha(duasColunas('  QTD x UNITÁRIO', 'TOTAL', colunas), { negrito: true }));
    (venda.itens || []).forEach((item, i) => {
        const numero = String(i + 1).padStart(2, '0');
        quebrar(`${numero} ${item.produtoNome ?? item.nome ?? ''}`, colunas)
            .forEach((t) => linhas.push(linha(t)));
        linhas.push(linha(duasColunas(
            `  ${item.quantidade} x ${moeda(item.precoUnitario)}`,
            moeda(item.subtotal),
            colunas,
        )));
    });
    linhas.push(separador);

    const desconto = Number(venda.desconto) || 0;
    const acrescimo = Number(venda.acrescimo) || 0;
    const total = Number(venda.valorFinal) || 0;

    linhas.push(linha(duasColunas('Subtotal', moeda(venda.valorTotal), colunas)));
    if (desconto > 0) linhas.push(linha(duasColunas('Desconto', `-${moeda(desconto)}`, colunas)));
    if (acrescimo > 0) linhas.push(linha(duasColunas('Acréscimo', `+${moeda(acrescimo)}`, colunas)));
    linhas.push(linha(duasColunas('TOTAL', `R$ ${moeda(total)}`, colunas), { negrito: true, duplo: true }));
    linhas.push(separador);

    // Vendas antigas não têm a lista de pagamentos, só a forma principal
    const pagamentos = venda.pagamentos?.length
        ? venda.pagamentos
        : [{ formaPagamento: venda.formaPagamento, valor: total }];

    linhas.push(linha('FORMA DE PAGAMENTO', { negrito: true }));
    pagamentos.forEach((p) => {
        const forma = labelFormaPagamento(p.formaPagamento ?? p.forma, formasPagamento);
        linhas.push(linha(duasColunas(forma, moeda(p.valor), colunas)));
    });
    const totalPago = pagamentos.reduce((soma, p) => soma + (Number(p.valor) || 0), 0);
    if (totalPago - total > 0.009) {
        linhas.push(linha(duasColunas('Troco', moeda(totalPago - total), colunas), { negrito: true }));
    }
    linhas.push(separador);

    linhas.push(linha(centralizar('Obrigado pela preferência!', colunas)));
    return linhas;
}

/**
 * Página de teste da tela de Configurações: dados para conferir a largura do
 * papel e a acentuação, seguidos de um comprovante de exemplo com os dados
 * reais da empresa.
 *
 * @param {object} params
 * @param {object} params.empresa — dadosEmpresa (ConfigContext)
 * @param {object} params.config — configuração de impressora em teste
 * @param {string} params.dispositivo — nome da impressora ou porta, para exibir
 * @param {string} params.operador — nome do usuário logado
 * @param {Array} params.formasPagamento — formas cadastradas
 */
export function montarPaginaTeste({ empresa, config, dispositivo, operador, formasPagamento = [] }) {
    const { colunas } = config;
    const formas = formasPagamento.length ? formasPagamento : [{ value: 'dinheiro', label: 'Dinheiro' }];

    const vendaExemplo = {
        idVenda: 'EXEMPLO',
        dataVenda: new Date(),
        vendedorNome: operador,
        clienteNome: '',
        observacoes: 'CPF: 000.000.000-00',
        itens: [
            { produtoNome: 'Produto de exemplo', quantidade: 2, precoUnitario: 12.5, subtotal: 25 },
            {
                produtoNome: 'Produto com descrição mais comprida para conferir a quebra de linha',
                quantidade: 1, precoUnitario: 49.9, subtotal: 49.9,
            },
        ],
        valorTotal: 74.9,
        desconto: 4.9,
        acrescimo: 2,
        valorFinal: 72,
        pagamentos: [
            { formaPagamento: formas[0].value, valor: 50 },
            { formaPagamento: (formas[1] || formas[0]).value, valor: 30 },
        ],
    };

    return [
        linha(centralizar('PÁGINA DE TESTE', colunas), { negrito: true, duplo: true }),
        ...quebrar(`Impressora: ${dispositivo}`, colunas).map((t) => linha(t)),
        linha(`Largura: ${colunas} colunas`),
        linha('Acentos: ação, pão, ÁÉÍÓÚ ãõç'),
        // Se a régua quebrar em duas linhas, o papel é mais estreito que o configurado
        linha('1234567890'.repeat(7).slice(0, colunas)),
        ...quebrar('A régua acima deve ocupar exatamente uma linha.', colunas).map((t) => linha(t)),
        linha('-'.repeat(colunas)),
        ...montarComprovante({ empresa, venda: vendaExemplo, colunas, formasPagamento }),
    ];
}
