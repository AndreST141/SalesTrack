# -*- coding: utf-8 -*-
"""
Integration tests for Auth API endpoints (/api/login, /api/logout).
Tests HTTP status codes, JSON response structure, token generation,
and session invalidation.
"""
import pytest
from unittest.mock import patch
from middlewares.auth_middleware import active_tokens
from app.Constants.geral import Geral

class TestAuthApiIntegration:

    def test_post_login_empty_body(self, client):
        """Validates that POST /api/login without body returns 400."""
        res = client.post('/api/login', json={})
        assert res.status_code == 400
        data = res.get_json()
        assert data['error'] == Geral.CAMPOS_OBRIGATORIOS

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    def test_post_login_bad_credentials(self, mock_find, client):
        """Validates that POST /api/login with invalid credentials returns 401."""
        mock_find.return_value = None
        res = client.post('/api/login', json={'email': 'wrong@s.com', 'senha': 'wrong'})
        assert res.status_code == 401
        data = res.get_json()
        assert data['error'] == Geral.CREDENCIAIS_INVALIDAS

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.licenca_permite_acesso')
    def test_post_login_success(self, mock_licenca, mock_find, client):
        """Validates successful POST /api/login returning 200, auth token, and user data."""
        mock_licenca.return_value = True
        mock_find.return_value = {
            'idUsuario': 1,
            'nome': 'Admin QA',
            'email': 'admin@salestrack.com',
            'tipo': 'admin'
        }
        res = client.post('/api/login', json={'email': 'admin@salestrack.com', 'senha': 'admin123'})
        assert res.status_code == 200
        data = res.get_json()
        assert 'token' in data
        assert data['user']['email'] == 'admin@salestrack.com'
        assert data['token'] in active_tokens

    def test_post_logout_unauthenticated(self, client):
        """Validates that POST /api/logout without Authorization header returns 401."""
        res = client.post('/api/logout')
        assert res.status_code == 401
        data = res.get_json()
        assert data['error'] == Geral.TOKEN_NAO_FORNECIDO

    def test_post_logout_invalid_token(self, client):
        """Validates that POST /api/logout with unknown token returns 401."""
        res = client.post('/api/logout', headers={'Authorization': 'Bearer fake-invalid-token'})
        assert res.status_code == 401
        data = res.get_json()
        assert data['error'] == Geral.TOKEN_INVALIDO

    def test_post_logout_success(self, client, admin_headers, admin_token):
        """Validates that POST /api/logout revokes session and returns 200."""
        assert admin_token in active_tokens
        res = client.post('/api/logout', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['message'] == Geral.LOGOUT_OK
        assert admin_token not in active_tokens
