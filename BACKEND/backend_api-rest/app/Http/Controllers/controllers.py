from datetime import datetime
from flask import request, jsonify
from app.Services.auth_service import AuthService
from app.Services.produto_service import ProdutoService
from app.Services.cliente_service import ClienteService
from app.Services.convenio_service import ConvenioService
from app.Services.venda_service import VendaService
from app.Services.user_service import UserService
from app.Services.categoria_service import CategoriaService, DashboardService
from app.Services.relatorio_service import RelatorioService
from app.Services.configuracao_service import ConfiguracaoService
from app.Services.licenca_service import LicencaService
from app.Constants.geral import Geral


# =============================================
# AuthController
# =============================================
class AuthController:
    @staticmethod
    def login():
        data = request.json or {}
        result = AuthService.login(data.get('email'), data.get('senha'))
        return jsonify(result), result['status']

    @staticmethod
    def logout():
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        result = AuthService.logout(token)
        return jsonify(result), result['status']


# =============================================
# ProdutoController
# =============================================
class ProdutoController:
    @staticmethod
    def index():
        incluir_inativos = request.args.get('incluir_inativos', 'false').lower() == 'true'
        result = ProdutoService.list(incluir_inativos)
        return jsonify(result['produtos']), result['status']

    @staticmethod
    def store():
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = ProdutoService.create(request.json or {})
        if result['status'] not in (200, 201):
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True, 'id': result.get('id')}), result['status']

    @staticmethod
    def update(id):
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = ProdutoService.update(id, request.json or {})
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True}), result['status']

    @staticmethod
    def destroy(id):
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = ProdutoService.delete(id)
        return jsonify({'success': True}), result['status']

    @staticmethod
    def reactivate(id):
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = ProdutoService.reactivate(id)
        return jsonify({'success': True}), result['status']

    @staticmethod
    def gerar_codigo_barras():
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = ProdutoService.gerar_codigo_barras()
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'codigoBarras': result['codigoBarras']}), 200


# =============================================
# ClienteController
# =============================================
class ClienteController:
    @staticmethod
    def index():
        incluir_inativos = request.args.get('incluir_inativos', 'false').lower() == 'true'
        result = ClienteService.list(incluir_inativos)
        return jsonify(result['clientes']), result['status']

    @staticmethod
    def store():
        result = ClienteService.create(request.json or {})
        if result['status'] not in (200, 201):
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True, 'id': result.get('id')}), result['status']

    @staticmethod
    def update(id):
        result = ClienteService.update(id, request.json or {})
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True}), result['status']

    @staticmethod
    def reactivate(id):
        result = ClienteService.reactivate(id)
        return jsonify({'success': True}), result['status']

    @staticmethod
    def destroy(id):
        result = ClienteService.delete(id)
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True}), result['status']


# =============================================
# ConvenioController
# =============================================
class ConvenioController:
    # Quem pode registrar pagamento (quitar saldo devedor) de convênio —
    # mesmo grupo que já autoriza cancelamento de venda em VendaService.
    PERFIS_PAGAMENTO = {'admin', 'supervisor', 'tecnico'}

    @staticmethod
    def show(id):
        result = ConvenioService.show(id)
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify(result['convenio']), result['status']

    @staticmethod
    def pagar(id):
        if request.user.get('tipo') not in ConvenioController.PERFIS_PAGAMENTO:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = ConvenioService.pagar(id, request.json or {}, request.user['id'])
        if result['status'] not in (200, 201):
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True, 'message': result['message'], 'recibo': result['recibo']}), result['status']


# =============================================
# VendaController
# =============================================
class VendaController:
    @staticmethod
    def index():
        # Limit tem um teto pra evitar abuso (ex: ?limit=999999999) sobrecarregando
        # o banco numa única consulta.
        limit = min(int(request.args.get('limit', 100)), 500)
        offset = max(int(request.args.get('offset', 0)), 0)
        result = VendaService.list(limit, offset)
        return jsonify(result['vendas']), result['status']

    @staticmethod
    def show(id):
        result = VendaService.show(id)
        if result['status'] == 404:
            return jsonify({'error': result['error']}), 404
        return jsonify(result['venda']), result['status']

    @staticmethod
    def store():
        result = VendaService.create(request.json or {}, request.user['id'])
        if result['status'] not in (200, 201):
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True, 'id': result.get('id')}), result['status']

    @staticmethod
    def cancel(id):
        data = request.json or {}
        result = VendaService.cancel(
            id,
            request.user['tipo'],
            request.user['nome'],
            data.get('admin_senha'),
        )
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True, 'message': result['message']}), 200


# =============================================
# CategoriaController
# =============================================
class CategoriaController:
    @staticmethod
    def index():
        result = CategoriaService.list()
        return jsonify(result['categorias']), result['status']

    @staticmethod
    def store():
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = CategoriaService.create(request.json or {})
        if result['status'] not in (200, 201):
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True, 'id': result.get('id'), 'nome': result.get('nome')}), result['status']

    @staticmethod
    def destroy(id):
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = CategoriaService.delete(id)
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True}), result['status']


# =============================================
# DashboardController
# =============================================
class DashboardController:
    @staticmethod
    def kpis():
        periodo = request.args.get('periodo', '30')
        result = DashboardService.get_kpis(periodo)
        # Retorna os campos direto, sem 'status', como o frontend espera
        return jsonify({
            'totalVendas':          result['totalVendas'],
            'receitaTotal':         result['receitaTotal'],
            'ticketMedio':          result['ticketMedio'],
            'produtosBaixoEstoque': result['produtosBaixoEstoque']
        }), 200

    @staticmethod
    def vendas_periodo():
        dias = int(request.args.get('dias', '30'))
        result = DashboardService.get_vendas_por_periodo(dias)
        return jsonify(result['vendas']), 200

    @staticmethod
    def produtos_mais_vendidos():
        limite = int(request.args.get('limite', '10'))
        periodo = int(request.args.get('periodo', '30'))
        result = DashboardService.get_produtos_mais_vendidos(limite, periodo)
        return jsonify(result['produtos']), 200


# =============================================
# UserController
# =============================================
class UserController:

    @staticmethod
    def index():
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = UserService.list()
        return jsonify(result['usuarios']), result['status']

    @staticmethod
    def store():
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = UserService.create(request.json or {})
        if result['status'] not in (200, 201):
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True, 'id': result.get('id')}), result['status']

    @staticmethod
    def update(user_id):
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = UserService.update(user_id, request.json or {})
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True}), 200

    @staticmethod
    def delete(user_id):
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = UserService.delete(user_id, request.user.get('id'))
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True}), result['status']

    @staticmethod
    def reactivate(user_id):
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = UserService.reactivate(user_id)
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True}), result['status']


# =============================================
# ConfiguracaoController
# =============================================
class ConfiguracaoController:
    @staticmethod
    def index():
        result = ConfiguracaoService.listar()
        return jsonify(result['configuracoes']), result['status']

    @staticmethod
    def update():
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = ConfiguracaoService.atualizar(request.json or {})
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify(result['configuracoes']), result['status']


# =============================================
# LicencaController
# =============================================
class LicencaController:
    @staticmethod
    def index():
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = LicencaService.obter()
        return jsonify(result['licenca']), result['status']

    @staticmethod
    def update():
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = LicencaService.atualizar(request.json or {})
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify(result['licenca']), result['status']


# =============================================
# RelatorioController
# =============================================
class RelatorioController:
    """Relatórios gerenciais: faturamento, ranking e estoque. Restritos a
    admin e técnico (Geral.PERFIS_ADMIN) — mesma regra da tela no frontend
    (PrivateRoute adminOnly). Vendedor e supervisor recebem 403."""

    LIMITE_MAXIMO = 500

    @staticmethod
    def _acesso_negado():
        """Resposta 403 se o usuário logado não pode ver relatórios; None se pode."""
        if request.user.get('tipo') not in Geral.PERFIS_ADMIN:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        return None

    @staticmethod
    def _ler_periodo():
        """Lê e valida data_inicio/data_fim (AAAA-MM-DD, início <= fim).
        Retorna (data_inicio, data_fim, None) ou (None, None, resposta_400)."""
        data_inicio = request.args.get('data_inicio', '').strip()
        data_fim    = request.args.get('data_fim', '').strip()
        if not data_inicio or not data_fim:
            return None, None, (jsonify({'error': 'Informe data_inicio e data_fim'}), 400)
        try:
            inicio = datetime.strptime(data_inicio, '%Y-%m-%d').date()
            fim    = datetime.strptime(data_fim, '%Y-%m-%d').date()
        except ValueError:
            return None, None, (jsonify({'error': 'Datas inválidas. Use o formato AAAA-MM-DD.'}), 400)
        if inicio > fim:
            return None, None, (jsonify({'error': 'A data inicial não pode ser posterior à data final.'}), 400)
        return inicio.isoformat(), fim.isoformat(), None

    @staticmethod
    def vendas_periodo():
        negado = RelatorioController._acesso_negado()
        if negado:
            return negado
        data_inicio, data_fim, erro = RelatorioController._ler_periodo()
        if erro:
            return erro
        result = RelatorioService.get_vendas_periodo(data_inicio, data_fim)
        return jsonify(result['vendas']), result['status']

    @staticmethod
    def produtos_mais_vendidos():
        negado = RelatorioController._acesso_negado()
        if negado:
            return negado
        data_inicio, data_fim, erro = RelatorioController._ler_periodo()
        if erro:
            return erro
        try:
            limite = int(request.args.get('limite', 100))
        except (TypeError, ValueError):
            limite = None
        if limite is None or not 1 <= limite <= RelatorioController.LIMITE_MAXIMO:
            return jsonify({'error': f'Parâmetro limite inválido. Use um número inteiro de 1 a {RelatorioController.LIMITE_MAXIMO}.'}), 400
        result = RelatorioService.get_produtos_mais_vendidos(data_inicio, data_fim, limite)
        return jsonify(result['produtos']), result['status']

    @staticmethod
    def produtos_sem_movimento():
        negado = RelatorioController._acesso_negado()
        if negado:
            return negado
        data_inicio, data_fim, erro = RelatorioController._ler_periodo()
        if erro:
            return erro
        result = RelatorioService.get_produtos_sem_movimento(data_inicio, data_fim)
        return jsonify(result['produtos']), result['status']

    @staticmethod
    def estoque_detalhado():
        negado = RelatorioController._acesso_negado()
        if negado:
            return negado
        result = RelatorioService.get_estoque_detalhado()
        return jsonify(result['produtos']), result['status']
