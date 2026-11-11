# -*- coding: utf-8 -*-
"""
Integration tests for Relatorios API:
- GET /api/relatorio/vendas
- GET /api/relatorio/mais-vendidos
- GET /api/relatorio/sem-movimento
- GET /api/relatorio/estoque
"""
import pytest
from datetime import datetime
from unittest.mock import patch

class TestRelatoriosApiIntegration:

    def test_relatorios_unauthenticated(self, client):
        """Validates that all reports endpoints require authentication."""
        assert client.get('/api/relatorio/vendas').status_code == 401
        assert client.get('/api/relatorio/mais-vendidos').status_code == 401
        assert client.get('/api/relatorio/sem-movimento').status_code == 401
        assert client.get('/api/relatorio/estoque').status_code == 401

    def test_relatorio_vendas_missing_dates(self, client, admin_headers):
        """Validates that GET /api/relatorio/vendas without dates returns 400."""
        res = client.get('/api/relatorio/vendas', headers=admin_headers)
        assert res.status_code == 400
        data = res.get_json()
        assert "data_inicio e data_fim" in data['error']

    @patch('app.Services.relatorio_service.RelatorioRepository.get_vendas_periodo')
    def test_relatorio_vendas_success(self, mock_repo, client, admin_headers):
        """Validates GET /api/relatorio/vendas with valid date parameters."""
        mock_repo.return_value = [{
            'idVenda': 1,
            'valorTotal': '100.00',
            'desconto': '0.00',
            'valorFinal': '100.00',
            'dataVenda': datetime(2026, 10, 15, 12, 0, 0),
            'pagamentos': []
        }]
        res = client.get('/api/relatorio/vendas?data_inicio=2026-10-01&data_fim=2026-10-31', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['valorFinal'] == 100.0

    @patch('app.Services.relatorio_service.RelatorioRepository.get_produtos_mais_vendidos')
    def test_relatorio_mais_vendidos_success(self, mock_repo, client, admin_headers):
        """Validates GET /api/relatorio/mais-vendidos."""
        mock_repo.return_value = [{
            'idProduto': 1,
            'nome': 'Bolo',
            'totalVendido': '20',
            'receitaTotal': '100.00',
            'precoMedio': '5.00'
        }]
        res = client.get('/api/relatorio/mais-vendidos?data_inicio=2026-10-01&data_fim=2026-10-31', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['totalVendido'] == 20

    @patch('app.Services.relatorio_service.RelatorioRepository.get_produtos_sem_movimento')
    def test_relatorio_sem_movimento_success(self, mock_repo, client, admin_headers):
        """Validates GET /api/relatorio/sem-movimento."""
        mock_repo.return_value = [{
            'idProduto': 9,
            'nome': 'Sem Venda',
            'preco': '15.00',
            'estoque': 5,
            'valorEstoque': '75.00',
            'dataCadastro': datetime(2025, 5, 1)
        }]
        res = client.get('/api/relatorio/sem-movimento?data_inicio=2026-01-01&data_fim=2026-10-31', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['estoque'] == 5

    @patch('app.Services.relatorio_service.RelatorioRepository.get_estoque_detalhado')
    def test_relatorio_estoque_success(self, mock_repo, client, admin_headers):
        """Validates GET /api/relatorio/estoque."""
        mock_repo.return_value = [{
            'idProduto': 2,
            'nome': 'Curau',
            'preco': '6.00',
            'estoque': 15,
            'valorEstoque': '90.00',
            'receitaTotal': '180.00',
            'totalVendido': '30',
            'ultimaVenda': None
        }]
        res = client.get('/api/relatorio/estoque', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['valorEstoque'] == 90.0
