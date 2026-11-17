from app.Repositories.produto_repository import ProdutoRepository
from app.Constants.geral import Geral

class ProdutoService:

    @staticmethod
    def list(incluir_inativos=False):
        produtos = ProdutoRepository.get_all(incluir_inativos)
        for p in produtos:
            p['preco'] = float(p['preco'])
            p['precoCusto'] = float(p['precoCusto']) if p.get('precoCusto') is not None else None
            p['margemLucro'] = float(p['margemLucro']) if p.get('margemLucro') is not None else None
        return {'status': 200, 'produtos': produtos}

    @staticmethod
    def create(dados):
        erro = ProdutoService._validar(dados)
        if erro:
            return {'status': 400, 'error': erro}

        produto_id = ProdutoRepository.create(dados)
        return {'status': 201, 'message': Geral.PRODUTO_CADASTRADO, 'id': produto_id}

    @staticmethod
    def update(id, dados):
        erro = ProdutoService._validar(dados, excluir_id=id)
        if erro:
            return {'status': 400, 'error': erro}

        ProdutoRepository.update(id, dados)
        return {'status': 200, 'message': Geral.PRODUTO_ATUALIZADO}

    @staticmethod
    def _validar(dados, excluir_id=None):
        if not dados.get('nome') or not ProdutoService._preco_valido(dados.get('preco')):
            return 'Descrição e um preço de venda maior que zero são obrigatórios.'

        codigo_barras = (dados.get('codigoBarras') or '').strip()
        if not codigo_barras:
            return 'Código de barras é obrigatório.'
        if ProdutoRepository.find_by_codigo_barras(codigo_barras, excluir_id):
            return 'Código de barras já está em uso por outro produto.'

        preco_custo = dados.get('precoCusto')
        if preco_custo not in (None, ''):
            try:
                if float(preco_custo) < 0:
                    return 'Preço de custo não pode ser negativo.'
            except (TypeError, ValueError):
                return 'Preço de custo inválido.'

        estoque_minimo = dados.get('estoqueMinimo')
        if estoque_minimo not in (None, ''):
            try:
                if int(estoque_minimo) < 0:
                    return 'Estoque mínimo não pode ser negativo.'
            except (TypeError, ValueError):
                return 'Estoque mínimo inválido.'

        margem_lucro = dados.get('margemLucro')
        if margem_lucro not in (None, ''):
            try:
                # Mesmo range da coluna DECIMAL(6,2) do banco — rejeita aqui
                # com uma mensagem clara em vez de deixar o INSERT estourar.
                if abs(float(margem_lucro)) > 9999.99:
                    return 'Margem de lucro fora do intervalo permitido (até 9999,99%).'
            except (TypeError, ValueError):
                return 'Margem de lucro inválida.'

        return None

    @staticmethod
    def _preco_valido(preco):
        try:
            return float(preco) > 0
        except (TypeError, ValueError):
            return False

    @staticmethod
    def gerar_codigo_barras():
        """Gera um código interno curto e sequencial (1, 2, 3, ...) garantido
        único entre os produtos cadastrados, para uso quando o produto não
        tem um código de barras real."""
        codigo = 1
        while codigo <= 100000:  # salvaguarda, nunca deve chegar nem perto
            if not ProdutoRepository.find_by_codigo_barras(str(codigo)):
                return {'status': 200, 'codigoBarras': str(codigo)}
            codigo += 1
        return {'status': 500, 'error': 'Não foi possível gerar um código único. Tente novamente.'}

    @staticmethod
    def delete(id):
        ProdutoRepository.soft_delete(id)
        return {'status': 200, 'message': Geral.PRODUTO_REMOVIDO}

    @staticmethod
    def reactivate(id):
        ProdutoRepository.reactivate(id)
        return {'status': 200, 'message': 'Produto reativado com sucesso.'}
