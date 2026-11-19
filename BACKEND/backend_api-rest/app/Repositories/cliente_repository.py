from config.database import get_db_connection

class ClienteRepository:

    @staticmethod
    def get_all(incluir_inativos=False):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        where_clause = "" if incluir_inativos else "WHERE ativo = TRUE"
        cursor.execute(f"""
            SELECT c.*,
                   COALESCE((
                       SELECT SUM(cl.valor) FROM ConvenioLancamento cl
                       WHERE cl.idCliente = c.idCliente AND cl.status = 'pendente'
                   ), 0) AS saldoDevedor
            FROM Cliente c
            {where_clause}
            ORDER BY c.nome
        """)
        clientes = cursor.fetchall()
        cursor.close()
        conn.close()
        return clientes

    @staticmethod
    def get_saldo_convenio(id):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT convenio, limiteConvenio FROM Cliente WHERE idCliente = %s", (id,))
        cliente = cursor.fetchone()
        if not cliente:
            cursor.close()
            conn.close()
            return None
        cursor.execute(
            "SELECT COALESCE(SUM(valor), 0) AS saldoDevedor FROM ConvenioLancamento WHERE idCliente = %s AND status = 'pendente'",
            (id,)
        )
        saldo = cursor.fetchone()
        cursor.close()
        conn.close()
        return {
            'convenio': bool(cliente['convenio']),
            'limiteConvenio': float(cliente['limiteConvenio']) if cliente['limiteConvenio'] is not None else None,
            'saldoDevedor': float(saldo['saldoDevedor']),
        }

    @staticmethod
    def find_by_cpf(cpf, excluir_id=None):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        if excluir_id:
            cursor.execute(
                "SELECT idCliente FROM Cliente WHERE cpf = %s AND idCliente != %s",
                (cpf, excluir_id)
            )
        else:
            cursor.execute("SELECT idCliente FROM Cliente WHERE cpf = %s", (cpf,))
        cliente = cursor.fetchone()
        cursor.close()
        conn.close()
        return cliente

    @staticmethod
    def create(dados):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO Cliente (nome, cpf, telefone, email, endereco, observacoes, convenio, limiteConvenio)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            dados['nome'],
            dados.get('cpf'),
            dados.get('telefone'),
            dados.get('email'),
            dados.get('endereco'),
            dados.get('observacoes'),
            bool(dados.get('convenio', False)),
            dados.get('limiteConvenio') if dados.get('convenio') else None,
        ))
        conn.commit()
        cliente_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return cliente_id

    @staticmethod
    def update(id, dados):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE Cliente
            SET nome = %s, cpf = %s, telefone = %s, email = %s,
                endereco = %s, observacoes = %s, convenio = %s, limiteConvenio = %s
            WHERE idCliente = %s
        """, (
            dados['nome'],
            dados.get('cpf'),
            dados.get('telefone'),
            dados.get('email'),
            dados.get('endereco'),
            dados.get('observacoes'),
            bool(dados.get('convenio', False)),
            dados.get('limiteConvenio') if dados.get('convenio') else None,
            id,
        ))
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def reactivate(id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE Cliente SET ativo = TRUE WHERE idCliente = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def soft_delete(id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE Cliente SET ativo = FALSE WHERE idCliente = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
