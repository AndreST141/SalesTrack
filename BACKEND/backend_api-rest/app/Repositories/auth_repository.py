import os
import pyotp
import bcrypt
from config.database import get_db_connection


def senha_tecnico_valida(senha):
    """
    Senha do usuário TECNICO = código TOTP padrão (RFC 6238), o mesmo esquema
    do Google Authenticator/Authy. O segredo (TECNICO_SECRET, em base32) é
    cadastrado uma única vez num app autenticador — veja
    scripts/gerar_codigo_tecnico.py para o passo a passo de cadastro.
    valid_window=1 tolera ±30s de diferença de relógio/digitação.
    """
    if not senha:
        return False
    secret = os.getenv('TECNICO_SECRET', '')
    if not secret:
        return False
    return pyotp.TOTP(secret).verify(senha, valid_window=1)


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

        # TECNICO usa código dinâmico diário derivado de TECNICO_SECRET
        if user.get('tipo') == 'tecnico':
            return user if senha_tecnico_valida(senha) else None

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
            return user if senha_tecnico_valida(senha) else None

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
            # TECNICO usa código dinâmico diário derivado de TECNICO_SECRET
            if user.get('tipo') == 'tecnico':
                if senha_tecnico_valida(senha):
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
