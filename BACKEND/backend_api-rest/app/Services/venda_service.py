from app.Repositories.venda_repository import VendaRepository
from app.Constants.geral import Geral

class VendaService:

    @staticmethod
    def list():
        vendas = VendaRepository.get_all()
        for v in vendas:
            v['valorTotal'] = float(v['valorTotal'])
            v['desconto']   = float(v['desconto'])
            v['valorFinal'] = float(v['valorFinal'])
            v['dataVenda']  = v['dataVenda'].strftime('%Y-%m-%d %H:%M:%S')

            # Formatar pagamentos
            if v.get('pagamentos'):
                for p in v['pagamentos']:
                    p['valor'] = float(p['valor'])
            else:
                # Fallback: usar formaPagamento da Venda
                v['pagamentos'] = [{
                    'formaPagamento': v['formaPagamento'],
                    'valor': v['valorFinal']
                }]

        return {'status': 200, 'vendas': vendas}

    @staticmethod
    def show(id):
        venda = VendaRepository.find_with_itens(id)
        if not venda:
            return {'status': 404, 'error': Geral.VENDA_NAO_ENCONTRADA}

        venda['valorTotal'] = float(venda['valorTotal'])
        venda['desconto']   = float(venda['desconto'])
        venda['valorFinal'] = float(venda['valorFinal'])
        venda['dataVenda']  = venda['dataVenda'].strftime('%Y-%m-%d %H:%M:%S')
        for item in venda['itens']:
            item['precoUnitario'] = float(item['precoUnitario'])
            item['subtotal']      = float(item['subtotal'])

        # Formatar pagamentos
        if venda.get('pagamentos'):
            for p in venda['pagamentos']:
                p['valor'] = float(p['valor'])
        else:
            # Fallback: usar formaPagamento da Venda
            venda['pagamentos'] = [{
                'formaPagamento': venda['formaPagamento'],
                'valor': venda['valorFinal']
            }]

        return {'status': 200, 'venda': venda}

    @staticmethod
    def create(dados, usuario_id):
        if not dados.get('itens') or not dados.get('formaPagamento'):
            return {'status': 400, 'error': 'Itens e forma de pagamento são obrigatórios.'}

        try:
            venda_id = VendaRepository.create(dados, usuario_id)
            return {'status': 201, 'message': Geral.VENDA_CADASTRADA, 'id': venda_id}
        except Exception as e:
            return {'status': 500, 'error': Geral.ERRO_CRIAR_VENDA}
