from config.database import get_db_connection
from app.Repositories.configuracao_repository import ConfiguracaoRepository


class EstoqueInsuficienteError(Exception):
    """Levantado quando uma venda tentaria deixar o estoque negativo
    e a configuração 'permiteEstoqueNegativo' está desativada."""
    pass


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
        permite_negativo = ConfiguracaoRepository.get_bool('permiteEstoqueNegativo', False)

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            data_venda = dados.get('dataVenda')
            acrescimo = dados.get('acrescimo', 0) or 0
            if data_venda:
                cursor.execute("""
                    INSERT INTO Venda (idCliente, idUsuario, valorTotal, desconto, acrescimo, valorFinal, formaPagamento, observacoes, dataVenda)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    dados.get('idCliente'),
                    usuario_id,
                    dados['valorTotal'],
                    dados.get('desconto', 0),
                    acrescimo,
                    dados['valorFinal'],
                    dados['formaPagamento'],
                    dados.get('observacoes', ''),
                    data_venda
                ))
            else:
                cursor.execute("""
                    INSERT INTO Venda (idCliente, idUsuario, valorTotal, desconto, acrescimo, valorFinal, formaPagamento, observacoes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    dados.get('idCliente'),
                    usuario_id,
                    dados['valorTotal'],
                    dados.get('desconto', 0),
                    acrescimo,
                    dados['valorFinal'],
                    dados['formaPagamento'],
                    dados.get('observacoes', '')
                ))
            venda_id = cursor.lastrowid

            # Inserir itens da venda
            for item in dados['itens']:
                # Trava a linha do produto (FOR UPDATE) para checar e decrementar o
                # estoque de forma atomica, evitando corrida entre vendas simultaneas
                # do mesmo produto.
                cursor.execute(
                    "SELECT nome, estoque FROM Produto WHERE idProduto = %s FOR UPDATE",
                    (item['idProduto'],)
                )
                produto = cursor.fetchone()
                if produto is None:
                    raise EstoqueInsuficienteError(f"Produto id {item['idProduto']} não encontrado.")

                nome_produto, estoque_atual = produto
                novo_estoque = estoque_atual - item['quantidade']

                if not permite_negativo and novo_estoque < 0:
                    raise EstoqueInsuficienteError(
                        f'Estoque insuficiente para "{nome_produto}" '
                        f"(disponível: {estoque_atual}, solicitado: {item['quantidade']})."
                    )

                cursor.execute("""
                    INSERT INTO ItemVenda (idVenda, idProduto, quantidade, precoUnitario, subtotal)
                    VALUES (%s, %s, %s, %s, %s)
                """, (venda_id, item['idProduto'], item['quantidade'], item['precoUnitario'], item['subtotal']))

                cursor.execute(
                    "UPDATE Produto SET estoque = %s WHERE idProduto = %s",
                    (novo_estoque, item['idProduto'])
                )

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

    @staticmethod
    def cancel(id, cancelado_por=None, autorizado_por=None):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT idVenda, status FROM Venda WHERE idVenda = %s", (id,))
            venda = cursor.fetchone()
            if not venda:
                return None
            if venda['status'] == 'cancelada':
                return 'already_cancelled'

            cursor.execute(
                "SELECT idProduto, quantidade FROM ItemVenda WHERE idVenda = %s", (id,)
            )
            itens = cursor.fetchall()

            for item in itens:
                cursor.execute(
                    "UPDATE Produto SET estoque = estoque + %s WHERE idProduto = %s",
                    (item['quantidade'], item['idProduto'])
                )

            cursor.execute(
                "UPDATE Venda SET status = 'cancelada', canceladoPor = %s, autorizadoPor = %s WHERE idVenda = %s",
                (cancelado_por, autorizado_por, id)
            )
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
