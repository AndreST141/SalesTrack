# -*- coding: utf-8 -*-
"""
Unit tests for AuthService: login, logout, brute-force protection,
TOTP técnico validation, and license access rules.
"""
import pytest
import time
import os
import pyotp
from unittest.mock import patch, MagicMock
from app.Services.auth_service import AuthService, _tentativas_login, MAX_TENTATIVAS
from app.Repositories.auth_repository import senha_tecnico_valida
from app.Constants.geral import Geral
from middlewares.auth_middleware import _revoked_tokens, JWT_SECRET, JWT_ALGORITHM
import jwt

class TestAuthServiceUnit:

    def test_login_missing_credentials(self):
        """Validates that omitting email or password returns 400 with mandatory fields message."""
        res1 = AuthService.login("", "senha123")
        assert res1['status'] == 400
        assert res1['error'] == Geral.CAMPOS_OBRIGATORIOS

        res2 = AuthService.login("user@salestrack.com", "")
        assert res2['status'] == 400
        assert res2['error'] == Geral.CAMPOS_OBRIGATORIOS

        res3 = AuthService.login(None, None)
        assert res3['status'] == 400
        assert res3['error'] == Geral.CAMPOS_OBRIGATORIOS

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    def test_login_invalid_credentials(self, mock_find):
        """Validates that invalid credentials return 401 and increment failure count."""
        mock_find.return_value = None
        email = "usuario.inexistente@salestrack.com"

        res = AuthService.login(email, "senha_errada")
        assert res['status'] == 401
        assert res['error'] == Geral.CREDENCIAIS_INVALIDAS
        assert email in _tentativas_login
        assert _tentativas_login[email]['falhas'] == 1

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    def test_login_brute_force_lockout(self, mock_find):
        """Validates that 5 consecutive failed attempts trigger 429 lockout."""
        mock_find.return_value = None
        email = "alvo.ataque@salestrack.com"

        for i in range(MAX_TENTATIVAS):
            res = AuthService.login(email, f"errada_{i}")
            if i < MAX_TENTATIVAS - 1:
                assert res['status'] == 401
            else:
                assert res['status'] == 401

        # 6th attempt must be blocked by rate limit
        res_blocked = AuthService.login(email, "qualquer_senha")
        assert res_blocked['status'] == 429
        assert "Muitas tentativas" in res_blocked['error']

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.motivo_bloqueio')
    def test_login_success_admin(self, mock_motivo, mock_find):
        """Validates successful login for an admin user."""
        mock_motivo.return_value = None
        mock_find.return_value = {
            'idUsuario': 10,
            'nome': 'Gestor Teste',
            'email': 'gestor@salestrack.com',
            'tipo': 'admin'
        }

        res = AuthService.login("gestor@salestrack.com", "senha_correta")
        assert res['status'] == 200
        assert 'token' in res
        token = res['token']
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert payload['id'] == 10
        assert payload['tipo'] == 'admin'

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.motivo_bloqueio')
    def test_login_blocked_by_inactive_license(self, mock_motivo, mock_find):
        """Validates that an inactive license blocks common users (vendedor/admin)."""
        mock_motivo.return_value = 'Licença inativa ou vencida. Entre em contato com o suporte.'
        mock_find.return_value = {
            'idUsuario': 2,
            'nome': 'Vendedor 1',
            'email': 'vendedor@salestrack.com',
            'tipo': 'vendedor'
        }

        res = AuthService.login("vendedor@salestrack.com", "senha123")
        assert res['status'] == 403
        assert "Licença inativa" in res['error']
        assert res.get('token') is None

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.motivo_bloqueio')
    def test_login_blocked_by_missing_company_data(self, mock_motivo, mock_find):
        """Validates that the 403 carries the exact reason when company data is not configured yet."""
        mock_motivo.return_value = 'Sistema aguardando configuração dos dados da empresa. Entre em contato com o suporte técnico.'
        mock_find.return_value = {
            'idUsuario': 1,
            'nome': 'Admin',
            'email': 'admin@salestrack.com',
            'tipo': 'admin'
        }

        res = AuthService.login("admin@salestrack.com", "admin123")
        assert res['status'] == 403
        assert "dados da empresa" in res['error']

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.motivo_bloqueio')
    def test_login_tecnico_bypasses_license_restriction(self, mock_motivo, mock_find):
        """Validates that a tecnico user can log in even when the license is inactive."""
        mock_motivo.return_value = 'Licença inativa ou vencida. Entre em contato com o suporte.'
        mock_find.return_value = {
            'idUsuario': 99,
            'nome': 'Técnico de Suporte',
            'email': 'tecnico@salestrack.com',
            'tipo': 'tecnico'
        }

        res = AuthService.login("tecnico@salestrack.com", "totp123456")
        assert res['status'] == 200
        assert 'token' in res
        assert res['user']['tipo'] == 'tecnico'
        mock_motivo.assert_not_called()

    def test_logout_active_token(self):
        """Validates that logout revokes the token."""
        token = "token-ativo-para-logout"
        _revoked_tokens.discard(token)

        res = AuthService.logout(token)
        assert res['status'] == 200
        assert res['message'] == Geral.LOGOUT_OK
        assert token in _revoked_tokens

    def test_logout_nonexistent_token(self):
        """Validates that logout with an already expired or nonexistent token completes without error."""
        res = AuthService.logout("token-inexistente")
        assert res['status'] == 200
        assert res['message'] == Geral.LOGOUT_OK

    def test_senha_tecnico_valida_totp(self):
        """Validates TOTP verification for the tecnico user."""
        test_secret = "7GSNJCHFDQNNTFSNP6TAJD4BO3VI5SCR"
        with patch.dict(os.environ, {'TECNICO_SECRET': test_secret}):
            totp = pyotp.TOTP(test_secret)
            valid_code = totp.now()
            assert senha_tecnico_valida(valid_code) is True
            assert senha_tecnico_valida("000000") is False
            assert senha_tecnico_valida("") is False
            assert senha_tecnico_valida(None) is False
