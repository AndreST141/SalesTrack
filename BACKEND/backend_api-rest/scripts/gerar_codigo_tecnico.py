import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pyotp
from dotenv import load_dotenv

load_dotenv()

EMISSOR = "SalesTrack"
CONTA = "Tecnico"


def formatar_em_grupos(texto, tamanho=4):
    return ' '.join(texto[i:i + tamanho] for i in range(0, len(texto), tamanho))


def main():
    secret = os.getenv('TECNICO_SECRET', '')
    if not secret:
        print("ERRO: variavel de ambiente TECNICO_SECRET nao configurada (verifique o .env).")
        sys.exit(1)

    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=CONTA, issuer_name=EMISSOR)

    print("=" * 60)
    print("CADASTRO NO APP AUTENTICADOR (fazer uma unica vez)")
    print("=" * 60)
    print("Abra Google Authenticator / Authy / 1Password / Microsoft")
    print("Authenticator, escolha 'Adicionar conta' -> 'Inserir chave")
    print("manualmente' e preencha:")
    print()
    print(f"  Nome da conta : {EMISSOR} {CONTA}")
    print(f"  Chave (base32): {formatar_em_grupos(secret)}")
    print(f"  Tipo          : Baseado em tempo (TOTP)")
    print()
    print("Ou use esta URI (para geradores de QR code):")
    print(f"  {uri}")
    print()
    print("Depois do cadastro, o app mostra sozinho o codigo de 6 digitos")
    print("valido no momento -- nao precisa mais rodar este script no dia a dia.")
    print("=" * 60)
    print(f"Codigo valido agora (login: TECNICO): {totp.now()}")


if __name__ == '__main__':
    main()
