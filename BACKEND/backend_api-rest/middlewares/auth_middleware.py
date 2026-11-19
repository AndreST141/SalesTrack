import os
import jwt
from flask import request, jsonify
from functools import wraps
from app.Constants.geral import Geral
from app.Repositories.token_revogado_repository import TokenRevogadoRepository

JWT_SECRET = os.getenv('JWT_SECRET', '')
if len(JWT_SECRET.encode('utf-8')) < 32:
    raise RuntimeError('JWT_SECRET must be configured with at least 32 bytes.')
JWT_ALGORITHM = 'HS256'

# Cache em memória para latência reduzida nas requisições frequentes.
# A autoridade de persistência é a tabela TokenRevogado no MySQL.
_revoked_tokens: set = set()


def generate_token(user_data: dict, expires_in_hours: int = 8) -> str:
    """Gera um JWT assinado com expiração padrão de 8 horas."""
    import time
    payload = {
        'id':    user_data['id'],
        'nome':  user_data['nome'],
        'email': user_data['email'],
        'tipo':  user_data['tipo'],
        'exp':   int(time.time()) + expires_in_hours * 3600,
        'iat':   int(time.time()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def revoke_token(token: str, id_usuario: int = None, exp: int = None) -> None:
    """
    Invalida um token permanentemente.
    Registra no cache local e persiste no MySQL para consistência cross-restart
    e compatibilidade com múltiplas instâncias da aplicação.
    """
    if not token:
        return

    _revoked_tokens.add(token)

    # Extrai dados do payload caso id_usuario ou exp não tenham sido informados
    if id_usuario is None or exp is None:
        try:
            unverified_payload = jwt.decode(
                token,
                options={"verify_signature": False, "verify_exp": False}
            )
            if id_usuario is None:
                id_usuario = unverified_payload.get('id')
            if exp is None:
                exp = unverified_payload.get('exp')
        except Exception:
            pass

    TokenRevogadoRepository.revogar(token, id_usuario=id_usuario, exp_timestamp=exp)


def is_token_revoked(token: str) -> bool:
    """
    Verifica se o token foi revogado consultando primeiro o cache em memória
    e, em caso negativo, a tabela de persistência no MySQL.
    """
    if not token:
        return True

    # 1. Checagem em memória (O(1))
    if token in _revoked_tokens:
        return True

    # 2. Checagem no banco de dados (persistência cross-restart e multi-instância)
    revogado_no_banco = TokenRevogadoRepository.esta_revogado(token)
    if revogado_no_banco:
        _revoked_tokens.add(token)
        return True

    return False


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return jsonify({'error': Geral.TOKEN_NAO_FORNECIDO}), 401

        token = auth_header[7:] if auth_header.startswith('Bearer ') else auth_header

        # Validação de revogação resiliente (memória + MySQL)
        if is_token_revoked(token):
            return jsonify({'error': Geral.TOKEN_INVALIDO}), 401

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado. Faça login novamente.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': Geral.TOKEN_INVALIDO}), 401

        request.user = {
            'id':    payload['id'],
            'nome':  payload['nome'],
            'email': payload['email'],
            'tipo':  payload['tipo'],
        }
        return f(*args, **kwargs)

    return decorated
