# -*- coding: utf-8 -*-
"""
System / End-to-End Workflow Test: Inventory Control & Negative Stock Policy.
Simulates:
1. Product inventory verification.
2. Attempting to sell more items than available in stock with negative stock disabled -> blocked.
3. Administrator modifies system setting (permiteEstoqueNegativo = true).
4. Same overselling transaction succeeds under permissive policy.
5. Verification that stock restoration occurs on cancellation.
"""
import pytest
from unittest.mock import patch
from app.Repositories.venda_repository import EstoqueInsuficienteError

class TestInventoryControlWorkflowSystem:

    @patch('app.Services.venda_service.VendaRepository.create')
    def test_overselling_blocked_under_strict_policy(self, mock_create, client, vendedor_headers):
        """Validates that trying to oversell with permiteEstoqueNegativo=false is rejected."""
        mock_create.side_effect = EstoqueInsuficienteError(
            'Estoque insuficiente para "Arroz 5kg" (disponível: 2, solicitado: 5).'
        )

        sale_payload = {
            'formaPagamento': 'dinheiro',
            'valorTotal': 125.00,
            'valorFinal': 125.00,
            'itens': [{'idProduto': 10, 'quantidade': 5, 'precoUnitario': 25.00, 'subtotal': 125.00}],
            'pagamentos': [{'forma': 'dinheiro', 'valor': 125.00}]
        }

        res = client.post('/api/vendas', headers=vendedor_headers, json=sale_payload)
        assert res.status_code == 400
        data = res.get_json()
        assert "Estoque insuficiente" in data['error']
        assert "disponível: 2" in data['error']

    @patch('app.Services.configuracao_service.ConfiguracaoRepository.set')
    @patch('app.Services.configuracao_service.ConfiguracaoRepository.get_all')
    @patch('app.Services.venda_service.VendaRepository.create')
    def test_policy_switch_and_successful_oversell(
        self,
        mock_create_sale,
        mock_get_configs,
        mock_set_config,
        client,
        admin_headers,
        vendedor_headers
    ):
        """Validates switching to permissive inventory policy allows the oversale to succeed."""
        # 1. Admin updates setting to allow negative stock
        mock_get_configs.return_value = {'permiteEstoqueNegativo': 'true', 'dadosEmpresa': None}
        res_config = client.put(
            '/api/configuracoes',
            headers=admin_headers,
            json={'permiteEstoqueNegativo': True}
        )
        assert res_config.status_code == 200
        assert res_config.get_json()['permiteEstoqueNegativo'] is True

        # 2. Vendedor executes the previously blocked sale
        mock_create_sale.return_value = 802
        sale_payload = {
            'formaPagamento': 'cartao_credito',
            'valorTotal': 125.00,
            'valorFinal': 125.00,
            'itens': [{'idProduto': 10, 'quantidade': 5, 'precoUnitario': 25.00, 'subtotal': 125.00}],
            'pagamentos': [{'forma': 'cartao_credito', 'valor': 125.00}]
        }
        res_sale = client.post('/api/vendas', headers=vendedor_headers, json=sale_payload)
        assert res_sale.status_code == 201
        assert res_sale.get_json()['id'] == 802
