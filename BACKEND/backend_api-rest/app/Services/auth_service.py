import secrets
from app.Repositories.auth_repository import AuthRepository
from app.Constants.geral import Geral
from middlewares.auth_middleware import active_tokens

class AuthService:

    @staticmethod
    def login(email, senha):
        if not email or not senha:
            return {'status': 400, 'error': Geral.CAMPOS_OBRIGATORIOS}

        user = AuthRepository.find_by_credentials(email, senha)

        if not user:
            return {'status': 401, 'error': Geral.CREDENCIAIS_INVALIDAS}

        token = secrets.token_urlsafe(32)
        active_tokens[token] = {
            'id':    user['idUsuario'],
            'nome':  user['nome'],
            'email': user['email'],
            'tipo':  user['tipo']
        }

        return {
            'status': 200,
            'token': token,
            'user': active_tokens[token]
        }

    @staticmethod
    def logout(token):
        if token in active_tokens:
            del active_tokens[token]
        return {'status': 200, 'message': Geral.LOGOUT_OK}
