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
from app.Repositories.venda_repository import VendaRepository, EstoqueInsuficienteError, ConvenioPagamentoExistenteError
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
        # fetchall #1: convenio entries (none) / fetchall #2: sale items
        mock_cursor.fetchall.side_effect = [[], [{'idProduto': 10, 'quantidade': 3}]]

        result = VendaRepository.cancel(id=5, cancelado_por='Admin QA', autorizado_por='Supervisor QA')
        assert result is True

        executed_sqls = [call[0][0] for call in mock_cursor.execute.call_args_list]
        # Check stock restoration SQL
        assert any("UPDATE Produto SET estoque = estoque +" in sql for sql in executed_sqls)
        # Check sale status update
        assert any("UPDATE Venda SET status = 'cancelada'" in sql for sql in executed_sqls)
        # No convenio entries -> nothing to delete
        assert not any("DELETE FROM ConvenioLancamento" in sql for sql in executed_sqls)
        mock_conn.commit.assert_called()

    @patch('app.Repositories.venda_repository.get_db_connection')
    def test_venda_repo_cancel_releases_pending_convenio(self, mock_get_conn):
        """Validates that cancelling a sale with a pending convenio entry deletes it (frees the limit)."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        mock_cursor.fetchone.return_value = {'idVenda': 7, 'status': 'concluida'}
        mock_cursor.fetchall.side_effect = [
            [{'idLancamento': 1, 'status': 'pendente'}],
            [{'idProduto': 10, 'quantidade': 1}],
        ]

        assert VendaRepository.cancel(id=7, cancelado_por='Admin QA') is True
        executed_sqls = [call[0][0] for call in mock_cursor.execute.call_args_list]
        assert any("FROM ConvenioLancamento WHERE idVenda = %s FOR UPDATE" in sql for sql in executed_sqls)
        assert any("DELETE FROM ConvenioLancamento" in sql for sql in executed_sqls)
        mock_conn.commit.assert_called()

    @patch('app.Repositories.venda_repository.get_db_connection')
    def test_venda_repo_cancel_blocked_by_paid_convenio(self, mock_get_conn):
        """Validates that a sale whose convenio entry was already paid cannot be cancelled (rollback)."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        mock_cursor.fetchone.return_value = {'idVenda': 8, 'status': 'concluida'}
        mock_cursor.fetchall.side_effect = [[{'idLancamento': 2, 'status': 'pago'}]]

        with pytest.raises(ConvenioPagamentoExistenteError):
            VendaRepository.cancel(id=8, cancelado_por='Admin QA')

        executed_sqls = [call[0][0] for call in mock_cursor.execute.call_args_list]
        assert not any("UPDATE Produto SET estoque" in sql for sql in executed_sqls)
        assert not any("UPDATE Venda SET status = 'cancelada'" in sql for sql in executed_sqls)
        mock_conn.rollback.assert_called()
        mock_conn.commit.assert_not_called()

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


def _norm(sql):
    """Colapsa espaços/quebras de linha para comparar trechos de SQL."""
    return ' '.join(sql.split())


@pytest.fixture
def relatorio_db():
    """Conexão e cursor mockados para RelatorioRepository (nenhum banco real)."""
    with patch('app.Repositories.relatorio_repository.get_db_connection') as mock_get_conn:
        conn, cursor = MagicMock(), MagicMock()
        mock_get_conn.return_value = conn
        conn.cursor.return_value = cursor
        cursor.fetchall.return_value = []
        yield conn, cursor


class TestRelatorioRepositoryUnit:
    """Protege as regras de negócio que vivem no SQL dos relatórios — em
    especial o filtro de vendas concluídas (BUG-003: relatórios somavam
    vendas canceladas). Sem esses testes, remover o filtro não quebrava nada."""

    def _sqls(self, cursor):
        return [_norm(c.args[0]) for c in cursor.execute.call_args_list]

    # ---------- get_vendas_periodo ----------

    def test_vendas_periodo_filtra_concluidas_e_parametriza_datas(self, relatorio_db):
        conn, cursor = relatorio_db
        RelatorioRepository.get_vendas_periodo('2026-10-01', '2026-10-31')
        sql, params = cursor.execute.call_args_list[0].args
        sql = _norm(sql)
        assert "v.status = 'concluida'" in sql
        assert 'DATE(v.dataVenda) BETWEEN %s AND %s' in sql
        assert params == ('2026-10-01', '2026-10-31')
        assert '2026-10-01' not in sql          # datas nunca concatenadas no SQL
        cursor.close.assert_called_once()
        conn.close.assert_called_once()

    def test_vendas_periodo_vazio_nao_busca_pagamentos(self, relatorio_db):
        _, cursor = relatorio_db
        assert RelatorioRepository.get_vendas_periodo('2026-10-01', '2026-10-31') == []
        assert cursor.execute.call_count == 1   # sem segunda query com IN ()

    def test_vendas_periodo_agrupa_pagamentos_por_venda(self, relatorio_db):
        _, cursor = relatorio_db
        cursor.fetchall.side_effect = [
            [{'idVenda': 7, 'valorFinal': 50}, {'idVenda': 8, 'valorFinal': 30}],
            [
                {'idVenda': 7, 'formaPagamento': 'pix',      'valor': 20},
                {'idVenda': 7, 'formaPagamento': 'dinheiro', 'valor': 30},
            ],
        ]
        vendas = RelatorioRepository.get_vendas_periodo('2026-10-01', '2026-10-31')

        sql_pag, params_pag = cursor.execute.call_args_list[1].args
        assert 'WHERE idVenda IN (%s,%s)' in _norm(sql_pag)
        assert params_pag == (7, 8)
        por_id = {v['idVenda']: v for v in vendas}
        assert por_id[7]['pagamentos'] == [
            {'formaPagamento': 'pix', 'valor': 20},
            {'formaPagamento': 'dinheiro', 'valor': 30},
        ]
        assert por_id[8]['pagamentos'] == []    # venda sem pagamento não herda os da outra

    # ---------- get_produtos_mais_vendidos ----------

    def test_mais_vendidos_filtra_concluidas_e_parametriza_limite(self, relatorio_db):
        _, cursor = relatorio_db
        RelatorioRepository.get_produtos_mais_vendidos('2026-10-01', '2026-10-31', 10)
        sql, params = cursor.execute.call_args.args
        sql = _norm(sql)
        assert "v.status = 'concluida'" in sql
        assert 'LIMIT %s' in sql
        assert 'ORDER BY totalVendido DESC' in sql
        assert params == ('2026-10-01', '2026-10-31', 10)

    # ---------- get_produtos_sem_movimento ----------

    def test_sem_movimento_considera_so_vendas_concluidas(self, relatorio_db):
        """Produto cuja única venda foi cancelada continua 'sem movimento'."""
        _, cursor = relatorio_db
        RelatorioRepository.get_produtos_sem_movimento('2026-10-01', '2026-10-31')
        sql, params = cursor.execute.call_args.args
        sql = _norm(sql)
        assert 'p.ativo = TRUE' in sql
        assert 'NOT IN' in sql
        subquery = sql.split('NOT IN', 1)[1]
        assert "v.status = 'concluida'" in subquery
        assert params == ('2026-10-01', '2026-10-31')

    # ---------- get_estoque_detalhado ----------

    def test_estoque_detalhado_filtro_de_status_fica_no_join(self, relatorio_db):
        """O filtro de concluídas precisa estar no LEFT JOIN, não no WHERE:
        no WHERE, produtos sem venda (ou só com vendas canceladas) sumiriam
        do relatório de estoque."""
        _, cursor = relatorio_db
        RelatorioRepository.get_estoque_detalhado()
        sql = _norm(cursor.execute.call_args.args[0])
        assert "LEFT JOIN Venda v ON iv.idVenda = v.idVenda AND v.status = 'concluida'" in sql
        assert 'WHERE' not in sql

    def test_estoque_detalhado_nao_soma_itens_de_venda_cancelada(self, relatorio_db):
        """Com o filtro no JOIN, item de venda cancelada continua na junção
        (v = NULL). Os SUMs precisam ignorá-lo — antes, totalVendido e
        receitaTotal incluíam vendas canceladas (ex.: Feijão 1kg 203 em vez
        de 198 no banco de desenvolvimento)."""
        _, cursor = relatorio_db
        RelatorioRepository.get_estoque_detalhado()
        sql = _norm(cursor.execute.call_args.args[0])
        assert 'SUM(CASE WHEN v.idVenda IS NOT NULL THEN iv.quantidade END)' in sql
        assert 'SUM(CASE WHEN v.idVenda IS NOT NULL THEN iv.subtotal END)' in sql
        assert 'SUM(iv.quantidade)' not in sql
        assert 'SUM(iv.subtotal)' not in sql

    def test_estoque_detalhado_valor_negativo_nao_e_truncado(self, relatorio_db):
        """Decisão de negócio: estoque negativo gera valorEstoque negativo."""
        _, cursor = relatorio_db
        RelatorioRepository.get_estoque_detalhado()
        sql = _norm(cursor.execute.call_args.args[0])
        assert '(p.preco * p.estoque) AS valorEstoque' in sql
        assert 'GREATEST' not in sql
