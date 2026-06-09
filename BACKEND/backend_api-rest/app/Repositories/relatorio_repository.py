from config.database import get_db_connection


class RelatorioRepository:

    @staticmethod
    def get_vendas_periodo(data_inicio, data_fim):
        """Todas as vendas no intervalo, sem LIMIT, com pagamentos."""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT v.*, c.nome AS clienteNome, u.nome AS vendedorNome
            FROM Venda v
            LEFT JOIN Cliente c ON v.idCliente = c.idCliente
            JOIN  Usuario u ON v.idUsuario = u.idUsuario
            WHERE DATE(v.dataVenda) BETWEEN %s AND %s
            ORDER BY v.dataVenda DESC
        """, (data_inicio, data_fim))
        vendas = cursor.fetchall()

        if vendas:
            ids = [v['idVenda'] for v in vendas]
            ph  = ','.join(['%s'] * len(ids))
            cursor.execute(f"""
                SELECT idVenda, formaPagamento, valor
                FROM PagamentoVenda WHERE idVenda IN ({ph})
                ORDER BY idPagamento
            """, tuple(ids))
            pag_map = {}
            for p in cursor.fetchall():
                pag_map.setdefault(p['idVenda'], []).append(
                    {'formaPagamento': p['formaPagamento'], 'valor': p['valor']}
                )
            for v in vendas:
                v['pagamentos'] = pag_map.get(v['idVenda'], [])

        cursor.close()
        conn.close()
        return vendas

    @staticmethod
    def get_produtos_mais_vendidos(data_inicio, data_fim, limite=100):
        """Ranking de produtos por quantidade vendida no período (usa ItemVenda)."""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.idProduto, p.nome, c.nome AS categoria,
                   SUM(iv.quantidade)    AS totalVendido,
                   SUM(iv.subtotal)      AS receitaTotal,
                   AVG(iv.precoUnitario) AS precoMedio
            FROM ItemVenda iv
            JOIN Produto  p ON iv.idProduto = p.idProduto
            LEFT JOIN Categoria c ON p.idCategoria = c.idCategoria
            JOIN Venda    v ON iv.idVenda = v.idVenda
            WHERE v.status = 'concluida'
              AND DATE(v.dataVenda) BETWEEN %s AND %s
            GROUP BY p.idProduto, p.nome, c.nome
            ORDER BY totalVendido DESC
            LIMIT %s
        """, (data_inicio, data_fim, limite))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return rows

    @staticmethod
    def get_produtos_sem_movimento(data_inicio, data_fim):
        """Produtos ativos sem nenhuma venda concluída no período informado."""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.idProduto, p.nome, c.nome AS categoria,
                   p.preco, p.estoque,
                   (p.preco * GREATEST(p.estoque, 0)) AS valorEstoque,
                   p.dataCadastro
            FROM Produto p
            LEFT JOIN Categoria c ON p.idCategoria = c.idCategoria
            WHERE p.ativo = TRUE
              AND p.idProduto NOT IN (
                    SELECT DISTINCT iv.idProduto
                    FROM ItemVenda iv
                    JOIN Venda v ON iv.idVenda = v.idVenda
                    WHERE v.status = 'concluida'
                      AND DATE(v.dataVenda) BETWEEN %s AND %s
              )
            ORDER BY valorEstoque DESC
        """, (data_inicio, data_fim))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return rows

    @staticmethod
    def get_estoque_detalhado():
        """Todos os produtos (ativos e inativos) com última venda e total vendido."""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.idProduto, p.nome, c.nome AS categoria,
                   p.descricao, p.preco, p.estoque, p.ativo,
                   (p.preco * p.estoque)              AS valorEstoque,
                   MAX(v.dataVenda)                   AS ultimaVenda,
                   COALESCE(SUM(iv.quantidade), 0)    AS totalVendido,
                   COALESCE(SUM(iv.subtotal),   0)    AS receitaTotal
            FROM Produto p
            LEFT JOIN Categoria  c  ON p.idCategoria  = c.idCategoria
            LEFT JOIN ItemVenda  iv ON iv.idProduto   = p.idProduto
            LEFT JOIN Venda      v  ON iv.idVenda     = v.idVenda
                                   AND v.status = 'concluida'
            GROUP BY p.idProduto, p.nome, c.nome, p.descricao,
                     p.preco, p.estoque, p.ativo
            ORDER BY p.nome
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return rows
