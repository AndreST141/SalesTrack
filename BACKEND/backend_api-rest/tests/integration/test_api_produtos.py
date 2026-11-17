# -*- coding: utf-8 -*-
"""
Integration tests for Produtos API (/api/produtos).
Tests index, store, update, destroy, reactivate, query parameters,
and role-based permissions (admin vs vendedor).
"""
import pytest
from unittest.mock import patch
from app.Constants.geral import Geral

class TestProdutosApiIntegration:

    def test_get_produtos_unauthenticated(self, client):
        """Validates that GET /api/produtos requires authentication."""
        res = client.get('/api/produtos')
        assert res.status_code == 401

    @patch('app.Services.produto_service.ProdutoRepository.get_all')
    def test_get_produtos_as_vendedor(self, mock_get_all, client, vendedor_headers):
        """Validates that vendedor can list products."""
        mock_get_all.return_value = [{'idProduto': 1, 'nome': 'Pamonha Doce', 'preco': '8.00', 'ativo': 1}]
        res = client.get('/api/produtos', headers=vendedor_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['preco'] == 8.0

    def test_post_produto_as_vendedor_forbidden(self, client, vendedor_headers):
        """Validates that a vendedor cannot create products (403 Forbidden)."""
        res = client.post('/api/produtos', headers=vendedor_headers, json={'nome': 'Item Novo', 'preco': 10.0})
        assert res.status_code == 403
        data = res.get_json()
        assert "Acesso não autorizado" in data['error']

    @patch('app.Services.produto_service.ProdutoRepository.create')
    def test_post_produto_as_admin_success(self, mock_create, client, admin_headers):
        """Validates that admin can create products returning 201."""
        mock_create.return_value = 100
        dados = {'nome': 'Espetinho de Carne', 'preco': 7.00, 'estoque': 50, 'idCategoria': 1}
        res = client.post('/api/produtos', headers=admin_headers, json=dados)
        assert res.status_code == 201
        data = res.get_json()
        assert data['success'] is True
        assert data['id'] == 100

    def test_post_produto_as_admin_invalid_data(self, client, admin_headers):
        """Validates that creating product without name returns 400."""
        res = client.post('/api/produtos', headers=admin_headers, json={'preco': -10.0})
        assert res.status_code == 400
        data = res.get_json()
        assert "obrigatórios" in data['error']

    def test_put_produto_as_vendedor_forbidden(self, client, vendedor_headers):
        """Validates that vendedor cannot update products."""
        res = client.put('/api/produtos/1', headers=vendedor_headers, json={'nome': 'Update', 'preco': 10.0})
        assert res.status_code == 403

    @patch('app.Services.produto_service.ProdutoRepository.update')
    def test_put_produto_as_admin_success(self, mock_update, client, admin_headers):
        """Validates that admin can update products returning 200."""
        res = client.put('/api/produtos/1', headers=admin_headers, json={'nome': 'Espetinho Especial', 'preco': 8.50})
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True

    def test_delete_produto_as_vendedor_forbidden(self, client, vendedor_headers):
        """Validates that vendedor cannot delete products."""
        res = client.delete('/api/produtos/1', headers=vendedor_headers)
        assert res.status_code == 403

    @patch('app.Services.produto_service.ProdutoRepository.soft_delete')
    def test_delete_produto_as_admin_success(self, mock_delete, client, admin_headers):
        """Validates that admin can soft-delete products."""
        res = client.delete('/api/produtos/1', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True

    @patch('app.Services.produto_service.ProdutoRepository.reactivate')
    def test_reactivate_produto_as_admin_success(self, mock_reactivate, client, admin_headers):
        """Validates that admin can reactivate products via PATCH."""
        res = client.patch('/api/produtos/1', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True
