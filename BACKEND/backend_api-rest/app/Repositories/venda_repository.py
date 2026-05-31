from config.database import get_db_connection

class VendaRepository:

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT v.*, c.nome as clienteNome, u.nome as vendedorNome
            FROM Venda v
            LEFT JOIN Cliente c ON v.idCliente = c.idCliente
            JOIN Usuario u ON v.idUsuario = u.idUsuario
            ORDER BY v.dataVenda DESC
            LIMIT 100
        """)
        vendas = cursor.fetchall()

        # Buscar pagamentos de todas as vendas retornadas
        if vendas:
            venda_ids = [v['idVenda'] for v in vendas]
            placeholders = ','.join(['%s'] * len(venda_ids))
            cursor.execute(f"""
                SELECT idVenda, formaPagamento, valor
                FROM PagamentoVenda
                WHERE idVenda IN ({placeholders})
                ORDER BY idPagamento
            """, tuple(venda_ids))
            pagamentos = cursor.fetchall()

            # Agrupar pagamentos por idVenda
            pagamentos_por_venda = {}
            for p in pagamentos:
                vid = p['idVenda']
                if vid not in pagamentos_por_venda:
                    pagamentos_por_venda[vid] = []
                pagamentos_por_venda[vid].append({
                    'formaPagamento': p['formaPagamento'],
                    'valor': p['valor']
                })

            # Adicionar pagamentos a cada venda
            for v in vendas:
                v['pagamentos'] = pagamentos_por_venda.get(v['idVenda'], [])

        cursor.close()
        conn.close()
        return vendas

    @staticmethod
    def find_with_itens(id):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT v.*, c.nome as clienteNome, u.nome as vendedorNome
            FROM Venda v
            LEFT JOIN Cliente c ON v.idCliente = c.idCliente
            JOIN Usuario u ON v.idUsuario = u.idUsuario
            WHERE v.idVenda = %s
        """, (id,))
        venda = cursor.fetchone()

        if not venda:
            cursor.close()
            conn.close()
            return None

        # Buscar itens da venda
        cursor.execute("""
            SELECT iv.*, p.nome as produtoNome
            FROM ItemVenda iv
            JOIN Produto p ON iv.idProduto = p.idProduto
            WHERE iv.idVenda = %s
        """, (id,))
        venda['itens'] = cursor.fetchall()

        # Buscar pagamentos da venda
        cursor.execute("""
            SELECT formaPagamento, valor
            FROM PagamentoVenda
            WHERE idVenda = %s
            ORDER BY idPagamento
        """, (id,))
        venda['pagamentos'] = cursor.fetchall()

        cursor.close()
        conn.close()
        return venda

    @staticmethod
    def create(dados, usuario_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO Venda (idCliente, idUsuario, valorTotal, desconto, valorFinal, formaPagamento, observacoes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                dados.get('idCliente'),
                usuario_id,
                dados['valorTotal'],
                dados.get('desconto', 0),
                dados['valorFinal'],
                dados['formaPagamento'],
                dados.get('observacoes', '')
            ))
            venda_id = cursor.lastrowid

            # Inserir itens da venda
            for item in dados['itens']:
                cursor.execute("""
                    INSERT INTO ItemVenda (idVenda, idProduto, quantidade, precoUnitario, subtotal)
                    VALUES (%s, %s, %s, %s, %s)
                """, (venda_id, item['idProduto'], item['quantidade'], item['precoUnitario'], item['subtotal']))

                cursor.execute("""
                    UPDATE Produto SET estoque = estoque - %s WHERE idProduto = %s
                """, (item['quantidade'], item['idProduto']))

            # Inserir pagamentos na tabela PagamentoVenda
            pagamentos = dados.get('pagamentos', [])
            if pagamentos:
                for pag in pagamentos:
                    cursor.execute("""
                        INSERT INTO PagamentoVenda (idVenda, formaPagamento, valor)
                        VALUES (%s, %s, %s)
                    """, (venda_id, pag['forma'], pag['valor']))
            else:
                # Fallback: se não veio array de pagamentos, salva a forma única
                cursor.execute("""
                    INSERT INTO PagamentoVenda (idVenda, formaPagamento, valor)
                    VALUES (%s, %s, %s)
                """, (venda_id, dados['formaPagamento'], dados['valorFinal']))

            conn.commit()
            cursor.close()
            conn.close()
            return venda_id
        except Exception as e:
            conn.rollback()
            cursor.close()
            conn.close()
            raise e
