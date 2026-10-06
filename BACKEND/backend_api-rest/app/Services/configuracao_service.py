import json
from app.Repositories.configuracao_repository import ConfiguracaoRepository


class ConfiguracaoService:

    @staticmethod
    def listar():
        valores = ConfiguracaoRepository.get_all()

        dados_empresa_raw = valores.get('dadosEmpresa')
        try:
            dados_empresa = json.loads(dados_empresa_raw) if dados_empresa_raw else None
        except (TypeError, ValueError):
            dados_empresa = None

        return {
            'status': 200,
            'configuracoes': {
                'permiteEstoqueNegativo': str(valores.get('permiteEstoqueNegativo', 'false')).lower() == 'true',
                'dadosEmpresa': dados_empresa,
            }
        }

    @staticmethod
    def atualizar(dados):
        if 'permiteEstoqueNegativo' in dados:
            ConfiguracaoRepository.set('permiteEstoqueNegativo', bool(dados['permiteEstoqueNegativo']))
        if 'dadosEmpresa' in dados:
            ConfiguracaoRepository.set('dadosEmpresa', json.dumps(dados['dadosEmpresa']))
        return ConfiguracaoService.listar()
