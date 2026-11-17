# -*- coding: utf-8 -*-
"""
Unit tests for VendaService: business rules, split payment validation,
overpayment/change rules, stock error handling, and cancellation permissions.
"""
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
from app.Services.venda_service import VendaService
from app.Repositories.venda_repository import EstoqueInsuficienteError
from app.Constants.geral import Geral

class TestVendaServiceUnit:

    @patch('app.Services.venda_service.VendaRepository.get_all')
    def test_list_formatting(self, mock_get_all):
        """Validates numerical and date formatting in sales listing."""
        mock_get_all.return_value = [{
            'idVenda': 1,
            'valorTotal': '100.50',
            'desconto': '5.50',
            'acrescimo': '2.00',
            'valorFinal': '97.00',
            'dataVenda': datetime(2026, 10, 30, 14, 30, 0),
            'formaPagamento': 'pix',
            'pagamentos': [{'formaPagamento': 'pix', 'valor': '97.00'}]
        }]

        res = VendaService.list()
        assert res['status'] == 200
        venda = res['vendas'][0]
        assert venda['valorTotal'] == 100.5
        assert venda['desconto'] == 5.5
        assert venda['acrescimo'] == 2.0
        assert venda['valorFinal'] == 97.0
        assert venda['dataVenda'] == '2026-10-30 14:30:00'
        assert venda['pagamentos'][0]['valor'] == 97.0

    @patch('app.Services.venda_service.VendaRepository.find_with_itens')
    def test_show_not_found(self, mock_find):
        """Validates that a nonexistent sale returns 404."""
        mock_find.return_value = None
        res = VendaService.show(999)
        assert res['status'] == 404
        assert res['error'] == Geral.VENDA_NAO_ENCONTRADA

    def test_create_missing_required_fields(self):
        """Validates that sale creation without items or payment method is rejected."""
        res1 = VendaService.create({'formaPagamento': 'pix'}, usuario_id=1)
        assert res1['status'] == 400
        assert "obrigatórios" in res1['error']

        res2 = VendaService.create({'itens': [{'idProduto': 1, 'quantidade': 1}]}, usuario_id=1)
        assert res2['status'] == 400

    def test_validar_pagamentos_underpayment(self):
        """Validates RNE-005: underpayment is rejected."""
        dados = {
            'valorFinal': 100.00,
            'pagamentos': [
                {'forma': 'pix', 'valor': 50.00},
                {'forma': 'dinheiro', 'valor': 40.00}
            ]
        }
        erro = VendaService._validar_pagamentos(dados)
        assert erro is not None
        assert "é menor que o valor da venda" in erro

    def test_validar_pagamentos_overpayment_without_cash_rejected(self):
        """Validates that paying more than total with card/pix is rejected (only cash gives change)."""
        dados = {
            'valorFinal': 50.00,
            'pagamentos': [
                {'forma': 'cartao_credito', 'valor': 60.00}
            ]
        }
        erro = VendaService._validar_pagamentos(dados)
        assert erro is not None
        assert "Somente dinheiro permite troco" in erro

    def test_validar_pagamentos_overpayment_with_cash_allowed(self):
        """Validates that cash payment exceeding total is allowed (generates change)."""
        dados = {
            'valorFinal': 50.00,
            'pagamentos': [
                {'forma': 'dinheiro', 'valor': 60.00}
            ]
        }
        erro = VendaService._validar_pagamentos(dados)
        assert erro is None

    def test_validar_pagamentos_split_exact_sum(self):
        """Validates split payment matching exact total with multiple methods."""
        dados = {
            'valorFinal': 125.50,
            'pagamentos': [
                {'forma': 'pix', 'valor': 50.00},
                {'forma': 'cartao_debito', 'valor': 50.00},
                {'forma': 'dinheiro', 'valor': 25.50}
            ]
        }
        erro = VendaService._validar_pagamentos(dados)
        assert erro is None

    @patch('app.Services.venda_service.VendaRepository.create')
    def test_create_insufficient_stock_error(self, mock_repo_create):
        """Validates proper handling when repository raises EstoqueInsuficienteError."""
        mock_repo_create.side_effect = EstoqueInsuficienteError("Estoque insuficiente para 'Refrigerante 2L'")
        dados = {
            'formaPagamento': 'pix',
            'valorTotal': 20.0,
            'valorFinal': 20.0,
            'itens': [{'idProduto': 1, 'quantidade': 10, 'precoUnitario': 2.0, 'subtotal': 20.0}],
            'pagamentos': [{'forma': 'pix', 'valor': 20.0}]
        }
        res = VendaService.create(dados, usuario_id=1)
        assert res['status'] == 400
        assert "Estoque insuficiente" in res['error']

    @patch('app.Services.venda_service.VendaRepository.create')
    def test_create_success(self, mock_repo_create):
        """Validates successful sale creation returning 201."""
        mock_repo_create.return_value = 42
        dados = {
            'formaPagamento': 'dinheiro',
            'valorTotal': 30.0,
            'valorFinal': 30.0,
            'itens': [{'idProduto': 2, 'quantidade': 2, 'precoUnitario': 15.0, 'subtotal': 30.0}],
            'pagamentos': [{'forma': 'dinheiro', 'valor': 30.0}]
        }
        res = VendaService.create(dados, usuario_id=2)
        assert res['status'] == 201
        assert res['id'] == 42
        assert res['message'] == Geral.VENDA_CADASTRADA

    @patch('app.Services.venda_service.VendaRepository.cancel')
    def test_cancel_by_admin_success(self, mock_cancel):
        """Validates that an administrator can cancel a sale without extra password."""
        mock_cancel.return_value = True
        res = VendaService.cancel(id=1, usuario_tipo='admin', usuario_nome='Admin Teste')
        assert res['status'] == 200
        assert res['message'] == Geral.VENDA_CANCELADA

    def test_cancel_by_vendedor_without_admin_password(self):
        """Validates that a vendedor cannot cancel without providing an admin password."""
        res = VendaService.cancel(id=1, usuario_tipo='vendedor', usuario_nome='Vendedor 1', admin_senha=None)
        assert res['status'] == 403
        assert res['error'] == Geral.SEM_PERMISSAO

    @patch('app.Services.venda_service.AuthRepository.verify_admin_or_supervisor_password')
    def test_cancel_by_vendedor_with_invalid_admin_password(self, mock_verify):
        """Validates that providing an invalid admin password returns 422."""
        mock_verify.return_value = None
        res = VendaService.cancel(id=1, usuario_tipo='vendedor', usuario_nome='Vendedor 1', admin_senha='senha_errada')
        assert res['status'] == 422
        assert res['error'] == Geral.SENHA_ADMIN_INVALIDA

    @patch('app.Services.venda_service.AuthRepository.verify_admin_or_supervisor_password')
    @patch('app.Services.venda_service.VendaRepository.cancel')
    def test_cancel_by_vendedor_with_valid_admin_password(self, mock_cancel, mock_verify):
        """Validates that vendedor can cancel when authorized by valid admin credentials."""
        mock_verify.return_value = {'nome': 'Gerente Autorizador'}
        mock_cancel.return_value = True
        res = VendaService.cancel(id=5, usuario_tipo='vendedor', usuario_nome='Vendedor 1', admin_senha='senha_correta')
        assert res['status'] == 200
        assert res['message'] == Geral.VENDA_CANCELADA
        mock_cancel.assert_called_once_with(5, 'Vendedor 1', 'Gerente Autorizador')

    @patch('app.Services.venda_service.VendaRepository.cancel')
    def test_cancel_already_cancelled_sale(self, mock_cancel):
        """Validates proper error when attempting to cancel an already cancelled sale."""
        mock_cancel.return_value = 'already_cancelled'
        res = VendaService.cancel(id=10, usuario_tipo='admin', usuario_nome='Admin')
        assert res['status'] == 400
        assert res['error'] == Geral.VENDA_JA_CANCELADA
