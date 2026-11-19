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
    def find_by_codigo_barras(codigo_barras, excluir_id=None):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        if excluir_id:
            cursor.execute(
                "SELECT idProduto FROM Produto WHERE codigoBarras = %s AND idProduto != %s",
                (codigo_barras, excluir_id)
            )
        else:
            cursor.execute("SELECT idProduto FROM Produto WHERE codigoBarras = %s", (codigo_barras,))
        produto = cursor.fetchone()
        cursor.close()
        conn.close()
        return produto

    @staticmethod
    def create(dados):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO Produto (nome, descricaoResumida, preco, precoCusto, margemLucro, unidadeMedida, estoque, estoqueMinimo, idCategoria, codigoBarras)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            dados['nome'],
            dados.get('descricaoResumida') or None,
            dados['preco'],
            dados.get('precoCusto') or None,
            dados.get('margemLucro') or None,
            dados.get('unidadeMedida') or 'UN',
            dados.get('estoque', 0),
            dados.get('estoqueMinimo', 10),
            dados.get('idCategoria'),
            dados.get('codigoBarras')
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
            SET nome = %s, descricaoResumida = %s, preco = %s, precoCusto = %s, margemLucro = %s,
                unidadeMedida = %s, estoque = %s, estoqueMinimo = %s, idCategoria = %s, codigoBarras = %s
            WHERE idProduto = %s
        """, (
            dados['nome'],
            dados.get('descricaoResumida') or None,
            dados['preco'],
            dados.get('precoCusto') or None,
            dados.get('margemLucro') or None,
            dados.get('unidadeMedida') or 'UN',
            dados.get('estoque', 0),
            dados.get('estoqueMinimo', 10),
            dados.get('idCategoria'),
            dados.get('codigoBarras'),
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
