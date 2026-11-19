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

    @patch('app.Services.cliente_service.ClienteRepository.find_by_cpf')
    @patch('app.Services.cliente_service.ClienteRepository.create')
    def test_post_cliente_success(self, mock_create, mock_find_cpf, client, vendedor_headers):
        """Validates that creating a customer returns 201 with new ID."""
        mock_find_cpf.return_value = None
        mock_create.return_value = 55
        dados = {'nome': 'Cliente Novo', 'cpf': '111.444.777-35', 'telefone': '62988881234'}
        res = client.post('/api/clientes', headers=vendedor_headers, json=dados)
        assert res.status_code == 201
        data = res.get_json()
        assert data['success'] is True
        assert data['id'] == 55

    @patch('app.Services.cliente_service.ClienteRepository.create')
    def test_post_cliente_invalid_cpf(self, mock_create, client, vendedor_headers):
        """Validates that an invalid CPF returns an explicit 400 (no silent success)."""
        res = client.post('/api/clientes', headers=vendedor_headers, json={'nome': 'Cliente', 'cpf': '123.456.789-10'})
        assert res.status_code == 400
        data = res.get_json()
        assert data['error'] == 'CPF inválido.'
        assert 'success' not in data
        mock_create.assert_not_called()

    @patch('app.Services.cliente_service.ClienteRepository.update')
    def test_put_cliente_success(self, mock_update, client, vendedor_headers):
        """Validates customer update."""
        res = client.put('/api/clientes/1', headers=vendedor_headers, json={'nome': 'Nome Atualizado'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True

    @patch('app.Services.cliente_service.ClienteRepository.get_saldo_convenio')
    @patch('app.Services.cliente_service.ClienteRepository.soft_delete')
    def test_delete_cliente_success(self, mock_delete, mock_saldo, client, vendedor_headers):
        """Validates customer soft-deletion."""
        mock_saldo.return_value = None
        res = client.delete('/api/clientes/1', headers=vendedor_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True

    @patch('app.Services.cliente_service.ClienteRepository.get_saldo_convenio')
    @patch('app.Services.cliente_service.ClienteRepository.soft_delete')
    def test_delete_cliente_with_debt_blocked(self, mock_delete, mock_saldo, client, vendedor_headers):
        """Validates that DELETE returns 400 while the customer has convenio debt."""
        mock_saldo.return_value = {'convenio': True, 'limiteConvenio': 300.0, 'saldoDevedor': 80.0}
        res = client.delete('/api/clientes/1', headers=vendedor_headers)
        assert res.status_code == 400
        assert 'error' in res.get_json()
        mock_delete.assert_not_called()

    @patch('app.Services.cliente_service.ClienteRepository.reactivate')
    def test_reactivate_cliente_success(self, mock_reactivate, client, vendedor_headers):
        """Validates customer reactivation."""
        res = client.patch('/api/clientes/1', headers=vendedor_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True
