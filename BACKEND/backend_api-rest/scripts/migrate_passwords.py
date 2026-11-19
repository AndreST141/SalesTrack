"""
Script de migração: converte senhas em texto plano para bcrypt.
Execute UMA VEZ no banco de dados de produção após o deploy da correção de segurança.
Uso: python scripts/migrate_passwords.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from config.database import get_db_connection


def migrar_senhas():
    conn = get_db_connection()
    if not conn:
        print("[ERRO] Não foi possível conectar ao banco de dados.")
        return

    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT idUsuario, nome, email, senha, tipo FROM Usuario WHERE ativo = TRUE")
    usuarios = cursor.fetchall()

    migrados = 0
    ja_hash = 0
    pulados = 0

    for usuario in usuarios:
        senha = usuario['senha']

        # Pular usuário técnico (usa TOTP, não bcrypt)
        if usuario.get('tipo') == 'tecnico':
            pulados += 1
            continue

        # Já está em bcrypt
        if senha and senha.startswith('$2b$'):
            ja_hash += 1
            continue

        # Texto plano — migrar
        novo_hash = bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor.execute(
            "UPDATE Usuario SET senha = %s WHERE idUsuario = %s",
            (novo_hash, usuario['idUsuario'])
        )
        conn.commit()
        migrados += 1
        print(f"[OK] Migrado: {usuario['email']} (id={usuario['idUsuario']})")

    cursor.close()
    conn.close()

    print(f"\n=== Migração concluída ===")
    print(f"  Migrados para bcrypt : {migrados}")
    print(f"  Já em bcrypt         : {ja_hash}")
    print(f"  Pulados (tecnico)    : {pulados}")
    print(f"  Total processados    : {len(usuarios)}")


if __name__ == '__main__':
    migrar_senhas()
