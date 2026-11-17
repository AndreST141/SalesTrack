# -*- coding: utf-8 -*-
"""
Integration tests for Dashboard API:
- GET /api/dashboard/kpis
- GET /api/dashboard/vendas-periodo
- GET /api/dashboard/produtos-mais-vendidos
- GET /api/categorias
"""
import pytest
from datetime import datetime
from unittest.mock import patch

class TestDashboardApiIntegration:

    def test_get_dashboard_unauthenticated(self, client):
        """Validates that dashboard endpoints require authentication."""
        assert client.get('/api/dashboard/kpis').status_code == 401
        assert client.get('/api/dashboard/vendas-periodo').status_code == 401
        assert client.get('/api/dashboard/produtos-mais-vendidos').status_code == 401
        assert client.get('/api/categorias').status_code == 401

    @patch('app.Services.categoria_service.CategoriaRepository.get_all')
    def test_get_categorias(self, mock_get_all, client, vendedor_headers):
        """Validates GET /api/categorias returns array of categories."""
        mock_get_all.return_value = [{'idCategoria': 1, 'nome': 'Doces'}, {'idCategoria': 2, 'nome': 'Salgados'}]
        res = client.get('/api/categorias', headers=vendedor_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 2

    @patch('app.Services.categoria_service.DashboardRepository.get_kpis')
    def test_get_kpis(self, mock_kpis, client, admin_headers):
        """Validates GET /api/dashboard/kpis returns flat structure expected by frontend."""
        mock_kpis.return_value = (
            {'totalVendas': 50, 'receitaTotal': '5000.00', 'ticketMedio': '100.00'},
            {'produtosBaixoEstoque': 2}
        )
        res = client.get('/api/dashboard/kpis?periodo=30', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['totalVendas'] == 50
        assert data['receitaTotal'] == 5000.0
        assert data['ticketMedio'] == 100.0
        assert data['produtosBaixoEstoque'] == 2

    @patch('app.Services.categoria_service.DashboardRepository.get_vendas_por_periodo')
    def test_get_vendas_periodo(self, mock_vendas, client, admin_headers):
        """Validates GET /api/dashboard/vendas-periodo."""
        mock_vendas.return_value = [{'data': datetime(2026, 10, 30), 'receita': '120.00', 'total': 4}]
        res = client.get('/api/dashboard/vendas-periodo?dias=7', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['data'] == '2026-10-30'

    @patch('app.Services.categoria_service.DashboardRepository.get_produtos_mais_vendidos')
    def test_get_produtos_mais_vendidos(self, mock_top, client, admin_headers):
        """Validates GET /api/dashboard/produtos-mais-vendidos."""
        mock_top.return_value = [{'idProduto': 1, 'nome': 'Pamonha Salgada', 'receitaTotal': '450.00'}]
        res = client.get('/api/dashboard/produtos-mais-vendidos?limite=5', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['receitaTotal'] == 450.0
