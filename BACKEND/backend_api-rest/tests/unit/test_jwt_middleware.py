# -*- coding: utf-8 -*-
"""
Unit tests for JWT-based auth_middleware:
- token generation
- token validation
- token revocation (logout)
- expired token rejection
- missing / malformed token rejection
- role-based access scenarios
"""
import time
import pytest
from unittest.mock import patch, MagicMock
from flask import Flask


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_app():
    """Minimal Flask app to test the decorator in isolation."""
    app = Flask(__name__)

    # Import here so the middleware module is fresh for each test session
    from middlewares.auth_middleware import token_required

    @app.route('/protected')
    @token_required
    def protected_view():
        from flask import request
        return {'ok': True, 'user': request.user}, 200

    return app


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestGenerateToken:

    def test_generate_token_returns_string(self):
        """generate_token should return a non-empty string."""
        from middlewares.auth_middleware import generate_token
        user = {'id': 1, 'nome': 'Admin', 'email': 'admin@test.com', 'tipo': 'admin'}
        token = generate_token(user)
        assert isinstance(token, str)
        assert len(token) > 10

    def test_generate_token_payload_decodable(self):
        """Token payload should be decodable and contain expected fields."""
        import jwt as pyjwt
        from middlewares.auth_middleware import generate_token, JWT_SECRET, JWT_ALGORITHM
        user = {'id': 42, 'nome': 'Felipe', 'email': 'felipe@test.com', 'tipo': 'vendedor'}
        token = generate_token(user)
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert payload['id'] == 42
        assert payload['nome'] == 'Felipe'
        assert payload['email'] == 'felipe@test.com'
        assert payload['tipo'] == 'vendedor'
        assert 'exp' in payload
        assert 'iat' in payload

    def test_generate_token_default_expiry_8_hours(self):
        """Token should expire approximately 8 hours from now."""
        import jwt as pyjwt
        from middlewares.auth_middleware import generate_token, JWT_SECRET, JWT_ALGORITHM
        before = int(time.time())
        user = {'id': 1, 'nome': 'Test', 'email': 'test@t.com', 'tipo': 'admin'}
        token = generate_token(user)
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        after = int(time.time())
        # expiry should be ~8 hours = 28800 seconds
        assert payload['exp'] >= before + 28790
        assert payload['exp'] <= after + 28810

    def test_generate_token_custom_expiry(self):
        """Custom expiry should be reflected in the payload."""
        import jwt as pyjwt
        from middlewares.auth_middleware import generate_token, JWT_SECRET, JWT_ALGORITHM
        before = int(time.time())
        user = {'id': 1, 'nome': 'Test', 'email': 'test@t.com', 'tipo': 'admin'}
        token = generate_token(user, expires_in_hours=1)
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        after = int(time.time())
        assert payload['exp'] >= before + 3590
        assert payload['exp'] <= after + 3610


class TestTokenRequired:

    @pytest.fixture(autouse=True)
    def clear_revoked(self):
        """Clear revoked tokens set before each test."""
        from middlewares import auth_middleware
        auth_middleware._revoked_tokens.clear()
        yield
        auth_middleware._revoked_tokens.clear()

    def test_missing_authorization_header_returns_401(self):
        """Request without Authorization header should return 401."""
        app = _make_app()
        with app.test_client() as client:
            resp = client.get('/protected')
            assert resp.status_code == 401
            data = resp.get_json()
            assert 'error' in data

    def test_invalid_token_returns_401(self):
        """Request with a garbage token should return 401."""
        app = _make_app()
        with app.test_client() as client:
            resp = client.get('/protected', headers={'Authorization': 'Bearer not-a-valid-jwt'})
            assert resp.status_code == 401

    def test_valid_token_allows_access(self):
        """Valid token should grant access and populate request.user."""
        from middlewares.auth_middleware import generate_token
        app = _make_app()
        user = {'id': 7, 'nome': 'Rafael', 'email': 'rafael@test.com', 'tipo': 'admin'}
        token = generate_token(user)
        with app.test_client() as client:
            resp = client.get('/protected', headers={'Authorization': f'Bearer {token}'})
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['user']['id'] == 7
            assert data['user']['nome'] == 'Rafael'

    def test_expired_token_returns_401(self):
        """Expired token should be rejected with 401."""
        import jwt as pyjwt
        from middlewares.auth_middleware import JWT_SECRET, JWT_ALGORITHM
        # Create a token already expired
        payload = {
            'id': 1, 'nome': 'Test', 'email': 't@t.com', 'tipo': 'admin',
            'exp': int(time.time()) - 1,  # already expired
            'iat': int(time.time()) - 100,
        }
        token = pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        app = _make_app()
        with app.test_client() as client:
            resp = client.get('/protected', headers={'Authorization': f'Bearer {token}'})
            assert resp.status_code == 401
            data = resp.get_json()
            assert 'expirado' in data['error'].lower() or 'error' in data

    def test_revoked_token_returns_401(self):
        """Revoked (logged-out) token should be rejected."""
        from middlewares.auth_middleware import generate_token, revoke_token
        app = _make_app()
        user = {'id': 3, 'nome': 'Bruno', 'email': 'bruno@test.com', 'tipo': 'vendedor'}
        token = generate_token(user)
        revoke_token(token)
        with app.test_client() as client:
            resp = client.get('/protected', headers={'Authorization': f'Bearer {token}'})
            assert resp.status_code == 401

    def test_bearer_prefix_stripped_correctly(self):
        """The 'Bearer ' prefix should be stripped before validation."""
        from middlewares.auth_middleware import generate_token
        app = _make_app()
        user = {'id': 1, 'nome': 'Admin', 'email': 'a@t.com', 'tipo': 'admin'}
        token = generate_token(user)
        with app.test_client() as client:
            # With Bearer prefix
            resp = client.get('/protected', headers={'Authorization': f'Bearer {token}'})
            assert resp.status_code == 200

    def test_token_without_bearer_prefix_accepted(self):
        """Token without 'Bearer ' prefix should still be validated."""
        from middlewares.auth_middleware import generate_token
        app = _make_app()
        user = {'id': 1, 'nome': 'Admin', 'email': 'a@t.com', 'tipo': 'admin'}
        token = generate_token(user)
        with app.test_client() as client:
            resp = client.get('/protected', headers={'Authorization': token})
            assert resp.status_code == 200

    def test_different_secret_token_returns_401(self):
        """Token signed with a different secret should be rejected."""
        import jwt as pyjwt
        payload = {
            'id': 1, 'nome': 'Hacker', 'email': 'h@h.com', 'tipo': 'admin',
            'exp': int(time.time()) + 3600,
            'iat': int(time.time()),
        }
        token = pyjwt.encode(payload, 'wrong-secret', algorithm='HS256')
        app = _make_app()
        with app.test_client() as client:
            resp = client.get('/protected', headers={'Authorization': f'Bearer {token}'})
            assert resp.status_code == 401


class TestRevokeToken:

    @pytest.fixture(autouse=True)
    def clear_revoked(self):
        from middlewares import auth_middleware
        auth_middleware._revoked_tokens.clear()
        yield
        auth_middleware._revoked_tokens.clear()

    def test_revoke_adds_to_revoked_set(self):
        """revoke_token should add the token to the revoked set."""
        from middlewares.auth_middleware import revoke_token, _revoked_tokens
        revoke_token('some-token')
        assert 'some-token' in _revoked_tokens

    def test_revoke_multiple_tokens(self):
        """Multiple tokens can be revoked independently."""
        from middlewares.auth_middleware import revoke_token, _revoked_tokens
        revoke_token('token-a')
        revoke_token('token-b')
        assert 'token-a' in _revoked_tokens
        assert 'token-b' in _revoked_tokens

    def test_revoke_same_token_twice_no_error(self):
        """Revoking the same token twice should not raise an error."""
        from middlewares.auth_middleware import revoke_token
        revoke_token('token-x')
        revoke_token('token-x')  # idempotent


class TestAuthServiceWithJWT:
    """Integration between AuthService and new JWT middleware."""

    @pytest.fixture(autouse=True)
    def clear_revoked(self):
        from middlewares import auth_middleware
        auth_middleware._revoked_tokens.clear()
        yield
        auth_middleware._revoked_tokens.clear()

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.motivo_bloqueio')
    def test_login_returns_valid_jwt(self, mock_licenca, mock_find):
        """After migration, login should return a JWT (starts with 'ey')."""
        import jwt as pyjwt
        from middlewares.auth_middleware import JWT_SECRET, JWT_ALGORITHM
        mock_licenca.return_value = None
        mock_find.return_value = {
            'idUsuario': 5, 'nome': 'Felipe Maximo',
            'email': 'felipe@test.com', 'tipo': 'admin'
        }
        from app.Services.auth_service import AuthService
        res = AuthService.login('felipe@test.com', 'senha_correta')
        assert res['status'] == 200
        assert 'token' in res
        # JWT tokens are base64url encoded and start with 'ey'
        assert res['token'].startswith('ey')
        # Token must be decodable
        payload = pyjwt.decode(res['token'], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert payload['id'] == 5
        assert payload['tipo'] == 'admin'

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.motivo_bloqueio')
    def test_logout_revokes_jwt(self, mock_licenca, mock_find):
        """Logout should add the JWT to the revoked set."""
        from middlewares.auth_middleware import _revoked_tokens
        mock_licenca.return_value = None
        mock_find.return_value = {
            'idUsuario': 1, 'nome': 'Admin', 'email': 'admin@t.com', 'tipo': 'admin'
        }
        from app.Services.auth_service import AuthService
        login_res = AuthService.login('admin@t.com', 'senha')
        token = login_res['token']
        assert token not in _revoked_tokens

        logout_res = AuthService.logout(token)
        assert logout_res['status'] == 200
        assert token in _revoked_tokens

    def test_logout_nonexistent_token_no_error(self):
        """Logging out with a non-existent token should not crash."""
        from app.Services.auth_service import AuthService
        res = AuthService.logout('token-nao-existe')
        assert res['status'] == 200

    @patch('app.Services.auth_service.AuthRepository.find_by_credentials')
    @patch('app.Services.auth_service.LicencaService.motivo_bloqueio')
    def test_session_persistence_across_calls(self, mock_licenca, mock_find):
        """
        JWT tokens are stateless — the same token should validate on
        multiple subsequent requests without any server-side state.
        """
        from middlewares.auth_middleware import generate_token, JWT_SECRET, JWT_ALGORITHM
        import jwt as pyjwt
        mock_licenca.return_value = None
        mock_find.return_value = {
            'idUsuario': 2, 'nome': 'Rafael Carvalho',
            'email': 'rafael@t.com', 'tipo': 'vendedor'
        }
        from app.Services.auth_service import AuthService
        res = AuthService.login('rafael@t.com', 'senha')
        token = res['token']

        # Validate the same token multiple times (simulating multiple requests)
        for _ in range(3):
            payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            assert payload['email'] == 'rafael@t.com'
