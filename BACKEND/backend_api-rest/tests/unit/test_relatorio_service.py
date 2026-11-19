# -*- coding: utf-8 -*-
"""
Unit tests for RelatorioService: 4 report types (period sales, top sellers,
stagnant inventory, detailed stock).
"""
import pytest
from datetime import datetime
from decimal import Decimal
from unittest.mock import patch
from app.Services.relatorio_service import RelatorioService

# Os mocks usam Decimal porque é o que o mysql-connector devolve para
# colunas DECIMAL e SUM()/AVG() — string não reproduz o tipo real.

class TestRelatorioServiceUnit:

    @patch('app.Services.relatorio_service.RelatorioRepository.get_vendas_periodo')
    def test_get_vendas_periodo(self, mock_repo):
        """Validates period sales report formatting."""
        mock_repo.return_value = [{
            'idVenda': 1,
            'valorTotal': Decimal('150.00'),
            'desconto': Decimal('10.00'),
            'acrescimo': Decimal('0.00'),
            'valorFinal': Decimal('140.00'),
            'dataVenda': datetime(2026, 10, 25, 10, 0, 0),
            'pagamentos': [{'valor': Decimal('140.00')}]
        }]
        res = RelatorioService.get_vendas_periodo('2026-10-01', '2026-10-31')
        assert res['status'] == 200
        v = res['vendas'][0]
        assert v['valorTotal'] == 150.0
        assert v['valorFinal'] == 140.0
        assert v['dataVenda'] == '2026-10-25T10:00:00'
        assert isinstance(v['pagamentos'][0]['valor'], float)

    @pytest.mark.parametrize('acrescimo_banco,esperado', [
        (Decimal('5.50'), 5.5),
        (Decimal('0.00'), 0.0),
        (None, 0.0),          # vendas antigas, antes da coluna existir
    ])
    @patch('app.Services.relatorio_service.RelatorioRepository.get_vendas_periodo')
    def test_acrescimo_sai_como_float(self, mock_repo, acrescimo_banco, esperado):
        """acrescimo sai como número (antes saía como texto '5.00'), inclusive quando NULL."""
        mock_repo.return_value = [{
            'idVenda': 2, 'valorTotal': Decimal('100.00'), 'desconto': Decimal('0.00'),
            'acrescimo': acrescimo_banco, 'valorFinal': Decimal('105.50'),
            'dataVenda': datetime(2026, 10, 25, 10, 0, 0), 'pagamentos': []
        }]
        v = RelatorioService.get_vendas_periodo('2026-10-01', '2026-10-31')['vendas'][0]
        assert type(v['acrescimo']) is float
        assert v['acrescimo'] == esperado

    @patch('app.Services.relatorio_service.RelatorioRepository.get_vendas_periodo')
    def test_acrescimo_ausente_vira_zero(self, mock_repo):
        """Linha sem a chave acrescimo (schema antigo) não quebra o relatório."""
        mock_repo.return_value = [{
            'idVenda': 3, 'valorTotal': Decimal('10.00'), 'desconto': Decimal('0.00'),
            'valorFinal': Decimal('10.00'), 'dataVenda': datetime(2026, 10, 25), 'pagamentos': []
        }]
        v = RelatorioService.get_vendas_periodo('2026-10-01', '2026-10-31')['vendas'][0]
        assert v['acrescimo'] == 0.0

    @patch('app.Services.relatorio_service.RelatorioRepository.get_produtos_mais_vendidos')
    def test_get_produtos_mais_vendidos(self, mock_repo):
        """Validates best sellers report numeric casting."""
        mock_repo.return_value = [{
            'idProduto': 10,
            'nome': 'Pizza Margherita',
            'totalVendido': Decimal('45'),
            'receitaTotal': Decimal('2025.00'),
            'precoMedio': Decimal('45.0000')
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
            'preco': Decimal('25.00'),
            'estoque': 10,
            'valorEstoque': Decimal('250.00'),
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
            'preco': Decimal('5.00'),
            'estoque': 30,
            'valorEstoque': Decimal('150.00'),
            'receitaTotal': Decimal('500.00'),
            'totalVendido': Decimal('100'),
            'ultimaVenda': datetime(2026, 10, 29, 18, 0, 0)
        }]
        res = RelatorioService.get_estoque_detalhado()
        assert res['status'] == 200
        p = res['produtos'][0]
        assert p['preco'] == 5.0
        assert p['totalVendido'] == 100
        assert p['ultimaVenda'] == '2026-10-29T18:00:00'

    @patch('app.Services.relatorio_service.RelatorioRepository.get_estoque_detalhado')
    def test_estoque_negativo_mantem_valor_negativo(self, mock_repo):
        """Regra de negócio: com estoque negativo permitido, o valor em estoque
        continua negativo no relatório (não é truncado em zero)."""
        mock_repo.return_value = [{
            'idProduto': 4, 'nome': 'Pamonha', 'preco': Decimal('5.00'), 'estoque': -3,
            'valorEstoque': Decimal('-15.00'), 'receitaTotal': Decimal('0'),
            'totalVendido': Decimal('0'), 'ultimaVenda': None
        }]
        p = RelatorioService.get_estoque_detalhado()['produtos'][0]
        assert p['estoque'] == -3
        assert p['valorEstoque'] == -15.0
        assert p['ultimaVenda'] is None
