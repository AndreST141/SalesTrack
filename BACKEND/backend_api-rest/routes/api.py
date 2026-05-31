from flask import Blueprint
from app.Http.Controllers.controllers import (
    AuthController, ProdutoController, ClienteController,
    VendaController, CategoriaController, DashboardController
)
from middlewares.auth_middleware import token_required

# =============================================
# Auth
# =============================================
auth_bp = Blueprint('auth', __name__)
auth_bp.route('/api/login',  methods=['POST'])(AuthController.login)
auth_bp.route('/api/logout', methods=['POST'])(token_required(AuthController.logout))

# =============================================
# Produtos
# =============================================
produto_bp = Blueprint('produtos', __name__)
produto_bp.route('/api/produtos',          methods=['GET']   )(token_required(ProdutoController.index))
produto_bp.route('/api/produtos',          methods=['POST']  )(token_required(ProdutoController.store))
produto_bp.route('/api/produtos/<int:id>', methods=['PUT']   )(token_required(ProdutoController.update))
produto_bp.route('/api/produtos/<int:id>', methods=['PATCH'] )(token_required(ProdutoController.reactivate))
produto_bp.route('/api/produtos/<int:id>', methods=['DELETE'])(token_required(ProdutoController.destroy))

# =============================================
# Clientes
# =============================================
cliente_bp = Blueprint('clientes', __name__)
cliente_bp.route('/api/clientes',          methods=['GET']   )(token_required(ClienteController.index))
cliente_bp.route('/api/clientes',          methods=['POST']  )(token_required(ClienteController.store))
cliente_bp.route('/api/clientes/<int:id>', methods=['PUT']   )(token_required(ClienteController.update))
cliente_bp.route('/api/clientes/<int:id>', methods=['PATCH'] )(token_required(ClienteController.reactivate))
cliente_bp.route('/api/clientes/<int:id>', methods=['DELETE'])(token_required(ClienteController.destroy))

# =============================================
# Vendas
# =============================================
venda_bp = Blueprint('vendas', __name__)
venda_bp.route('/api/vendas',          methods=['GET'] )(token_required(VendaController.index))
venda_bp.route('/api/vendas/<int:id>', methods=['GET'] )(token_required(VendaController.show))
venda_bp.route('/api/vendas',          methods=['POST'])(token_required(VendaController.store))

# =============================================
# Categorias
# =============================================
categoria_bp = Blueprint('categorias', __name__)
categoria_bp.route('/api/categorias', methods=['GET'])(token_required(CategoriaController.index))

# =============================================
# Dashboard
# =============================================
dashboard_bp = Blueprint('dashboard', __name__)
dashboard_bp.route('/api/dashboard/kpis',                   methods=['GET'])(token_required(DashboardController.kpis))
dashboard_bp.route('/api/dashboard/vendas-periodo',         methods=['GET'])(token_required(DashboardController.vendas_periodo))
dashboard_bp.route('/api/dashboard/produtos-mais-vendidos', methods=['GET'])(token_required(DashboardController.produtos_mais_vendidos))
