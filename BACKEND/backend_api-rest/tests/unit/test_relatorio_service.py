# -*- coding: utf-8 -*-
"""
Unit tests for RelatorioService: 4 report types (period sales, top sellers,
stagnant inventory, detailed stock).
"""
import pytest
from datetime import datetime
from unittest.mock import patch
from app.Services.relatorio_service import RelatorioService

class TestRelatorioServiceUnit:

    @patch('app.Services.relatorio_service.RelatorioRepository.get_vendas_periodo')
    def test_get_vendas_periodo(self, mock_repo):
        """Validates period sales report formatting."""
        mock_repo.return_value = [{
            'idVenda': 1,
            'valorTotal': '150.00',
            'desconto': '10.00',
            'valorFinal': '140.00',
            'dataVenda': datetime(2026, 10, 25, 10, 0, 0),
            'pagamentos': [{'valor': '140.00'}]
        }]
        res = RelatorioService.get_vendas_periodo('2026-10-01', '2026-10-31')
        assert res['status'] == 200
        v = res['vendas'][0]
        assert v['valorTotal'] == 150.0
        assert v['valorFinal'] == 140.0
        assert v['dataVenda'] == '2026-10-25T10:00:00'

    @patch('app.Services.relatorio_service.RelatorioRepository.get_produtos_mais_vendidos')
    def test_get_produtos_mais_vendidos(self, mock_repo):
        """Validates best sellers report numeric casting."""
        mock_repo.return_value = [{
            'idProduto': 10,
            'nome': 'Pizza Margherita',
            'totalVendido': '45',
            'receitaTotal': '2025.00',
            'precoMedio': '45.00'
        }]
        res = RelatorioService.get_produtos_mais_vendidos('2026-10-01', '2026-10-31', 10)
        assert res['status'] == 200
        p = res['produtos'][0]
        assert p['totalVendido'] == 45
        assert p['receitaTotal'] == 2025.0
        assert p['precoMedio'] == 45.0

    @patch('app.Services.relatorio_service.RelatorioRepository.get_produtos_sem_movimento')
    def test_get_produtos_sem_movimento(self, mock_repo):
        """Validates stagnant stock report formatting."""
        mock_repo.return_value = [{
            'idProduto': 5,
            'nome': 'Item Antigo',
            'preco': '25.00',
            'estoque': 10,
            'valorEstoque': '250.00',
            'dataCadastro': datetime(2025, 1, 15)
        }]
        res = RelatorioService.get_produtos_sem_movimento('2026-01-01', '2026-10-31')
        assert res['status'] == 200
        p = res['produtos'][0]
        assert p['preco'] == 25.0
        assert p['valorEstoque'] == 250.0
        assert p['dataCadastro'] == '2025-01-15'

    @patch('app.Services.relatorio_service.RelatorioRepository.get_estoque_detalhado')
    def test_get_estoque_detalhado(self, mock_repo):
        """Validates detailed stock report formatting."""
        mock_repo.return_value = [{
            'idProduto': 3,
            'nome': 'Bolo de Milho',
            'preco': '5.00',
            'estoque': 30,
            'valorEstoque': '150.00',
            'receitaTotal': '500.00',
            'totalVendido': '100',
            'ultimaVenda': datetime(2026, 10, 29, 18, 0, 0)
        }]
        res = RelatorioService.get_estoque_detalhado()
        assert res['status'] == 200
        p = res['produtos'][0]
        assert p['preco'] == 5.0
        assert p['totalVendido'] == 100
        assert p['ultimaVenda'] == '2026-10-29T18:00:00'
