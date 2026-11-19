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

    @patch('app.Services.cliente_service.ClienteRepository.find_by_cpf')
    @patch('app.Services.cliente_service.ClienteRepository.create')
    def test_create_success(self, mock_create, mock_find_cpf):
        """Validates successful customer creation returning 201."""
        mock_find_cpf.return_value = None
        mock_create.return_value = 10
        dados = {'nome': 'Maria Souza', 'cpf': '529.982.247-25', 'telefone': '62988887777'}
        res = ClienteService.create(dados)
        assert res['status'] == 201
        assert res['id'] == 10
        assert res['message'] == Geral.CLIENTE_CADASTRADO
        mock_create.assert_called_once_with(dados)

    @patch('app.Services.cliente_service.ClienteRepository.create')
    def test_create_success_without_cpf(self, mock_create):
        """Validates that CPF is optional (no duplicity lookup when empty)."""
        mock_create.return_value = 11
        res = ClienteService.create({'nome': 'Cliente Sem CPF', 'cpf': ''})
        assert res['status'] == 201

    @patch('app.Services.cliente_service.ClienteRepository.create')
    def test_create_invalid_cpf(self, mock_create):
        """Validates that a CPF with wrong check digits (or all-equal digits) is rejected."""
        for cpf in ('987.654.321-99', '111.111.111-11', '123.456'):
            res = ClienteService.create({'nome': 'Maria Souza', 'cpf': cpf})
            assert res['status'] == 400
            assert res['error'] == 'CPF inválido.'
        mock_create.assert_not_called()

    @patch('app.Services.cliente_service.ClienteRepository.find_by_cpf')
    @patch('app.Services.cliente_service.ClienteRepository.create')
    def test_create_duplicate_cpf(self, mock_create, mock_find_cpf):
        """Validates that a CPF already registered to another customer is rejected."""
        mock_find_cpf.return_value = {'idCliente': 3}
        res = ClienteService.create({'nome': 'Maria Souza', 'cpf': '529.982.247-25'})
        assert res['status'] == 400
        assert "Já existe um cliente" in res['error']
        mock_create.assert_not_called()

    @patch('app.Services.cliente_service.ClienteRepository.find_by_cpf')
    @patch('app.Services.cliente_service.ClienteRepository.update')
    def test_update_keeping_own_cpf(self, mock_update, mock_find_cpf):
        """Validates that the duplicity lookup excludes the customer being edited."""
        mock_find_cpf.return_value = None
        res = ClienteService.update(7, {'nome': 'Maria Souza', 'cpf': '529.982.247-25'})
        assert res['status'] == 200
        mock_find_cpf.assert_called_once_with('529.982.247-25', 7)

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

    @patch('app.Services.cliente_service.ClienteRepository.get_saldo_convenio')
    @patch('app.Services.cliente_service.ClienteRepository.soft_delete')
    def test_delete_success(self, mock_delete, mock_saldo):
        """Validates customer soft-deletion."""
        mock_saldo.return_value = {'convenio': True, 'limiteConvenio': 500.0, 'saldoDevedor': 0}
        res = ClienteService.delete(5)
        assert res['status'] == 200
        assert res['message'] == Geral.CLIENTE_REMOVIDO
        mock_delete.assert_called_once_with(5)

    @patch('app.Services.cliente_service.ClienteRepository.get_saldo_convenio')
    @patch('app.Services.cliente_service.ClienteRepository.soft_delete')
    def test_delete_blocked_with_convenio_debt(self, mock_delete, mock_saldo):
        """Validates that a customer with pending convenio debt cannot be removed."""
        mock_saldo.return_value = {'convenio': True, 'limiteConvenio': 500.0, 'saldoDevedor': 120.0}
        res = ClienteService.delete(5)
        assert res['status'] == 400
        assert res['error'] == Geral.CLIENTE_REMOCAO_BLOQUEADA_SALDO
        mock_delete.assert_not_called()

    @patch('app.Services.cliente_service.ClienteRepository.get_saldo_convenio')
    @patch('app.Services.cliente_service.ClienteRepository.update')
    def test_disable_convenio_blocked_with_debt(self, mock_update, mock_saldo):
        """Validates that convenio cannot be disabled while the customer still owes."""
        mock_saldo.return_value = {'convenio': True, 'limiteConvenio': 500.0, 'saldoDevedor': 50.0}
        res = ClienteService.update(5, {'nome': 'Maria Souza', 'convenio': False})
        assert res['status'] == 400
        assert res['error'] == Geral.CLIENTE_CONVENIO_DESABILITAR_BLOQUEADO
        mock_update.assert_not_called()

    @patch('app.Services.cliente_service.ClienteRepository.reactivate')
    def test_reactivate_success(self, mock_reactivate):
        """Validates customer reactivation."""
        res = ClienteService.reactivate(5)
        assert res['status'] == 200
        assert "reativado com sucesso" in res['message']
        mock_reactivate.assert_called_once_with(5)
