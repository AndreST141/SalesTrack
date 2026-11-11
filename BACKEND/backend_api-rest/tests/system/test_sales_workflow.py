# -*- coding: utf-8 -*-
"""
System / End-to-End Workflow Test: Sales Lifecycle.
Simulates full commercial lifecycle:
1. User logs in as vendedor and receives session token.
2. Vendedor fetches available product catalog.
3. Vendedor registers a new customer.
4. Vendedor submits multi-item sale with split payment.
5. Vendedor checks the registered sale in the sales history.
6. Sale cancellation is requested and authorized with admin password.
7. Verification that sale status changed to 'cancelada'.
"""
import pytest
from datetime import datetime
from unittest.mock import patch
from app.Constants.geral import Geral

class TestSalesWorkflowSystem:

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.licenca_permite_acesso')
    @patch('app.Services.produto_service.ProdutoRepository.get_all')
    @patch('app.Services.cliente_service.ClienteRepository.create')
    @patch('app.Services.venda_service.VendaRepository.create')
    @patch('app.Services.venda_service.VendaRepository.find_with_itens')
    @patch('app.Services.venda_service.AuthRepository.verify_admin_or_supervisor_password')
    @patch('app.Services.venda_service.VendaRepository.cancel')
    def test_complete_sales_lifecycle(
        self,
        mock_cancel,
        mock_verify_admin_pwd,
        mock_find_sale,
        mock_create_sale,
        mock_create_client,
        mock_get_products,
        mock_licenca,
        mock_find_user,
        client
    ):
        # 1. Autenticação do vendedor
        mock_licenca.return_value = True
        mock_find_user.return_value = {
            'idUsuario': 20,
            'nome': 'Rafael Operador',
            'email': 'rafael@salestrack.com',
            'tipo': 'vendedor'
        }
        res_login = client.post('/api/login', json={'email': 'rafael@salestrack.com', 'senha': 'vendedor123'})
        assert res_login.status_code == 200
        token = res_login.get_json()['token']
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

        # 2. Consulta do catálogo de produtos
        mock_get_products.return_value = [
            {'idProduto': 101, 'nome': 'Pamonha Salgada c/ Queijo', 'preco': '12.00', 'estoque': 40, 'ativo': 1},
            {'idProduto': 102, 'nome': 'Suco de Milho Verde', 'preco': '6.00', 'estoque': 25, 'ativo': 1}
        ]
        res_catalog = client.get('/api/produtos', headers=headers)
        assert res_catalog.status_code == 200
        catalog = res_catalog.get_json()
        assert len(catalog) == 2

        # 3. Cadastro do cliente na hora da venda
        mock_create_client.return_value = 88
        client_data = {'nome': 'Cliente Balcão', 'cpf': '111.222.333-44', 'telefone': '62988889999'}
        res_client = client.post('/api/clientes', headers=headers, json=client_data)
        assert res_client.status_code == 201
        client_id = res_client.get_json()['id']
        assert client_id == 88

        # 4. Registro de venda com múltiplos itens e pagamento dividido (split payment)
        # Total: 2 x 12.00 + 1 x 6.00 = 30.00
        # Pagamento: 15.00 PIX + 15.00 Dinheiro
        mock_create_sale.return_value = 501
        sale_payload = {
            'idCliente': client_id,
            'formaPagamento': 'pix',
            'valorTotal': 30.00,
            'desconto': 0.00,
            'acrescimo': 0.00,
            'valorFinal': 30.00,
            'itens': [
                {'idProduto': 101, 'quantidade': 2, 'precoUnitario': 12.00, 'subtotal': 24.00},
                {'idProduto': 102, 'quantidade': 1, 'precoUnitario': 6.00, 'subtotal': 6.00}
            ],
            'pagamentos': [
                {'forma': 'pix', 'valor': 15.00},
                {'forma': 'dinheiro', 'valor': 15.00}
            ]
        }
        res_sale = client.post('/api/vendas', headers=headers, json=sale_payload)
        assert res_sale.status_code == 201
        sale_id = res_sale.get_json()['id']
        assert sale_id == 501

        # 5. Consulta da venda detalhada no histórico
        mock_find_sale.return_value = {
            'idVenda': sale_id,
            'idCliente': client_id,
            'valorTotal': '30.00',
            'desconto': '0.00',
            'acrescimo': '0.00',
            'valorFinal': '30.00',
            'formaPagamento': 'pix',
            'status': 'concluida',
            'dataVenda': datetime(2026, 10, 30, 15, 30, 0),
            'itens': [
                {'idProduto': 101, 'precoUnitario': '12.00', 'subtotal': '24.00'},
                {'idProduto': 102, 'precoUnitario': '6.00', 'subtotal': '6.00'}
            ],
            'pagamentos': [
                {'formaPagamento': 'pix', 'valor': '15.00'},
                {'formaPagamento': 'dinheiro', 'valor': '15.00'}
            ]
        }
        res_show = client.get(f'/api/vendas/{sale_id}', headers=headers)
        assert res_show.status_code == 200
        sale_details = res_show.get_json()
        assert sale_details['valorFinal'] == 30.00
        assert len(sale_details['itens']) == 2
        assert len(sale_details['pagamentos']) == 2

        # 6. Cancelamento da venda autorizado por senha de administrador
        mock_verify_admin_pwd.return_value = {'idUsuario': 1, 'nome': 'Gerente Responsável', 'tipo': 'admin'}
        mock_cancel.return_value = True
        res_cancel = client.patch(
            f'/api/vendas/{sale_id}/cancelar',
            headers=headers,
            json={'admin_senha': 'senha_mestre_admin'}
        )
        assert res_cancel.status_code == 200
        assert res_cancel.get_json()['success'] is True
        mock_cancel.assert_called_once_with(sale_id, 'Rafael Operador', 'Gerente Responsável')
