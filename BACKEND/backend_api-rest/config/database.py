import os
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error

load_dotenv()

DB_CONFIG = {
    'host':     os.getenv('DB_HOST', 'localhost'),
    'user':     os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'salestrack'),
    'charset':  os.getenv('DB_CHARSET', 'utf8mb4'),
    'collation': 'utf8mb4_unicode_ci',
    'use_unicode': True
}

def get_db_connection():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SET NAMES utf8mb4")
        cursor.execute("SET CHARACTER SET utf8mb4")
        cursor.execute("SET character_set_connection=utf8mb4")
        cursor.execute("SET collation_connection=utf8mb4_unicode_ci")
        cursor.close()
        return conn
    except Error as e:
        print(f"Erro ao conectar ao banco: {e}")
        raise e

