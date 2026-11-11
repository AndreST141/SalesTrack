# -*- coding: utf-8 -*-
"""
Security and Access Control (RBAC) Integration Tests.
Evaluates token validation mechanics, missing/malformed headers,
role permission matrices (vendedor vs admin vs tecnico), and UTF-8 response integrity.
"""
import pytest
from unittest.mock import patch
from app.Constants.geral import Geral
from middlewares.auth_middleware import active_tokens

class TestSecurityAndRbacIntegration:

    def test_missing_authorization_header(self, client):
        """Validates that requests with no Authorization header are blocked with 401."""
        res = client.get('/api/produtos')
        assert res.status_code == 401
        data = res.get_json()
        assert data['error'] == Geral.TOKEN_NAO_FORNECIDO

    def test_empty_token_in_header(self, client):
        """Validates that Authorization header with empty or whitespace token is blocked."""
        res = client.get('/api/produtos', headers={'Authorization': ''})
        assert res.status_code == 401

    def test_bearer_prefix_parsing(self, client, admin_token):
        """Validates that token_required handles both 'Bearer <token>' and raw '<token>'."""
        with patch('app.Services.produto_service.ProdutoRepository.get_all') as mock_get:
            mock_get.return_value = []
            # Raw token without "Bearer " prefix
            res_raw = client.get('/api/produtos', headers={'Authorization': admin_token})
            assert res_raw.status_code == 200

            # Token with "Bearer " prefix
            res_bearer = client.get('/api/produtos', headers={'Authorization': f'Bearer {admin_token}'})
            assert res_bearer.status_code == 200

    def test_nonexistent_or_revoked_token(self, client):
        """Validates that a token not present in active_tokens yields 401."""
        res = client.get('/api/produtos', headers={'Authorization': 'Bearer token-que-nao-existe'})
        assert res.status_code == 401
        data = res.get_json()
        assert data['error'] == Geral.TOKEN_INVALIDO

    def test_rbac_matrix_vendedor_restricted_endpoints(self, client, vendedor_headers):
        """
        Validates the security boundary: a vendedor must be forbidden (403) from
        mutating products, managing users, modifying settings, or accessing licenses.
        """
        restricted_calls = [
            ('post', '/api/produtos', {'nome': 'X', 'preco': 10}),
            ('put', '/api/produtos/1', {'nome': 'X', 'preco': 10}),
            ('delete', '/api/produtos/1', None),
            ('patch', '/api/produtos/1', None),
            ('get', '/api/usuarios', None),
            ('post', '/api/usuarios', {'nome': 'X'}),
            ('put', '/api/usuarios/1', {'nome': 'X'}),
            ('delete', '/api/usuarios/1', None),
            ('put', '/api/configuracoes', {'permiteEstoqueNegativo': True}),
            ('get', '/api/licenca', None),
            ('put', '/api/licenca', {'status': 'ativa'}),
        ]

        for method, endpoint, payload in restricted_calls:
            call_fn = getattr(client, method)
            kwargs = {'headers': vendedor_headers}
            if payload is not None:
                kwargs['json'] = payload
            res = call_fn(endpoint, **kwargs)
            assert res.status_code == 403, f"Endpoint {method.upper()} {endpoint} was not blocked for vendedor!"

    def test_rbac_tecnico_has_admin_privileges(self, client, tecnico_headers):
        """Validates that a tecnico user has full access to administrative endpoints."""
        with patch('app.Services.produto_service.ProdutoRepository.soft_delete') as mock_del:
            res = client.delete('/api/produtos/1', headers=tecnico_headers)
            assert res.status_code == 200

    def test_utf8_charset_in_responses(self, client, admin_headers):
        """Validates that after_request middleware ensures 'application/json; charset=utf-8'."""
        with patch('app.Services.produto_service.ProdutoRepository.get_all') as mock_get:
            mock_get.return_value = [{'idProduto': 1, 'nome': 'Pamonha com Queijo e Açafrão', 'preco': 9.50, 'ativo': 1}]
            res = client.get('/api/produtos', headers=admin_headers)
            assert res.status_code == 200
            content_type = res.headers.get('Content-Type')
            assert 'charset=utf-8' in content_type.lower()
