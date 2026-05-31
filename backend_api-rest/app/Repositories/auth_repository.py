import bcrypt
from config.database import get_db_connection

class AuthRepository:

    @staticmethod
    def find_by_credentials(email, senha):
        conn = get_db_connection()
        if not conn:
            return None
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM Usuario WHERE email = %s AND ativo = TRUE",
            (email,)
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if user:
            # Check if password is a bcrypt hash
            if user['senha'].startswith('$2b$'):
                if bcrypt.checkpw(senha.encode('utf-8'), user['senha'].encode('utf-8')):
                    return user
            else:
                # Fallback to plain text comparison for older records
                if user['senha'] == senha:
                    return user

        return None
