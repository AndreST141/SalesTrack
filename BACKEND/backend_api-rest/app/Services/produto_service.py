from app.Repositories.produto_repository import ProdutoRepository
from app.Constants.geral import Geral

class ProdutoService:

    @staticmethod
    def list(incluir_inativos=False):
        produtos = ProdutoRepository.get_all(incluir_inativos)
        for p in produtos:
            p['preco'] = float(p['preco'])
        return {'status': 200, 'produtos': produtos}

    @staticmethod
    def create(dados):
        if not dados.get('nome') or not dados.get('preco'):
            return {'status': 400, 'error': 'Nome e preço são obrigatórios.'}

        produto_id = ProdutoRepository.create(dados)
        return {'status': 201, 'message': Geral.PRODUTO_CADASTRADO, 'id': produto_id}

    @staticmethod
    def update(id, dados):
        if not dados.get('nome') or not dados.get('preco'):
            return {'status': 400, 'error': 'Nome e preço são obrigatórios.'}

        ProdutoRepository.update(id, dados)
        return {'status': 200, 'message': Geral.PRODUTO_ATUALIZADO}

    @staticmethod
    def delete(id):
        ProdutoRepository.soft_delete(id)
        return {'status': 200, 'message': Geral.PRODUTO_REMOVIDO}

    @staticmethod
    def reactivate(id):
        ProdutoRepository.reactivate(id)
        return {'status': 200, 'message': 'Produto reativado com sucesso.'}
