from app.Repositories.categoria_repository import CategoriaRepository, DashboardRepository

class CategoriaService:

    @staticmethod
    def list():
        categorias = CategoriaRepository.get_all()
        return {'status': 200, 'categorias': categorias}


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
    def get_produtos_mais_vendidos(limite):
        produtos = DashboardRepository.get_produtos_mais_vendidos(limite)
        for p in produtos:
            p['receitaTotal'] = float(p['receitaTotal'])
        return {'status': 200, 'produtos': produtos}
