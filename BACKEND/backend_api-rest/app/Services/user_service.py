from app.Repositories.user_repository import UserRepository
from app.Constants.geral import Geral

class UserService:

    TIPOS_VALIDOS = {'admin', 'supervisor', 'vendedor'}

    @staticmethod
    def list():
        users = UserRepository.get_all()
        return {'status': 200, 'usuarios': users}

    @staticmethod
    def create(dados):
        nome  = (dados.get('nome')  or '').strip()
        email = (dados.get('email') or '').strip()
        senha = (dados.get('senha') or '').strip()
        tipo  = (dados.get('tipo')  or '').strip()

        if not all([nome, email, senha, tipo]):
            return {'status': 400, 'error': Geral.CAMPOS_OBRIGATORIOS}

        if tipo not in UserService.TIPOS_VALIDOS:
            return {'status': 400, 'error': Geral.TIPO_INVALIDO}

        if UserRepository.find_by_email(email):
            return {'status': 409, 'error': Geral.USUARIO_JA_EXISTE}

        try:
            user_id = UserRepository.create(nome, email, senha, tipo)
            return {'status': 201, 'message': Geral.USUARIO_CADASTRADO, 'id': user_id}
        except Exception:
            return {'status': 500, 'error': Geral.ERRO_SERVIDOR}
