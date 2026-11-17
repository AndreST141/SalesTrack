import re
from app.Repositories.cliente_repository import ClienteRepository
from app.Constants.geral import Geral

class ClienteService:

    @staticmethod
    def list(incluir_inativos=False):
        clientes = ClienteRepository.get_all(incluir_inativos)
        for c in clientes:
            c['limiteConvenio'] = float(c['limiteConvenio']) if c.get('limiteConvenio') is not None else None
            c['saldoDevedor'] = float(c.get('saldoDevedor') or 0)
        return {'status': 200, 'clientes': clientes}

    @staticmethod
    def _validar(dados, excluir_id=None):
        if not dados.get('nome'):
            return 'Nome é obrigatório.'

        cpf_raw = dados.get('cpf') or ''
        cpf = re.sub(r'\D', '', cpf_raw)
        if cpf:
            if not ClienteService._cpf_valido(cpf):
                return 'CPF inválido.'
            if ClienteRepository.find_by_cpf(cpf_raw, excluir_id):
                return 'Já existe um cliente cadastrado com esse CPF.'

        return None

    @staticmethod
    def _cpf_valido(cpf):
        """Mesma regra de dígito verificador já usada no frontend (clientes.jsx)."""
        if len(cpf) != 11 or cpf == cpf[0] * 11:
            return False

        def calc(tamanho):
            soma = sum(int(cpf[i]) * (tamanho + 1 - i) for i in range(tamanho))
            resto = (soma * 10) % 11
            return 0 if resto == 10 else resto

        return int(cpf[9]) == calc(9) and int(cpf[10]) == calc(10)

    @staticmethod
    def create(dados):
        erro = ClienteService._validar(dados)
        if erro:
            return {'status': 400, 'error': erro}

        cliente_id = ClienteRepository.create(dados)
        return {'status': 201, 'message': Geral.CLIENTE_CADASTRADO, 'id': cliente_id}

    @staticmethod
    def update(id, dados):
        erro = ClienteService._validar(dados, excluir_id=id)
        if erro:
            return {'status': 400, 'error': erro}

        if dados.get('convenio') is False:
            saldo = ClienteRepository.get_saldo_convenio(id)
            if saldo and saldo['saldoDevedor'] > 0:
                return {'status': 400, 'error': Geral.CLIENTE_CONVENIO_DESABILITAR_BLOQUEADO}

        ClienteRepository.update(id, dados)
        return {'status': 200, 'message': Geral.CLIENTE_ATUALIZADO}

    @staticmethod
    def reactivate(id):
        ClienteRepository.reactivate(id)
        return {'status': 200, 'message': 'Cliente reativado com sucesso.'}

    @staticmethod
    def delete(id):
        saldo = ClienteRepository.get_saldo_convenio(id)
        if saldo and saldo['saldoDevedor'] > 0:
            return {'status': 400, 'error': Geral.CLIENTE_REMOCAO_BLOQUEADA_SALDO}

        ClienteRepository.soft_delete(id)
        return {'status': 200, 'message': Geral.CLIENTE_REMOVIDO}
