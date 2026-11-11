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
from middlewares.auth_middleware import active_tokens

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
    @patch('app.Services.auth_service.LicencaService.licenca_permite_acesso')
    def test_login_success_admin(self, mock_licenca, mock_find):
        """Validates successful login for an admin user."""
        mock_licenca.return_value = True
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
        assert token in active_tokens
        assert active_tokens[token]['id'] == 10
        assert active_tokens[token]['tipo'] == 'admin'

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.licenca_permite_acesso')
    def test_login_blocked_by_inactive_license(self, mock_licenca, mock_find):
        """Validates that an inactive license blocks common users (vendedor/admin)."""
        mock_licenca.return_value = False
        mock_find.return_value = {
            'idUsuario': 2,
            'nome': 'Vendedor 1',
            'email': 'vendedor@salestrack.com',
            'tipo': 'vendedor'
        }

        res = AuthService.login("vendedor@salestrack.com", "senha123")
        assert res['status'] == 403
        assert "Licença inativa" in res['error']

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.licenca_permite_acesso')
    def test_login_tecnico_bypasses_license_restriction(self, mock_licenca, mock_find):
        """Validates that a tecnico user can log in even when the license is inactive."""
        mock_licenca.return_value = False
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

    def test_logout_active_token(self):
        """Validates that logout removes the token from active_tokens dictionary."""
        token = "token-ativo-para-logout"
        active_tokens[token] = {'id': 1, 'nome': 'Teste', 'email': 't@s.com', 'tipo': 'admin'}

        res = AuthService.logout(token)
        assert res['status'] == 200
        assert res['message'] == Geral.LOGOUT_OK
        assert token not in active_tokens

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
