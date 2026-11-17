# -*- coding: utf-8 -*-
"""
Unit tests for ClienteService: customer creation, validation, update,
soft-delete, and reactivation.
"""
import pytest
from unittest.mock import patch
from app.Services.cliente_service import ClienteService
from app.Constants.geral import Geral

class TestClienteServiceUnit:

    @patch('app.Services.cliente_service.ClienteRepository.get_all')
    def test_list_clientes(self, mock_get_all):
        """Validates that customer listing forwards the status filter."""
        mock_get_all.return_value = [
            {'idCliente': 1, 'nome': 'João Silva', 'cpf': '123.456.789-00', 'ativo': 1}
        ]
        res = ClienteService.list(incluir_inativos=True)
        assert res['status'] == 200
        assert len(res['clientes']) == 1
        mock_get_all.assert_called_once_with(True)

    def test_create_missing_name(self):
        """Validates that creating a customer without name returns 400."""
        res = ClienteService.create({'cpf': '123.456.789-00', 'telefone': '62999999999'})
        assert res['status'] == 400
        assert res['error'] == 'Nome é obrigatório.'

    @patch('app.Services.cliente_service.ClienteRepository.create')
    def test_create_success(self, mock_create):
        """Validates successful customer creation returning 201."""
        mock_create.return_value = 10
        dados = {'nome': 'Maria Souza', 'cpf': '987.654.321-99', 'telefone': '62988887777'}
        res = ClienteService.create(dados)
        assert res['status'] == 201
        assert res['id'] == 10
        assert res['message'] == Geral.CLIENTE_CADASTRADO
        mock_create.assert_called_once_with(dados)

    def test_update_missing_name(self):
        """Validates that customer update requires a non-empty name."""
        res = ClienteService.update(1, {'telefone': '123456'})
        assert res['status'] == 400
        assert res['error'] == 'Nome é obrigatório.'

    @patch('app.Services.cliente_service.ClienteRepository.update')
    def test_update_success(self, mock_update):
        """Validates successful customer update."""
        dados = {'nome': 'Maria Souza Atualizada'}
        res = ClienteService.update(1, dados)
        assert res['status'] == 200
        assert res['message'] == Geral.CLIENTE_ATUALIZADO
        mock_update.assert_called_once_with(1, dados)

    @patch('app.Services.cliente_service.ClienteRepository.soft_delete')
    def test_delete_success(self, mock_delete):
        """Validates customer soft-deletion."""
        res = ClienteService.delete(5)
        assert res['status'] == 200
        assert res['message'] == Geral.CLIENTE_REMOVIDO
        mock_delete.assert_called_once_with(5)

    @patch('app.Services.cliente_service.ClienteRepository.reactivate')
    def test_reactivate_success(self, mock_reactivate):
        """Validates customer reactivation."""
        res = ClienteService.reactivate(5)
        assert res['status'] == 200
        assert "reativado com sucesso" in res['message']
        mock_reactivate.assert_called_once_with(5)
