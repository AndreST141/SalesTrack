import bcrypt
from config.database import get_db_connection

class UserRepository:

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT idUsuario, nome, email, tipo, ativo FROM Usuario "
            "WHERE tipo != 'tecnico' ORDER BY nome"
        )
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        return users

    @staticmethod
    def find_by_email(email):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT idUsuario FROM Usuario WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        return user

    @staticmethod
    def create(nome, email, senha, tipo):
        conn = get_db_connection()
        cursor = conn.cursor()
        hashed = bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor.execute(
            "INSERT INTO Usuario (nome, email, senha, tipo) VALUES (%s, %s, %s, %s)",
            (nome, email, hashed, tipo)
        )
        conn.commit()
        user_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return user_id
