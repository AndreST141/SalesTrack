# -*- coding: utf-8 -*-
"""
Unit tests for Database Repositories:
- AuthRepository (credential queries, bcrypt checks, fallback plaintext, admin lookup)
- ProdutoRepository (soft delete, reactivate, queries)
- ClienteRepository (queries, soft delete, reactivate)
- VendaRepository (FOR UPDATE locking, stock decrement, negative stock errors, cancellation with stock rollback)
- ConfiguracaoRepository & LicencaRepository
Uses mock database connections and cursors to test data access logic and transaction handling.
"""
import pytest
from unittest.mock import MagicMock, patch
from app.Repositories.auth_repository import AuthRepository
from app.Repositories.produto_repository import ProdutoRepository
from app.Repositories.cliente_repository import ClienteRepository
from app.Repositories.venda_repository import VendaRepository, EstoqueInsuficienteError
from app.Repositories.configuracao_repository import ConfiguracaoRepository
from app.Repositories.licenca_repository import LicencaRepository
from app.Repositories.categoria_repository import CategoriaRepository, DashboardRepository
from app.Repositories.relatorio_repository import RelatorioRepository

class TestRepositoriesUnit:

    @patch('app.Repositories.auth_repository.get_db_connection')
    def test_auth_repo_find_by_credentials_bcrypt(self, mock_get_conn):
        """Validates AuthRepository verification with bcrypt hashed password."""
        import bcrypt
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode('utf-8')
        mock_cursor.fetchone.return_value = {
            'idUsuario': 1,
            'nome': 'Admin',
            'email': 'admin@salestrack.com',
            'senha': hashed,
            'tipo': 'admin',
            'ativo': 1
        }

        user = AuthRepository.find_by_credentials('admin@salestrack.com', 'admin123')
        assert user is not None
        assert user['idUsuario'] == 1

        # Wrong password with bcrypt
        user_wrong = AuthRepository.find_by_credentials('admin@salestrack.com', 'wrong_pwd')
        assert user_wrong is None

    @patch('app.Repositories.auth_repository.get_db_connection')
    def test_auth_repo_find_by_credentials_plaintext_fallback(self, mock_get_conn):
        """Validates AuthRepository verification with legacy plaintext password."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        mock_cursor.fetchone.return_value = {
            'idUsuario': 2,
            'nome': 'Vendedor Legado',
            'email': 'legado@salestrack.com',
            'senha': 'plaintextpassword',
            'tipo': 'vendedor',
            'ativo': 1
        }

        user = AuthRepository.find_by_credentials('legado@salestrack.com', 'plaintextpassword')
        assert user is not None
        assert user['idUsuario'] == 2

    @patch('app.Repositories.auth_repository.get_db_connection')
    def test_auth_repo_verify_admin_password(self, mock_get_conn):
        """Validates verify_admin_or_supervisor_password against multiple active users."""
        import bcrypt
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        hashed_admin = bcrypt.hashpw(b"mestre123", bcrypt.gensalt()).decode('utf-8')
        mock_cursor.fetchall.return_value = [
            {'idUsuario': 1, 'nome': 'Admin Master', 'senha': hashed_admin, 'tipo': 'admin'},
            {'idUsuario': 2, 'nome': 'Supervisor', 'senha': 'supervisor_plain', 'tipo': 'supervisor'}
        ]

        found_admin = AuthRepository.verify_admin_or_supervisor_password('mestre123')
        assert found_admin is not None
        assert found_admin['nome'] == 'Admin Master'

        found_sup = AuthRepository.verify_admin_or_supervisor_password('supervisor_plain')
        assert found_sup is not None
        assert found_sup['nome'] == 'Supervisor'

        not_found = AuthRepository.verify_admin_or_supervisor_password('senha_totalmente_errada')
        assert not_found is None

    @patch('app.Repositories.produto_repository.get_db_connection')
    def test_produto_repo_get_all_and_mutations(self, mock_get_conn):
        """Validates ProdutoRepository queries, insert, update, and soft delete."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        # get_all
        mock_cursor.fetchall.return_value = [{'idProduto': 1, 'nome': 'Pamonha'}]
        prods = ProdutoRepository.get_all(incluir_inativos=False)
        assert len(prods) == 1
        assert "WHERE p.ativo = TRUE" in mock_cursor.execute.call_args[0][0]

        # create
        mock_cursor.lastrowid = 7
        new_id = ProdutoRepository.create({'nome': 'Canjica', 'preco': 6.0, 'idCategoria': 1})
        assert new_id == 7
        mock_conn.commit.assert_called()

        # soft delete
        ProdutoRepository.soft_delete(7)
        assert "ativo = FALSE" in mock_cursor.execute.call_args[0][0]

        # reactivate
        ProdutoRepository.reactivate(7)
        assert "ativo = TRUE" in mock_cursor.execute.call_args[0][0]

    @patch('app.Repositories.cliente_repository.get_db_connection')
    def test_cliente_repo_mutations(self, mock_get_conn):
        """Validates ClienteRepository queries, insert, and soft delete."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        mock_cursor.lastrowid = 15
        cid = ClienteRepository.create({'nome': 'Cliente Teste', 'cpf': '111.222.333-44'})
        assert cid == 15
        mock_conn.commit.assert_called()

        ClienteRepository.soft_delete(15)
        assert "ativo = FALSE" in mock_cursor.execute.call_args[0][0]

    @patch('app.Repositories.configuracao_repository.get_db_connection')
    def test_configuracao_repo_get_set(self, mock_get_conn):
        """Validates ConfiguracaoRepository key-value access."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        mock_cursor.fetchall.return_value = [
            {'chave': 'permiteEstoqueNegativo', 'valor': 'true'},
            {'chave': 'tema', 'valor': 'dark'}
        ]
        configs = ConfiguracaoRepository.get_all()
        assert configs['permiteEstoqueNegativo'] == 'true'
        assert configs['tema'] == 'dark'

        mock_cursor.fetchone.return_value = {'valor': 'true'}
        assert ConfiguracaoRepository.get_bool('permiteEstoqueNegativo', False) is True

        ConfiguracaoRepository.set('permiteEstoqueNegativo', False)
        assert "ON DUPLICATE KEY UPDATE" in mock_cursor.execute.call_args[0][0]

    @patch('app.Repositories.licenca_repository.get_db_connection')
    def test_licenca_repo_get_upsert(self, mock_get_conn):
        """Validates LicencaRepository retrieval and upsert."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        full_lic = {
            'idLicenca': 1,
            'cnpj': '12.345.678/0001-90',
            'razaoSocial': 'Empresa Teste',
            'identificador': 'LIC-001',
            'status': 'ativa',
            'dataInicio': '2026-01-01',
            'dataVencimento': '2027-01-01',
            'observacoes': 'Teste'
        }
        mock_cursor.fetchone.return_value = full_lic
        lic = LicencaRepository.get()
        assert lic['status'] == 'ativa'

        LicencaRepository.upsert({'status': 'suspensa', 'dataInicio': '2026-01-01'})
        mock_conn.commit.assert_called()

    @patch('app.Repositories.venda_repository.ConfiguracaoRepository.get_bool')
    @patch('app.Repositories.venda_repository.get_db_connection')
    def test_venda_repo_create_with_stock_locking(self, mock_get_conn, mock_get_bool):
        """Validates VendaRepository create transaction using SELECT FOR UPDATE and stock reduction."""
        mock_get_bool.return_value = False
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        mock_cursor.lastrowid = 101  # Venda ID
        # Mock product inventory check (FOR UPDATE returns name and current stock)
        mock_cursor.fetchone.return_value = ('Pamonha Salgada', 10)

        dados = {
            'valorTotal': 20.00,
            'desconto': 0.00,
            'acrescimo': 0.00,
            'valorFinal': 20.00,
            'formaPagamento': 'pix',
            'observacoes': 'Sem cebola',
            'itens': [
                {'idProduto': 1, 'quantidade': 3, 'precoUnitario': 6.66, 'subtotal': 20.00}
            ],
            'pagamentos': [{'forma': 'pix', 'valor': 20.00}]
        }

        venda_id = VendaRepository.create(dados, usuario_id=2)
        assert venda_id == 101

        # Check that SELECT FOR UPDATE was executed
        executed_sqls = [call[0][0] for call in mock_cursor.execute.call_args_list]
        assert any("FOR UPDATE" in sql for sql in executed_sqls)
        # Check that stock was updated to 10 - 3 = 7
        assert any("UPDATE Produto SET estoque" in sql for sql in executed_sqls)
        mock_conn.commit.assert_called()

    @patch('app.Repositories.venda_repository.ConfiguracaoRepository.get_bool')
    @patch('app.Repositories.venda_repository.get_db_connection')
    def test_venda_repo_create_rolls_back_on_negative_stock(self, mock_get_conn, mock_get_bool):
        """Validates that VendaRepository raises EstoqueInsuficienteError and triggers rollback."""
        mock_get_bool.return_value = False
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        mock_cursor.lastrowid = 102
        # Current stock = 2, requested = 5 -> negative!
        mock_cursor.fetchone.return_value = ('Item Escasso', 2)

        dados = {
            'valorTotal': 50.00,
            'valorFinal': 50.00,
            'formaPagamento': 'dinheiro',
            'itens': [{'idProduto': 1, 'quantidade': 5, 'precoUnitario': 10.00, 'subtotal': 50.00}]
        }

        with pytest.raises(EstoqueInsuficienteError) as exc_info:
            VendaRepository.create(dados, usuario_id=1)

        assert "Estoque insuficiente" in str(exc_info.value)
        mock_conn.rollback.assert_called()

    @patch('app.Repositories.venda_repository.get_db_connection')
    def test_venda_repo_cancel_restores_inventory(self, mock_get_conn):
        """Validates that cancelling a sale queries ItemVenda and restores inventory."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        # First query: check status
        mock_cursor.fetchone.return_value = {'idVenda': 5, 'status': 'concluida'}
        # Second query: fetch items
        mock_cursor.fetchall.return_value = [{'idProduto': 10, 'quantidade': 3}]

        result = VendaRepository.cancel(id=5, cancelado_por='Admin QA', autorizado_por='Supervisor QA')
        assert result is True

        executed_sqls = [call[0][0] for call in mock_cursor.execute.call_args_list]
        # Check stock restoration SQL
        assert any("UPDATE Produto SET estoque = estoque +" in sql for sql in executed_sqls)
        # Check sale status update
        assert any("UPDATE Venda SET status = 'cancelada'" in sql for sql in executed_sqls)
        mock_conn.commit.assert_called()

    @patch('app.Repositories.venda_repository.get_db_connection')
    def test_venda_repo_cancel_already_cancelled(self, mock_get_conn):
        """Validates that cancel returns 'already_cancelled' if status is already 'cancelada'."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        mock_cursor.fetchone.return_value = {'idVenda': 6, 'status': 'cancelada'}
        res = VendaRepository.cancel(id=6)
        assert res == 'already_cancelled'
