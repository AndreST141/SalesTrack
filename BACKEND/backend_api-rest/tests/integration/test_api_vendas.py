# -*- coding: utf-8 -*-
"""
Integration tests for Vendas API (/api/vendas).
Tests sales listing, single sale detail, sale creation with items,
and cancellation with RBAC and admin authorization.
"""
import pytest
from datetime import datetime
from unittest.mock import patch
from app.Repositories.venda_repository import EstoqueInsuficienteError
from app.Constants.geral import Geral

class TestVendasApiIntegration:

    def test_get_vendas_unauthenticated(self, client):
        """Validates that GET /api/vendas requires authentication."""
        res = client.get('/api/vendas')
        assert res.status_code == 401

    @patch('app.Services.venda_service.VendaRepository.get_all')
    def test_get_vendas_authenticated(self, mock_get_all, client, vendedor_headers):
        """Validates that authenticated users can list sales."""
        mock_get_all.return_value = [{
            'idVenda': 1,
            'valorTotal': '50.00',
            'desconto': '0.00',
            'acrescimo': '0.00',
            'valorFinal': '50.00',
            'dataVenda': datetime(2026, 10, 30, 15, 0, 0),
            'formaPagamento': 'dinheiro',
            'pagamentos': [{'formaPagamento': 'dinheiro', 'valor': '50.00'}]
        }]
        res = client.get('/api/vendas', headers=vendedor_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['valorFinal'] == 50.0

    @patch('app.Services.venda_service.VendaRepository.find_with_itens')
    def test_get_venda_by_id_success(self, mock_find, client, vendedor_headers):
        """Validates single sale detail retrieval."""
        mock_find.return_value = {
            'idVenda': 2,
            'valorTotal': '30.00',
            'desconto': '0.00',
            'acrescimo': '0.00',
            'valorFinal': '30.00',
            'dataVenda': datetime(2026, 10, 30, 15, 10, 0),
            'formaPagamento': 'pix',
            'itens': [{'idProduto': 1, 'precoUnitario': '15.00', 'subtotal': '30.00'}],
            'pagamentos': [{'formaPagamento': 'pix', 'valor': '30.00'}]
        }
        res = client.get('/api/vendas/2', headers=vendedor_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['idVenda'] == 2
        assert len(data['itens']) == 1

    @patch('app.Services.venda_service.VendaRepository.find_with_itens')
    def test_get_venda_by_id_not_found(self, mock_find, client, vendedor_headers):
        """Validates 404 response when sale does not exist."""
        mock_find.return_value = None
        res = client.get('/api/vendas/9999', headers=vendedor_headers)
        assert res.status_code == 404
        data = res.get_json()
        assert data['error'] == Geral.VENDA_NAO_ENCONTRADA

    @patch('app.Services.venda_service.VendaRepository.create')
    def test_post_venda_success(self, mock_create, client, vendedor_headers):
        """Validates successful sale creation via POST /api/vendas."""
        mock_create.return_value = 77
        venda_payload = {
            'formaPagamento': 'pix',
            'valorTotal': 60.0,
            'valorFinal': 60.0,
            'itens': [{'idProduto': 1, 'quantidade': 3, 'precoUnitario': 20.0, 'subtotal': 60.0}],
            'pagamentos': [{'forma': 'pix', 'valor': 60.0}]
        }
        res = client.post('/api/vendas', headers=vendedor_headers, json=venda_payload)
        assert res.status_code == 201
        data = res.get_json()
        assert data['success'] is True
        assert data['id'] == 77

    @patch('app.Services.venda_service.VendaRepository.create')
    def test_post_venda_stock_error(self, mock_create, client, vendedor_headers):
        """Validates that stock shortage returns 400 with descriptive error."""
        mock_create.side_effect = EstoqueInsuficienteError("Estoque insuficiente para 'Pizza'")
        venda_payload = {
            'formaPagamento': 'pix',
            'valorTotal': 100.0,
            'valorFinal': 100.0,
            'itens': [{'idProduto': 5, 'quantidade': 10, 'precoUnitario': 10.0, 'subtotal': 100.0}],
            'pagamentos': [{'forma': 'pix', 'valor': 100.0}]
        }
        res = client.post('/api/vendas', headers=vendedor_headers, json=venda_payload)
        assert res.status_code == 400
        data = res.get_json()
        assert "Estoque insuficiente" in data['error']

    @patch('app.Services.venda_service.VendaRepository.cancel')
    def test_cancel_venda_as_admin_direct(self, mock_cancel, client, admin_headers):
        """Validates direct cancellation by administrator without secondary password."""
        mock_cancel.return_value = True
        res = client.patch('/api/vendas/10/cancelar', headers=admin_headers, json={})
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True
        assert data['message'] == Geral.VENDA_CANCELADA

    def test_cancel_venda_as_vendedor_missing_password(self, client, vendedor_headers):
        """Validates that vendedor cannot cancel without admin password."""
        res = client.patch('/api/vendas/10/cancelar', headers=vendedor_headers, json={})
        assert res.status_code == 403
        data = res.get_json()
        assert data['error'] == Geral.SEM_PERMISSAO

    @patch('app.Services.venda_service.AuthRepository.verify_admin_or_supervisor_password')
    @patch('app.Services.venda_service.VendaRepository.cancel')
    def test_cancel_venda_as_vendedor_with_password(self, mock_cancel, mock_verify, client, vendedor_headers):
        """Validates cancellation by vendedor when authorized with admin password."""
        mock_verify.return_value = {'nome': 'Admin Autorizador'}
        mock_cancel.return_value = True
        res = client.patch('/api/vendas/10/cancelar', headers=vendedor_headers, json={'admin_senha': 'admin123'})
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True
