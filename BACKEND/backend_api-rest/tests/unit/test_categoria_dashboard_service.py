# -*- coding: utf-8 -*-
"""
Unit tests for CategoriaService and DashboardService: categories listing,
KPIs aggregation, period sales, and best-selling products calculation.
"""
import pytest
from datetime import datetime
from unittest.mock import patch
from app.Services.categoria_service import CategoriaService, DashboardService

class TestCategoriaDashboardServiceUnit:

    @patch('app.Services.categoria_service.CategoriaRepository.get_all')
    def test_categoria_list(self, mock_get_all):
        """Validates category listing."""
        mock_get_all.return_value = [{'idCategoria': 1, 'nome': 'Bebidas'}, {'idCategoria': 2, 'nome': 'Lanches'}]
        res = CategoriaService.list()
        assert res['status'] == 200
        assert len(res['categorias']) == 2

    @patch('app.Services.categoria_service.DashboardRepository.get_kpis')
    def test_dashboard_kpis(self, mock_kpis):
        """Validates KPI calculation and numeric casting."""
        mock_kpis.return_value = (
            {'totalVendas': 150, 'receitaTotal': '12500.50', 'ticketMedio': '83.33'},
            {'produtosBaixoEstoque': 4}
        )
        res = DashboardService.get_kpis(periodo='30')
        assert res['status'] == 200
        assert res['totalVendas'] == 150
        assert res['receitaTotal'] == 12500.50
        assert res['ticketMedio'] == 83.33
        assert res['produtosBaixoEstoque'] == 4

    @patch('app.Services.categoria_service.DashboardRepository.get_vendas_por_periodo')
    def test_dashboard_vendas_por_periodo(self, mock_vendas):
        """Validates date formatting and numeric casting in periodic sales chart data."""
        mock_vendas.return_value = [
            {'data': datetime(2026, 10, 28), 'receita': '350.00', 'total': 12},
            {'data': datetime(2026, 10, 29), 'receita': '480.00', 'total': 16}
        ]
        res = DashboardService.get_vendas_por_periodo(dias=7)
        assert res['status'] == 200
        assert res['vendas'][0]['data'] == '2026-10-28'
        assert res['vendas'][0]['receita'] == 350.0

    @patch('app.Services.categoria_service.DashboardRepository.get_produtos_mais_vendidos')
    def test_dashboard_produtos_mais_vendidos(self, mock_top):
        """Validates top selling products formatting."""
        mock_top.return_value = [
            {'idProduto': 1, 'nome': 'Churrasquinho Misto', 'quantidadeTotal': 95, 'receitaTotal': '665.00'}
        ]
        res = DashboardService.get_produtos_mais_vendidos(limite=5)
        assert res['status'] == 200
        assert res['produtos'][0]['receitaTotal'] == 665.0
