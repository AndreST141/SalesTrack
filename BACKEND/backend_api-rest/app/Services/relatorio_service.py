from app.Repositories.relatorio_repository import RelatorioRepository


class RelatorioService:

    @staticmethod
    def get_vendas_periodo(data_inicio, data_fim):
        vendas = RelatorioRepository.get_vendas_periodo(data_inicio, data_fim)
        for v in vendas:
            v['valorTotal'] = float(v['valorTotal'])
            v['desconto']   = float(v['desconto'])
            v['valorFinal'] = float(v['valorFinal'])
            v['dataVenda']  = v['dataVenda'].strftime('%Y-%m-%dT%H:%M:%S')
            for p in v.get('pagamentos', []):
                p['valor'] = float(p['valor'])
        return {'status': 200, 'vendas': vendas}

    @staticmethod
    def get_produtos_mais_vendidos(data_inicio, data_fim, limite=100):
        rows = RelatorioRepository.get_produtos_mais_vendidos(data_inicio, data_fim, int(limite))
        for r in rows:
            r['totalVendido'] = int(r['totalVendido'])
            r['receitaTotal'] = float(r['receitaTotal'])
            r['precoMedio']   = float(r['precoMedio'])
        return {'status': 200, 'produtos': rows}

    @staticmethod
    def get_produtos_sem_movimento():
        rows = RelatorioRepository.get_produtos_sem_movimento()
        for r in rows:
            r['preco']       = float(r['preco'])
            r['valorEstoque'] = float(r['valorEstoque'])
            if r.get('dataCadastro'):
                r['dataCadastro'] = r['dataCadastro'].strftime('%Y-%m-%d')
        return {'status': 200, 'produtos': rows}

    @staticmethod
    def get_estoque_detalhado():
        rows = RelatorioRepository.get_estoque_detalhado()
        for r in rows:
            r['preco']       = float(r['preco'])
            r['valorEstoque'] = float(r['valorEstoque'])
            r['receitaTotal'] = float(r['receitaTotal'])
            r['totalVendido'] = int(r['totalVendido'])
            if r.get('ultimaVenda'):
                r['ultimaVenda'] = r['ultimaVenda'].strftime('%Y-%m-%dT%H:%M:%S')
        return {'status': 200, 'produtos': rows}
