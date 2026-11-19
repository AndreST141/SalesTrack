import hashlib
from datetime import datetime
from config.database import get_db_connection


class TokenRevogadoRepository:

    @staticmethod
    def hash_token(token: str) -> str:
        """Calcula o hash SHA-256 do token JWT para indexação e busca segura."""
        if not token:
            return ""
        return hashlib.sha256(token.encode('utf-8')).hexdigest()

    @staticmethod
    def revogar(token: str, id_usuario: int = None, exp_timestamp: int = None) -> bool:
        """
        Persiste o token revogado no MySQL.
        Usa o hash SHA-256 para indexação eficiente (VARCHAR 64).
        """
        if not token:
            return False

        token_hash = TokenRevogadoRepository.hash_token(token)

        # Se não fornecido o timestamp de expiração, calcula default (8h a partir de agora)
        if exp_timestamp:
            data_expiracao = datetime.fromtimestamp(exp_timestamp)
        else:
            from datetime import timedelta
            data_expiracao = datetime.now() + timedelta(hours=8)

        conn = None
        try:
            conn = get_db_connection()
            if not conn:
                return False

            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT IGNORE INTO TokenRevogado (tokenHash, idUsuario, dataExpiracao)
                VALUES (%s, %s, %s)
                """,
                (token_hash, id_usuario, data_expiracao)
            )
            conn.commit()
            cursor.close()
            conn.close()
            return True
        except Exception as e:
            if conn:
                try:
                    conn.rollback()
                    conn.close()
                except Exception:
                    pass
            print(f"[AVISO] Falha ao persistir token revogado no banco: {e}")
            return False

    @staticmethod
    def esta_revogado(token: str) -> bool:
        """Verifica se o token consta na tabela de revogação no MySQL."""
        if not token:
            return False

        token_hash = TokenRevogadoRepository.hash_token(token)

        conn = None
        try:
            conn = get_db_connection()
            if not conn:
                return False

            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM TokenRevogado WHERE tokenHash = %s LIMIT 1",
                (token_hash,)
            )
            registro = cursor.fetchone()
            cursor.close()
            conn.close()
            return registro is not None
        except Exception as e:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass
            return False

    @staticmethod
    def limpar_expirados() -> int:
        """
        Remove tokens da blacklist cuja data de expiração já passou.
        Mantém a tabela enxuta e com performance constante.
        """
        conn = None
        try:
            conn = get_db_connection()
            if not conn:
                return 0

            cursor = conn.cursor()
            cursor.execute("DELETE FROM TokenRevogado WHERE dataExpiracao < NOW()")
            removidos = cursor.rowcount
            conn.commit()
            cursor.close()
            conn.close()
            return removidos
        except Exception as e:
            if conn:
                try:
                    conn.rollback()
                    conn.close()
                except Exception:
                    pass
            print(f"[AVISO] Falha ao limpar tokens expirados no banco: {e}")
            return 0
