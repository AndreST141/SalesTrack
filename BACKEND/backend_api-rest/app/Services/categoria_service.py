from app.Repositories.categoria_repository import CategoriaRepository, DashboardRepository

class CategoriaService:

    @staticmethod
    def list():
        categorias = CategoriaRepository.get_all()
        return {'status': 200, 'categorias': categorias}

    @staticmethod
    def create(dados):
        nome = (dados.get('nome') or '').strip()
        if not nome:
            return {'status': 400, 'error': 'Nome da categoria é obrigatório.'}
        if CategoriaRepository.find_by_nome(nome):
            return {'status': 400, 'error': 'Já existe uma categoria com esse nome.'}

        categoria_id = CategoriaRepository.create(nome, dados.get('descricao', ''))
        return {'status': 201, 'id': categoria_id, 'nome': nome}

    @staticmethod
    def delete(id):
        categoria = CategoriaRepository.find_by_id(id)
        if not categoria:
            return {'status': 404, 'error': 'Categoria não encontrada.'}
        if categoria['nome'] == 'Geral':
            return {'status': 400, 'error': 'A categoria "Geral" não pode ser excluída — é a categoria padrão do sistema.'}

        total_produtos = CategoriaRepository.contar_produtos_vinculados(id)
        if total_produtos > 0:
            return {
                'status': 400,
                'error': f'Não é possível excluir: {total_produtos} produto(s) ainda estão nesta categoria. Mova-os para outra categoria primeiro.',
            }

        CategoriaRepository.delete(id)
        return {'status': 200, 'message': 'Categoria excluída com sucesso.'}


class DashboardService:

    @staticmethod
    def get_kpis(periodo):
        kpis, estoque = DashboardRepository.get_kpis(periodo)
        return {
            'status': 200,
            'totalVendas':            kpis['totalVendas'],
            'receitaTotal':           float(kpis['receitaTotal']),
            'ticketMedio':            float(kpis['ticketMedio']),
            'produtosBaixoEstoque':   estoque['produtosBaixoEstoque']
        }

    @staticmethod
    def get_vendas_por_periodo(dias):
        vendas = DashboardRepository.get_vendas_por_periodo(dias)
        for v in vendas:
            v['data']    = v['data'].strftime('%Y-%m-%d')
            v['receita'] = float(v['receita'])
        return {'status': 200, 'vendas': vendas}

    @staticmethod
    def get_produtos_mais_vendidos(limite, periodo):
        produtos = DashboardRepository.get_produtos_mais_vendidos(limite, periodo)
        for p in produtos:
            p['receitaTotal'] = float(p['receitaTotal'])
        return {'status': 200, 'produtos': produtos}
