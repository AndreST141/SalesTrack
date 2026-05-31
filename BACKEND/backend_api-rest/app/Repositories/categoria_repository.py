from config.database import get_db_connection

class CategoriaRepository:

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM Categoria ORDER BY nome")
        categorias = cursor.fetchall()
        cursor.close()
        conn.close()
        return categorias


class DashboardRepository:
    """Responsável apenas pelas queries do Dashboard no banco."""

    @staticmethod
    def get_kpis(periodo):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT
                COUNT(*) as totalVendas,
                COALESCE(SUM(valorFinal), 0) as receitaTotal,
                COALESCE(AVG(valorFinal), 0) as ticketMedio
            FROM Venda
            WHERE dataVenda >= DATE_SUB(NOW(), INTERVAL %s DAY)
            AND status = 'concluida'
        """, (periodo,))
        kpis = cursor.fetchone()

        cursor.execute("""
            SELECT COUNT(*) as produtosBaixoEstoque
            FROM Produto WHERE estoque < 10 AND ativo = TRUE
        """)
        estoque = cursor.fetchone()
        cursor.close()
        conn.close()
        return kpis, estoque

    @staticmethod
    def get_vendas_por_periodo(dias):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT DATE(dataVenda) as data, COUNT(*) as quantidade, SUM(valorFinal) as receita
            FROM Venda
            WHERE dataVenda >= DATE_SUB(NOW(), INTERVAL %s DAY) AND status = 'concluida'
            GROUP BY DATE(dataVenda)
            ORDER BY data
        """, (dias,))
        vendas = cursor.fetchall()
        cursor.close()
        conn.close()
        return vendas

    @staticmethod
    def get_produtos_mais_vendidos(limite):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.nome, c.nome as categoria,
                SUM(iv.quantidade) as totalVendido, SUM(iv.subtotal) as receitaTotal
            FROM ItemVenda iv
            JOIN Produto p ON iv.idProduto = p.idProduto
            LEFT JOIN Categoria c ON p.idCategoria = c.idCategoria
            JOIN Venda v ON iv.idVenda = v.idVenda
            WHERE v.status = 'concluida'
            GROUP BY p.idProduto, p.nome, c.nome
            ORDER BY totalVendido DESC
            LIMIT %s
        """, (limite,))
        produtos = cursor.fetchall()
        cursor.close()
        conn.close()
        return produtos
