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

    @staticmethod
    def update(user_id, nome, tipo, senha=None):
        conn = get_db_connection()
        cursor = conn.cursor()
        if senha:
            hashed = bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor.execute(
                "UPDATE Usuario SET nome=%s, tipo=%s, senha=%s WHERE idUsuario=%s",
                (nome, tipo, hashed, user_id)
            )
        else:
            cursor.execute(
                "UPDATE Usuario SET nome=%s, tipo=%s WHERE idUsuario=%s",
                (nome, tipo, user_id)
            )
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def delete(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE Usuario SET ativo=FALSE WHERE idUsuario=%s", (user_id,))
        conn.commit()
        cursor.close()
        conn.close()
