# -*- coding: utf-8 -*-
"""
Integration tests for Clientes API (/api/clientes).
Tests index, store, update, destroy, and reactivate.
"""
import pytest
from unittest.mock import patch

class TestClientesApiIntegration:

    def test_get_clientes_unauthenticated(self, client):
        """Validates that GET /api/clientes requires authentication."""
        res = client.get('/api/clientes')
        assert res.status_code == 401

    @patch('app.Services.cliente_service.ClienteRepository.get_all')
    def test_get_clientes_authenticated(self, mock_get_all, client, vendedor_headers):
        """Validates that authenticated users can list customers."""
        mock_get_all.return_value = [{'idCliente': 1, 'nome': 'Cliente Teste'}]
        res = client.get('/api/clientes', headers=vendedor_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['nome'] == 'Cliente Teste'

    def test_post_cliente_missing_name(self, client, vendedor_headers):
        """Validates that POST /api/clientes without name returns 400."""
        res = client.post('/api/clientes', headers=vendedor_headers, json={'cpf': '000.111.222-33'})
        assert res.status_code == 400
        data = res.get_json()
        assert data['error'] == 'Nome é obrigatório.'

    @patch('app.Services.cliente_service.ClienteRepository.create')
    def test_post_cliente_success(self, mock_create, client, vendedor_headers):
        """Validates that creating a customer returns 201 with new ID."""
        mock_create.return_value = 55
        dados = {'nome': 'Cliente Novo', 'cpf': '123.456.789-10', 'telefone': '62988881234'}
        res = client.post('/api/clientes', headers=vendedor_headers, json=dados)
        assert res.status_code == 201
        data = res.get_json()
        assert data['success'] is True
        assert data['id'] == 55

    @patch('app.Services.cliente_service.ClienteRepository.update')
    def test_put_cliente_success(self, mock_update, client, vendedor_headers):
        """Validates customer update."""
        res = client.put('/api/clientes/1', headers=vendedor_headers, json={'nome': 'Nome Atualizado'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True

    @patch('app.Services.cliente_service.ClienteRepository.soft_delete')
    def test_delete_cliente_success(self, mock_delete, client, vendedor_headers):
        """Validates customer soft-deletion."""
        res = client.delete('/api/clientes/1', headers=vendedor_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True

    @patch('app.Services.cliente_service.ClienteRepository.reactivate')
    def test_reactivate_cliente_success(self, mock_reactivate, client, vendedor_headers):
        """Validates customer reactivation."""
        res = client.patch('/api/clientes/1', headers=vendedor_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True
