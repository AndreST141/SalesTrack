# -*- coding: utf-8 -*-
"""
Unit tests for ProdutoService: validation of mandatory fields, price formatting,
positive price constraints, soft-delete, and reactivation.
"""
import pytest
from unittest.mock import patch
from app.Services.produto_service import ProdutoService
from app.Constants.geral import Geral

class TestProdutoServiceUnit:

    @patch('app.Services.produto_service.ProdutoRepository.get_all')
    def test_list_produtos(self, mock_get_all):
        """Validates that listing converts prices to float and respects status filter."""
        mock_get_all.return_value = [
            {'idProduto': 1, 'nome': 'Pamonha Doce', 'preco': '8.50', 'ativo': 1},
            {'idProduto': 2, 'nome': 'Pamonha Salgada', 'preco': '9.00', 'ativo': 1}
        ]

        res = ProdutoService.list(incluir_inativos=False)
        assert res['status'] == 200
        assert len(res['produtos']) == 2
        assert res['produtos'][0]['preco'] == 8.5
        mock_get_all.assert_called_once_with(False)

    def test_create_missing_name(self):
        """Validates that creating a product without a name returns 400."""
        res = ProdutoService.create({'preco': 10.0, 'estoque': 5})
        assert res['status'] == 400
        assert "Nome e um preço maior que zero são obrigatórios" in res['error']

    def test_create_invalid_prices(self):
        """Validates that prices <= 0 or invalid non-numeric inputs are rejected."""
        res_zero = ProdutoService.create({'nome': 'Produto Zero', 'preco': 0})
        assert res_zero['status'] == 400

        res_negative = ProdutoService.create({'nome': 'Produto Negativo', 'preco': -5.0})
        assert res_negative['status'] == 400

        res_invalid = ProdutoService.create({'nome': 'Produto String', 'preco': 'invalido'})
        assert res_invalid['status'] == 400

        res_none = ProdutoService.create({'nome': 'Produto None', 'preco': None})
        assert res_none['status'] == 400

    @patch('app.Services.produto_service.ProdutoRepository.create')
    def test_create_success(self, mock_create):
        """Validates successful product creation returning 201 and new ID."""
        mock_create.return_value = 15
        dados = {'nome': 'Curau de Milho', 'preco': 7.50, 'estoque': 20, 'idCategoria': 1}

        res = ProdutoService.create(dados)
        assert res['status'] == 201
        assert res['id'] == 15
        assert res['message'] == Geral.PRODUTO_CADASTRADO
        mock_create.assert_called_once_with(dados)

    def test_update_missing_name_or_invalid_price(self):
        """Validates that updates require valid name and positive price."""
        res_no_name = ProdutoService.update(1, {'preco': 12.0})
        assert res_no_name['status'] == 400

        res_bad_price = ProdutoService.update(1, {'nome': 'Nome Ok', 'preco': 0})
        assert res_bad_price['status'] == 400

    @patch('app.Services.produto_service.ProdutoRepository.update')
    def test_update_success(self, mock_update):
        """Validates successful product update."""
        dados = {'nome': 'Curau Especial', 'preco': 8.00}
        res = ProdutoService.update(1, dados)
        assert res['status'] == 200
        assert res['message'] == Geral.PRODUTO_ATUALIZADO
        mock_update.assert_called_once_with(1, dados)

    @patch('app.Services.produto_service.ProdutoRepository.soft_delete')
    def test_delete_product(self, mock_delete):
        """Validates product soft-delete call."""
        res = ProdutoService.delete(3)
        assert res['status'] == 200
        assert res['message'] == Geral.PRODUTO_REMOVIDO
        mock_delete.assert_called_once_with(3)

    @patch('app.Services.produto_service.ProdutoRepository.reactivate')
    def test_reactivate_product(self, mock_reactivate):
        """Validates product reactivation call."""
        res = ProdutoService.reactivate(3)
        assert res['status'] == 200
        assert "reativado com sucesso" in res['message']
        mock_reactivate.assert_called_once_with(3)
