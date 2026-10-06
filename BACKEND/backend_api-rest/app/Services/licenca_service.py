from datetime import date
from app.Repositories.licenca_repository import LicencaRepository


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

        return {'status': 200, 'licenca': licenca}

    @staticmethod
    def atualizar(dados):
        if not dados.get('dataInicio'):
            return {'status': 400, 'error': 'Data de início é obrigatória.'}
        LicencaRepository.upsert(dados)
        return LicencaService.obter()

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
        return LicencaService._esta_ativa(LicencaRepository.get())
