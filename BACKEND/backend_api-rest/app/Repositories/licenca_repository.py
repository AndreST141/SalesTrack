from config.database import get_db_connection


class LicencaRepository:

    @staticmethod
    def get():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM Licenca ORDER BY idLicenca DESC LIMIT 1")
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        return row

    @staticmethod
    def upsert(dados):
        atual = LicencaRepository.get()
        conn = get_db_connection()
        cursor = conn.cursor()
        if atual:
            cursor.execute("""
                UPDATE Licenca
                SET cnpj = %s, razaoSocial = %s, identificador = %s, status = %s,
                    dataInicio = %s, dataVencimento = %s, observacoes = %s
                WHERE idLicenca = %s
            """, (
                dados.get('cnpj', atual['cnpj']),
                dados.get('razaoSocial', atual['razaoSocial']),
                dados.get('identificador', atual['identificador']),
                dados.get('status', atual['status']),
                dados.get('dataInicio', atual['dataInicio']),
                dados.get('dataVencimento', atual['dataVencimento']),
                dados.get('observacoes', atual['observacoes']),
                atual['idLicenca'],
            ))
        else:
            cursor.execute("""
                INSERT INTO Licenca (cnpj, razaoSocial, identificador, status, dataInicio, dataVencimento, observacoes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                dados.get('cnpj', ''),
                dados.get('razaoSocial', ''),
                dados.get('identificador', ''),
                dados.get('status', 'ativa'),
                dados.get('dataInicio'),
                dados.get('dataVencimento'),
                dados.get('observacoes', ''),
            ))
        conn.commit()
        cursor.close()
        conn.close()
