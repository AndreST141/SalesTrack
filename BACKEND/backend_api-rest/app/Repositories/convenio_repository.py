from config.database import get_db_connection


class LancamentoInvalidoError(Exception):
    """Levantado quando um ou mais lançamentos não pertencem ao cliente
    informado ou já não estão mais pendentes."""
    pass


class ConvenioRepository:

    @staticmethod
    def get_by_cliente(id_cliente):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT idCliente, nome, cpf, convenio, limiteConvenio FROM Cliente WHERE idCliente = %s",
            (id_cliente,)
        )
        cliente = cursor.fetchone()
        if not cliente:
            cursor.close()
            conn.close()
            return None

        cursor.execute("""
            SELECT cl.idLancamento, cl.idVenda, cl.valor, cl.status, cl.dataLancamento,
                   cp.dataPagamento
            FROM ConvenioLancamento cl
            LEFT JOIN ConvenioPagamento cp ON cp.idPagamento = cl.idPagamento
            WHERE cl.idCliente = %s
            ORDER BY cl.dataLancamento DESC
        """, (id_cliente,))
        lancamentos = cursor.fetchall()
        cursor.close()
        conn.close()

        saldo_devedor = sum(float(l['valor']) for l in lancamentos if l['status'] == 'pendente')
        return {
            'idCliente': cliente['idCliente'],
            'nome': cliente['nome'],
            'cpf': cliente['cpf'],
            'convenio': bool(cliente['convenio']),
            'limiteConvenio': float(cliente['limiteConvenio']) if cliente['limiteConvenio'] is not None else None,
            'saldoDevedor': saldo_devedor,
            'lancamentos': lancamentos,
        }

    @staticmethod
    def pagar(id_cliente, ids_lancamentos, forma_pagamento, observacao, id_usuario):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT nome, cpf FROM Cliente WHERE idCliente = %s",
                (id_cliente,)
            )
            cliente = cursor.fetchone()

            placeholders = ','.join(['%s'] * len(ids_lancamentos))
            cursor.execute(f"""
                SELECT idLancamento, idVenda, valor, status FROM ConvenioLancamento
                WHERE idLancamento IN ({placeholders}) AND idCliente = %s
                FOR UPDATE
            """, (*ids_lancamentos, id_cliente))
            lancamentos = cursor.fetchall()

            if len(lancamentos) != len(ids_lancamentos) or any(l['status'] != 'pendente' for l in lancamentos):
                raise LancamentoInvalidoError(
                    'Um ou mais lançamentos não pertencem a este cliente ou já foram pagos.'
                )

            valor_total = sum(float(l['valor']) for l in lancamentos)

            cursor.execute("""
                INSERT INTO ConvenioPagamento (idCliente, valorTotal, formaPagamento, observacao, idUsuario)
                VALUES (%s, %s, %s, %s, %s)
            """, (id_cliente, valor_total, forma_pagamento, observacao, id_usuario))
            id_pagamento = cursor.lastrowid

            cursor.execute(f"""
                UPDATE ConvenioLancamento SET status = 'pago', idPagamento = %s
                WHERE idLancamento IN ({placeholders})
            """, (id_pagamento, *ids_lancamentos))

            conn.commit()

            return {
                'idPagamento': id_pagamento,
                'cliente': cliente,
                'valorTotal': valor_total,
                'formaPagamento': forma_pagamento,
                'observacao': observacao,
                'lancamentos': lancamentos,
            }
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
