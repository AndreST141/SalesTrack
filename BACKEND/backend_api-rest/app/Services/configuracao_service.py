import json
import re
from app.Repositories.configuracao_repository import ConfiguracaoRepository


class ConfiguracaoService:

    # Atalhos F1..F8 no PDV (F9 e F12 já são usados para cancelar/finalizar)
    MAX_FORMAS_PAGAMENTO = 8
    # 'value' é gravado em Venda/PagamentoVenda.formaPagamento (VARCHAR(50))
    FORMA_VALUE_REGEX = re.compile(r'^[a-z0-9_]{1,50}$')

    @staticmethod
    def _carregar_json(valor_raw):
        try:
            return json.loads(valor_raw) if valor_raw else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def listar():
        valores = ConfiguracaoRepository.get_all()

        dados_empresa = ConfiguracaoService._carregar_json(valores.get('dadosEmpresa'))

        # None = nunca configurado; o frontend usa a lista padrão nesse caso
        formas_pagamento = ConfiguracaoService._carregar_json(valores.get('formasPagamento'))
        if not isinstance(formas_pagamento, list) or not formas_pagamento:
            formas_pagamento = None

        return {
            'status': 200,
            'configuracoes': {
                'permiteEstoqueNegativo': str(valores.get('permiteEstoqueNegativo', 'false')).lower() == 'true',
                'dadosEmpresa': dados_empresa,
                'formasPagamento': formas_pagamento,
            }
        }

    @staticmethod
    def _normalizar_formas_pagamento(formas):
        """Valida e normaliza a lista de formas de pagamento.
        Retorna (lista, None) em caso de sucesso ou (None, mensagem de erro)."""
        if not isinstance(formas, list) or not formas:
            return None, 'Informe ao menos uma forma de pagamento.'
        if len(formas) > ConfiguracaoService.MAX_FORMAS_PAGAMENTO:
            return None, f'Máximo de {ConfiguracaoService.MAX_FORMAS_PAGAMENTO} formas de pagamento.'

        normalizadas = []
        valores_usados = set()
        especiais_usados = 0
        for forma in formas:
            if not isinstance(forma, dict):
                return None, 'Forma de pagamento inválida.'
            value = str(forma.get('value') or '').strip()
            label = str(forma.get('label') or '').strip()
            especial = forma.get('especial')

            if not ConfiguracaoService.FORMA_VALUE_REGEX.match(value):
                return None, 'Identificador de forma de pagamento inválido.'
            if not label or len(label) > 40:
                return None, 'O nome da forma de pagamento deve ter de 1 a 40 caracteres.'
            if value in valores_usados:
                return None, f'Forma de pagamento duplicada: {label}.'
            valores_usados.add(value)

            if especial not in (None, 'convenio'):
                return None, 'Valor inválido para "especial".'
            if especial == 'convenio':
                especiais_usados += 1
                if especiais_usados > 1:
                    return None, 'Apenas uma forma de pagamento pode ser vinculada como Convênio.'

            normalizadas.append({
                'value': value,
                'label': label,
                'shortcut': f'F{len(normalizadas) + 1}',
                'especial': especial,
            })
        return normalizadas, None

    @staticmethod
    def atualizar(dados):
        # Valida tudo antes de gravar qualquer chave
        formas = None
        if 'formasPagamento' in dados:
            formas, erro = ConfiguracaoService._normalizar_formas_pagamento(dados['formasPagamento'])
            if erro:
                return {'status': 400, 'error': erro}

        if 'permiteEstoqueNegativo' in dados:
            ConfiguracaoRepository.set('permiteEstoqueNegativo', bool(dados['permiteEstoqueNegativo']))
        if 'dadosEmpresa' in dados:
            ConfiguracaoRepository.set('dadosEmpresa', json.dumps(dados['dadosEmpresa']))
        if formas is not None:
            ConfiguracaoRepository.set('formasPagamento', json.dumps(formas, ensure_ascii=False))
        return ConfiguracaoService.listar()
