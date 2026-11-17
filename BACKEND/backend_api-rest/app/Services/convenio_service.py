from app.Repositories.convenio_repository import ConvenioRepository, LancamentoInvalidoError
from app.Constants.geral import Geral


class ConvenioService:

    @staticmethod
    def show(id_cliente):
        dados = ConvenioRepository.get_by_cliente(id_cliente)
        if not dados:
            return {'status': 404, 'error': Geral.CLIENTE_NAO_ENCONTRADO}
        if not dados['convenio']:
            return {'status': 400, 'error': Geral.CONVENIO_CLIENTE_NAO_HABILITADO}
        for l in dados['lancamentos']:
            l['valor'] = float(l['valor'])
        return {'status': 200, 'convenio': dados}

    @staticmethod
    def pagar(id_cliente, dados, id_usuario):
        ids_lancamentos = dados.get('idsLancamentos') or []
        forma_pagamento = (dados.get('formaPagamento') or '').strip()

        if not ids_lancamentos:
            return {'status': 400, 'error': 'Selecione ao menos um lançamento para pagar.'}
        if not forma_pagamento:
            return {'status': 400, 'error': 'Forma de pagamento é obrigatória.'}

        try:
            ids_lancamentos = [int(i) for i in ids_lancamentos]
        except (TypeError, ValueError):
            return {'status': 400, 'error': 'Lançamentos inválidos.'}

        try:
            recibo = ConvenioRepository.pagar(
                id_cliente, ids_lancamentos, forma_pagamento,
                dados.get('observacao', ''), id_usuario
            )
            recibo['valorTotal'] = float(recibo['valorTotal'])
            for l in recibo['lancamentos']:
                l['valor'] = float(l['valor'])
            return {'status': 201, 'message': Geral.CONVENIO_PAGAMENTO_REGISTRADO, 'recibo': recibo}
        except LancamentoInvalidoError as e:
            return {'status': 400, 'error': str(e)}
