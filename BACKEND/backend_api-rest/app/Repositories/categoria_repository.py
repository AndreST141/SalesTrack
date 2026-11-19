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

    @staticmethod
    def find_by_nome(nome):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM Categoria WHERE nome = %s", (nome,))
        categoria = cursor.fetchone()
        cursor.close()
        conn.close()
        return categoria

    @staticmethod
    def create(nome, descricao=''):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO Categoria (nome, descricao) VALUES (%s, %s)",
            (nome, descricao or '')
        )
        conn.commit()
        categoria_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return categoria_id

    @staticmethod
    def find_by_id(id):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM Categoria WHERE idCategoria = %s", (id,))
        categoria = cursor.fetchone()
        cursor.close()
        conn.close()
        return categoria

    @staticmethod
    def contar_produtos_vinculados(id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM Produto WHERE idCategoria = %s AND ativo = TRUE",
            (id,)
        )
        total = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return total

    @staticmethod
    def delete(id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Categoria WHERE idCategoria = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()


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
            FROM Produto WHERE estoque < estoqueMinimo AND ativo = TRUE
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
    def get_produtos_mais_vendidos(limite, periodo):
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
              AND v.dataVenda >= DATE_SUB(NOW(), INTERVAL %s DAY)
            GROUP BY p.idProduto, p.nome, c.nome
            ORDER BY totalVendido DESC
            LIMIT %s
        """, (periodo, limite))
        produtos = cursor.fetchall()
        cursor.close()
        conn.close()
        return produtos
