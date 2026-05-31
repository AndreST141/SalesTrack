from config.database import get_db_connection

class ProdutoRepository:

    @staticmethod
    def get_all(incluir_inativos=False):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        where_clause = "" if incluir_inativos else "WHERE p.ativo = TRUE"
        cursor.execute(f"""
            SELECT p.*, c.nome as categoriaNome
            FROM Produto p
            LEFT JOIN Categoria c ON p.idCategoria = c.idCategoria
            {where_clause}
            ORDER BY p.nome
        """)
        produtos = cursor.fetchall()
        cursor.close()
        conn.close()
        return produtos

    @staticmethod
    def create(dados):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO Produto (nome, descricao, preco, estoque, idCategoria)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            dados['nome'],
            dados.get('descricao', ''),
            dados['preco'],
            dados.get('estoque', 0),
            dados.get('idCategoria')
        ))
        conn.commit()
        produto_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return produto_id

    @staticmethod
    def update(id, dados):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE Produto
            SET nome = %s, descricao = %s, preco = %s, estoque = %s, idCategoria = %s
            WHERE idProduto = %s
        """, (
            dados['nome'],
            dados.get('descricao', ''),
            dados['preco'],
            dados.get('estoque', 0),
            dados.get('idCategoria'),
            id
        ))
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def soft_delete(id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE Produto SET ativo = FALSE WHERE idProduto = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def reactivate(id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE Produto SET ativo = TRUE WHERE idProduto = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
