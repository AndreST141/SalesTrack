# -*- coding: utf-8 -*-
"""
Unit tests for TokenRevogadoRepository and MySQL-backed token revocation:
- Token hashing (SHA-256)
- Persistence of revoked tokens
- Multi-instance / cross-restart token revocation checks
- Cleanup of expired revoked tokens
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from app.Repositories.token_revogado_repository import TokenRevogadoRepository


class TestTokenRevogadoRepositoryUnit:

    def test_hash_token_sha256(self):
        """Validates deterministic SHA-256 generation for token indexing."""
        token = "some-jwt-token.header.payload.signature"
        h1 = TokenRevogadoRepository.hash_token(token)
        h2 = TokenRevogadoRepository.hash_token(token)

        assert len(h1) == 64  # SHA-256 hex string length
        assert h1 == h2
        assert TokenRevogadoRepository.hash_token("") == ""
        assert TokenRevogadoRepository.hash_token(None) == ""

    @patch('app.Repositories.token_revogado_repository.get_db_connection')
    def test_revogar_token_success(self, mock_get_conn):
        """Validates successful token persistence in MySQL."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        token = "valid-token-for-revocation"
        result = TokenRevogadoRepository.revogar(token, id_usuario=5, exp_timestamp=1700000000)

        assert result is True
        mock_cursor.execute.assert_called_once()
        mock_conn.commit.assert_called_once()
        mock_cursor.close.assert_called_once()
        mock_conn.close.assert_called_once()

    @patch('app.Repositories.token_revogado_repository.get_db_connection')
    def test_revogar_token_db_failure_handled(self, mock_get_conn):
        """Validates graceful handling when database connection fails."""
        mock_get_conn.return_value = None

        result = TokenRevogadoRepository.revogar("some-token")
        assert result is False

    @patch('app.Repositories.token_revogado_repository.get_db_connection')
    def test_revogar_token_sql_exception_rollback(self, mock_get_conn):
        """Validates rollback when SQL error occurs during revocation."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.execute.side_effect = Exception("DB Disk Full")

        result = TokenRevogadoRepository.revogar("problematic-token")
        assert result is False
        mock_conn.rollback.assert_called_once()

    @patch('app.Repositories.token_revogado_repository.get_db_connection')
    def test_esta_revogado_returns_true_when_found(self, mock_get_conn):
        """Validates that a revoked token is recognized in MySQL."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (1,)  # found

        assert TokenRevogadoRepository.esta_revogado("revoked-token") is True
        mock_cursor.execute.assert_called_once()

    @patch('app.Repositories.token_revogado_repository.get_db_connection')
    def test_esta_revogado_returns_false_when_not_found(self, mock_get_conn):
        """Validates that an active token returns False (not revoked)."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = None  # not found

        assert TokenRevogadoRepository.esta_revogado("clean-active-token") is False

    @patch('app.Repositories.token_revogado_repository.get_db_connection')
    def test_esta_revogado_empty_token(self, mock_get_conn):
        """Validates that empty token returns False immediately without DB query."""
        assert TokenRevogadoRepository.esta_revogado("") is False
        assert TokenRevogadoRepository.esta_revogado(None) is False
        mock_get_conn.assert_not_called()

    @patch('app.Repositories.token_revogado_repository.get_db_connection')
    def test_limpar_expirados_success(self, mock_get_conn):
        """Validates purging of naturally expired tokens from blacklist."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.rowcount = 14

        removidos = TokenRevogadoRepository.limpar_expirados()
        assert removidos == 14
        mock_cursor.execute.assert_called_once()
        mock_conn.commit.assert_called_once()


class TestCrossRestartTokenRevocation:
    """Simulates server restart scenarios to prove persistence."""

    @patch('app.Repositories.token_revogado_repository.TokenRevogadoRepository.esta_revogado')
    def test_revoked_token_persists_after_memory_cache_cleared(self, mock_db_check):
        """
        Simulates:
        1. Token is revoked in database
        2. Backend server restarts (clearing _revoked_tokens in-memory cache)
        3. Token is still recognized as revoked via MySQL lookup
        """
        from middlewares.auth_middleware import is_token_revoked, _revoked_tokens
        mock_db_check.return_value = True

        # Clear in-memory cache to simulate server restart
        _revoked_tokens.clear()
        token = "token-revoked-before-reboot"

        # Check must still find it revoked via MySQL
        assert is_token_revoked(token) is True
        mock_db_check.assert_called_once_with(token)
        # And should re-populate local cache
        assert token in _revoked_tokens
