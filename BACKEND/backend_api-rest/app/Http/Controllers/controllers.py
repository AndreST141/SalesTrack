from flask import request, jsonify
from app.Services.auth_service import AuthService
from app.Services.produto_service import ProdutoService
from app.Services.cliente_service import ClienteService
from app.Services.venda_service import VendaService
from app.Services.user_service import UserService
from app.Services.categoria_service import CategoriaService, DashboardService
from app.Services.relatorio_service import RelatorioService


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
        result = ProdutoService.create(request.json or {})
        return jsonify({'success': True, 'id': result.get('id')}), result['status']

    @staticmethod
    def update(id):
        result = ProdutoService.update(id, request.json or {})
        return jsonify({'success': True}), result['status']

    @staticmethod
    def destroy(id):
        result = ProdutoService.delete(id)
        return jsonify({'success': True}), result['status']

    @staticmethod
    def reactivate(id):
        result = ProdutoService.reactivate(id)
        return jsonify({'success': True}), result['status']


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
        return jsonify({'success': True, 'id': result.get('id')}), result['status']

    @staticmethod
    def update(id):
        result = ClienteService.update(id, request.json or {})
        return jsonify({'success': True}), result['status']

    @staticmethod
    def reactivate(id):
        result = ClienteService.reactivate(id)
        return jsonify({'success': True}), result['status']

    @staticmethod
    def destroy(id):
        result = ClienteService.delete(id)
        return jsonify({'success': True}), result['status']


# =============================================
# VendaController
# =============================================
class VendaController:
    @staticmethod
    def index():
        result = VendaService.list()
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
        result = DashboardService.get_produtos_mais_vendidos(limite)
        return jsonify(result['produtos']), 200


# =============================================
# UserController
# =============================================
class UserController:

    ADMIN_TIPOS = {'admin', 'tecnico'}

    @staticmethod
    def index():
        if request.user.get('tipo') not in UserController.ADMIN_TIPOS:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = UserService.list()
        return jsonify(result['usuarios']), result['status']

    @staticmethod
    def store():
        if request.user.get('tipo') not in UserController.ADMIN_TIPOS:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = UserService.create(request.json or {})
        if result['status'] not in (200, 201):
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True, 'id': result.get('id')}), result['status']

    @staticmethod
    def update(user_id):
        if request.user.get('tipo') not in UserController.ADMIN_TIPOS:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = UserService.update(user_id, request.json or {})
        if result['status'] != 200:
            return jsonify({'error': result.get('error')}), result['status']
        return jsonify({'success': True}), 200

    @staticmethod
    def delete(user_id):
        if request.user.get('tipo') not in UserController.ADMIN_TIPOS:
            return jsonify({'error': 'Acesso não autorizado.'}), 403
        result = UserService.delete(user_id)
        return jsonify({'success': True}), result['status']


# =============================================
# RelatorioController
# =============================================
class RelatorioController:

    @staticmethod
    def vendas_periodo():
        data_inicio = request.args.get('data_inicio', '')
        data_fim    = request.args.get('data_fim', '')
        if not data_inicio or not data_fim:
            return jsonify({'error': 'Informe data_inicio e data_fim'}), 400
        result = RelatorioService.get_vendas_periodo(data_inicio, data_fim)
        return jsonify(result['vendas']), result['status']

    @staticmethod
    def produtos_mais_vendidos():
        data_inicio = request.args.get('data_inicio', '')
        data_fim    = request.args.get('data_fim', '')
        limite      = request.args.get('limite', 100)
        if not data_inicio or not data_fim:
            return jsonify({'error': 'Informe data_inicio e data_fim'}), 400
        result = RelatorioService.get_produtos_mais_vendidos(data_inicio, data_fim, limite)
        return jsonify(result['produtos']), result['status']

    @staticmethod
    def produtos_sem_movimento():
        data_inicio = request.args.get('data_inicio', '')
        data_fim    = request.args.get('data_fim', '')
        if not data_inicio or not data_fim:
            return jsonify({'error': 'Informe data_inicio e data_fim'}), 400
        result = RelatorioService.get_produtos_sem_movimento(data_inicio, data_fim)
        return jsonify(result['produtos']), result['status']

    @staticmethod
    def estoque_detalhado():
        result = RelatorioService.get_estoque_detalhado()
        return jsonify(result['produtos']), result['status']
