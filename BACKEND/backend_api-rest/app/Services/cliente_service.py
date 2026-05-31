from app.Repositories.cliente_repository import ClienteRepository
from app.Constants.geral import Geral

class ClienteService:

    @staticmethod
    def list(incluir_inativos=False):
        clientes = ClienteRepository.get_all(incluir_inativos)
        return {'status': 200, 'clientes': clientes}

    @staticmethod
    def create(dados):
        if not dados.get('nome'):
            return {'status': 400, 'error': 'Nome é obrigatório.'}

        cliente_id = ClienteRepository.create(dados)
        return {'status': 201, 'message': Geral.CLIENTE_CADASTRADO, 'id': cliente_id}

    @staticmethod
    def update(id, dados):
        if not dados.get('nome'):
            return {'status': 400, 'error': 'Nome é obrigatório.'}
        ClienteRepository.update(id, dados)
        return {'status': 200, 'message': Geral.CLIENTE_ATUALIZADO}

    @staticmethod
    def reactivate(id):
        ClienteRepository.reactivate(id)
        return {'status': 200, 'message': 'Cliente reativado com sucesso.'}

    @staticmethod
    def delete(id):
        ClienteRepository.soft_delete(id)
        return {'status': 200, 'message': Geral.CLIENTE_REMOVIDO}
