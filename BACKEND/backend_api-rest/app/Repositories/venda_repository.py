from config.database import get_db_connection
from app.Repositories.configuracao_repository import ConfiguracaoRepository


class EstoqueInsuficienteError(Exception):
    """Levantado quando uma venda tentaria deixar o estoque negativo
    e a configuração 'permiteEstoqueNegativo' está desativada."""
    pass


class ClienteNaoConveniadoError(Exception):
    """Levantado quando um pagamento traz idClienteConvenio mas o cliente
    não está habilitado para convênio (ou não existe)."""
    pass


class LimiteConvenioExcedidoError(Exception):
    """Levantado quando um pagamento via convênio ultrapassaria o limite
    de crédito disponível do cliente."""
    pass


class ConvenioPagamentoExistenteError(Exception):
    """Levantado ao tentar cancelar uma venda que já teve seu lançamento
    de convênio quitado — não dá pra apagar um registro de dívida já paga."""
    pass


class VendaRepository:

    @staticmethod
    def get_all(limit=100, offset=0):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT v.*, c.nome as clienteNome, u.nome as vendedorNome
            FROM Venda v
            LEFT JOIN Cliente c ON v.idCliente = c.idCliente
            JOIN Usuario u ON v.idUsuario = u.idUsuario
            ORDER BY v.dataVenda DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))
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

            # Se nenhum cliente foi selecionado no campo geral da venda, mas um
            # pagamento usou convênio, vincula a venda a esse cliente — senão
            # ela fica sem cliente no Histórico/Relatórios mesmo tendo sido
            # paga (total ou parcialmente) por um cliente conveniado específico.
            id_cliente = dados.get('idCliente')
            if not id_cliente:
                for pag in (dados.get('pagamentos') or []):
                    if pag.get('idClienteConvenio'):
                        id_cliente = pag['idClienteConvenio']
                        break

            if data_venda:
                cursor.execute("""
                    INSERT INTO Venda (idCliente, idUsuario, valorTotal, desconto, acrescimo, valorFinal, formaPagamento, observacoes, dataVenda)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    id_cliente,
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
                    id_cliente,
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
                    pagamento_venda_id = cursor.lastrowid

                    id_cliente_convenio = pag.get('idClienteConvenio')
                    if id_cliente_convenio:
                        # Trava a linha do cliente (FOR UPDATE) para checar e usar o
                        # limite de forma atomica, evitando corrida entre vendas
                        # simultaneas do mesmo cliente (mesmo motivo do lock de
                        # estoque acima, aplicado agora ao limite de convenio).
                        cursor.execute(
                            "SELECT convenio, limiteConvenio FROM Cliente WHERE idCliente = %s FOR UPDATE",
                            (id_cliente_convenio,)
                        )
                        cliente = cursor.fetchone()
                        if not cliente or not cliente[0]:
                            raise ClienteNaoConveniadoError(
                                f"Cliente id {id_cliente_convenio} não está habilitado para convênio."
                            )
                        if cliente[1] is None:
                            raise LimiteConvenioExcedidoError(
                                "Cliente não possui limite de convênio configurado."
                            )
                        limite = float(cliente[1])

                        cursor.execute(
                            "SELECT COALESCE(SUM(valor), 0) FROM ConvenioLancamento WHERE idCliente = %s AND status = 'pendente'",
                            (id_cliente_convenio,)
                        )
                        saldo_devedor = float(cursor.fetchone()[0])
                        valor_pagamento = float(pag['valor'])

                        if saldo_devedor + valor_pagamento > limite + 0.009:
                            raise LimiteConvenioExcedidoError(
                                f'Limite de convênio excedido. Saldo devedor: R$ {saldo_devedor:.2f}, '
                                f'limite: R$ {limite:.2f}, tentativa: R$ {valor_pagamento:.2f}.'
                            )

                        cursor.execute("""
                            INSERT INTO ConvenioLancamento (idCliente, idVenda, idPagamentoVenda, valor, status)
                            VALUES (%s, %s, %s, %s, 'pendente')
                        """, (id_cliente_convenio, venda_id, pagamento_venda_id, valor_pagamento))
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

            # Trava os lançamentos de convênio desta venda antes de qualquer
            # outra coisa: se algum já foi quitado, bloqueia o cancelamento
            # inteiro (não dá pra apagar um registro de dívida já paga).
            cursor.execute(
                "SELECT idLancamento, status FROM ConvenioLancamento WHERE idVenda = %s FOR UPDATE",
                (id,)
            )
            lancamentos_convenio = cursor.fetchall()
            if any(l['status'] == 'pago' for l in lancamentos_convenio):
                raise ConvenioPagamentoExistenteError(
                    'Não é possível cancelar: pagamento de convênio já foi registrado para esta venda.'
                )

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

            # Todos os lançamentos restantes aqui são 'pendente' (os 'pago'
            # já teriam disparado o raise acima) — cancelar a venda libera
            # o limite de convênio do cliente.
            if lancamentos_convenio:
                cursor.execute("DELETE FROM ConvenioLancamento WHERE idVenda = %s", (id,))

            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
