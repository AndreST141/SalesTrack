import bcrypt
from datetime import datetime
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

        if not user:
            return None

        # TECNICO usa senha dinâmica baseada na data atual (YYYYMMDD)
        if user.get('tipo') == 'tecnico':
            expected = datetime.now().strftime('%Y%m%d')
            return user if senha == expected else None

        # Senha bcrypt
        if user['senha'].startswith('$2b$'):
            if bcrypt.checkpw(senha.encode('utf-8'), user['senha'].encode('utf-8')):
                return user
        else:
            # Fallback texto puro para registros antigos
            if user['senha'] == senha:
                return user

        return None

    @staticmethod
    def find_admin_by_credentials(email, senha):
        """Verifica se as credenciais pertencem a um usuário admin/tecnico ativo."""
        conn = get_db_connection()
        if not conn:
            return None
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM Usuario WHERE email = %s AND ativo = TRUE AND tipo IN ('admin', 'tecnico')",
            (email,)
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if not user:
            return None

        if user.get('tipo') == 'tecnico':
            expected = datetime.now().strftime('%Y%m%d')
            return user if senha == expected else None

        if user['senha'].startswith('$2b$'):
            if bcrypt.checkpw(senha.encode('utf-8'), user['senha'].encode('utf-8')):
                return user
        else:
            if user['senha'] == senha:
                return user

        return None

    @staticmethod
    def verify_admin_or_supervisor_password(senha):
        """Verifica se a senha pertence a algum admin, supervisor ou tecnico ativo."""
        conn = get_db_connection()
        if not conn:
            return None
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM Usuario WHERE ativo = TRUE AND tipo IN ('admin', 'supervisor', 'tecnico')"
        )
        users = cursor.fetchall()
        cursor.close()
        conn.close()

        for user in users:
            # TECNICO usa senha dinâmica baseada na data atual (YYYYMMDD)
            if user.get('tipo') == 'tecnico':
                expected = datetime.now().strftime('%Y%m%d')
                if senha == expected:
                    return user
                continue

            if user['senha'].startswith('$2b$'):
                try:
                    if bcrypt.checkpw(senha.encode('utf-8'), user['senha'].encode('utf-8')):
                        return user
                except Exception:
                    continue
            else:
                if user['senha'] == senha:
                    return user

        return None
