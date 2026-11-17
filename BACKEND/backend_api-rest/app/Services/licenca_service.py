import json
from datetime import date
from app.Repositories.licenca_repository import LicencaRepository
from app.Repositories.configuracao_repository import ConfiguracaoRepository


class LicencaService:

    @staticmethod
    def obter():
        row = LicencaRepository.get()
        if not row:
            return {'status': 200, 'licenca': None}

        licenca = dict(row)
        if licenca.get('dataInicio'):
            licenca['dataInicio'] = licenca['dataInicio'].isoformat()
        if licenca.get('dataVencimento'):
            licenca['dataVencimento'] = licenca['dataVencimento'].isoformat()
        licenca['ativa'] = LicencaService._esta_ativa(row)
        licenca['dadosEmpresaConfigurados'] = LicencaService._dados_empresa_configurados()

        return {'status': 200, 'licenca': licenca}

    @staticmethod
    def atualizar(dados):
        if not dados.get('dataInicio'):
            return {'status': 400, 'error': 'Data de início é obrigatória.'}

        # A liberação da licença parte dos dados da empresa já estarem
        # configurados — não dá pra marcar como 'ativa' antes disso.
        if dados.get('status') == 'ativa' and not LicencaService._dados_empresa_configurados():
            return {
                'status': 400,
                'error': 'Configure os dados da empresa em Configurações antes de liberar a licença.',
            }

        LicencaRepository.upsert(dados)
        return LicencaService.obter()

    @staticmethod
    def _dados_empresa_configurados():
        """Considera configurado quando ao menos o nome e o CNPJ da empresa
        foram preenchidos em Configurações (dadosEmpresa.cadastro)."""
        valor_raw = ConfiguracaoRepository.get('dadosEmpresa')
        if not valor_raw:
            return False
        try:
            dados = json.loads(valor_raw)
        except (TypeError, ValueError):
            return False
        cadastro = (dados or {}).get('cadastro') or {}
        nome = (cadastro.get('razaoSocial') or cadastro.get('nomeFantasia') or '').strip()
        cnpj = (cadastro.get('cnpj') or '').strip()
        return bool(nome) and bool(cnpj)

    @staticmethod
    def _esta_ativa(row):
        # Sem licença cadastrada: não bloqueia (evita travar instalação nova
        # antes de o seed rodar, ou se a linha for removida manualmente).
        if not row:
            return True
        if row['status'] != 'ativa':
            return False
        venc = row.get('dataVencimento')
        if venc and venc < date.today():
            return False
        return True

    @staticmethod
    def licenca_permite_acesso():
        return LicencaService.motivo_bloqueio() is None

    @staticmethod
    def motivo_bloqueio():
        """None = acesso liberado. Caso contrário, mensagem explicando por
        que o sistema ainda está bloqueado (fora o técnico) — a licença só
        libera o acesso quando está ativa E os dados da empresa já foram
        configurados; uma coisa depende da outra."""
        if not LicencaService._esta_ativa(LicencaRepository.get()):
            return 'Licença inativa ou vencida. Entre em contato com o suporte.'
        if not LicencaService._dados_empresa_configurados():
            return 'Sistema aguardando configuração dos dados da empresa. Entre em contato com o suporte técnico.'
        return None
