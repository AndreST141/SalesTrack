# -*- coding: utf-8 -*-
"""
Integration tests for Auth API endpoints (/api/login, /api/logout).
Tests HTTP status codes, JSON response structure, token generation,
and session invalidation.
"""
import pytest
from unittest.mock import patch
import jwt
from middlewares.auth_middleware import _revoked_tokens, JWT_SECRET, JWT_ALGORITHM
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
    @patch('app.Services.auth_service.LicencaService.motivo_bloqueio')
    def test_post_login_blocked_returns_reason(self, mock_motivo, mock_find, client):
        """Validates that POST /api/login returns 403 with the exact blocking reason."""
        mock_motivo.return_value = 'Sistema aguardando configuração dos dados da empresa. Entre em contato com o suporte técnico.'
        mock_find.return_value = {'idUsuario': 1, 'nome': 'Admin QA', 'email': 'admin@salestrack.com', 'tipo': 'admin'}
        res = client.post('/api/login', json={'email': 'admin@salestrack.com', 'senha': 'admin123'})
        assert res.status_code == 403
        data = res.get_json()
        assert "dados da empresa" in data['error']
        assert 'token' not in data

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.motivo_bloqueio')
    def test_post_login_success(self, mock_motivo, mock_find, client):
        """Validates successful POST /api/login returning 200, auth token, and user data."""
        mock_motivo.return_value = None
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
        payload = jwt.decode(data['token'], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert payload['email'] == 'admin@salestrack.com'
        assert data['token'] not in _revoked_tokens

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
        assert admin_token not in _revoked_tokens
        res = client.post('/api/logout', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['message'] == Geral.LOGOUT_OK
        assert admin_token in _revoked_tokens
