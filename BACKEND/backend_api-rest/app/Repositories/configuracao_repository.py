from config.database import get_db_connection


class ConfiguracaoRepository:

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT chave, valor FROM Configuracao")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return {r['chave']: r['valor'] for r in rows}

    @staticmethod
    def get(chave, default=None):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT valor FROM Configuracao WHERE chave = %s", (chave,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        return row['valor'] if row else default

    @staticmethod
    def get_bool(chave, default=False):
        valor = ConfiguracaoRepository.get(chave)
        if valor is None:
            return default
        return str(valor).lower() in ('true', '1')

    @staticmethod
    def set(chave, valor):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO Configuracao (chave, valor) VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE valor = VALUES(valor)
        """, (chave, str(valor)))
        conn.commit()
        cursor.close()
        conn.close()
