import time
from datetime import datetime
from app.Repositories.auth_repository import AuthRepository
from app.Services.licenca_service import LicencaService
from app.Constants.geral import Geral
from middlewares.auth_middleware import generate_token, revoke_token

# Bloqueio simples por e-mail contra força bruta
MAX_TENTATIVAS      = 5
JANELA_TENTATIVAS_S = 15 * 60
BLOQUEIO_S          = 15 * 60

_tentativas_login = {}


class AuthService:

    @staticmethod
    def _tempo_bloqueio_restante(email):
        registro = _tentativas_login.get(email)
        if not registro or not registro.get('bloqueado_ate'):
            return 0
        restante = registro['bloqueado_ate'] - time.time()
        return max(0, restante)

    @staticmethod
    def _registrar_falha(email):
        agora = time.time()
        registro = _tentativas_login.get(email)
        if not registro or (agora - registro['primeira_falha']) > JANELA_TENTATIVAS_S:
            registro = {'falhas': 0, 'primeira_falha': agora, 'bloqueado_ate': None}
        registro['falhas'] += 1
        if registro['falhas'] >= MAX_TENTATIVAS:
            registro['bloqueado_ate'] = agora + BLOQUEIO_S
        _tentativas_login[email] = registro

    @staticmethod
    def _limpar_tentativas(email):
        _tentativas_login.pop(email, None)

    @staticmethod
    def login(email, senha):
        if not email or not senha:
            return {'status': 400, 'error': Geral.CAMPOS_OBRIGATORIOS}

        email_normalizado = email.strip().lower()

        restante = AuthService._tempo_bloqueio_restante(email_normalizado)
        if restante > 0:
            minutos = int(restante // 60) + 1
            return {'status': 429, 'error': Geral.LOGIN_BLOQUEADO.format(minutos=minutos)}

        user = AuthRepository.find_by_credentials(email, senha)

        if not user:
            AuthService._registrar_falha(email_normalizado)
            return {'status': 401, 'error': Geral.CREDENCIAIS_INVALIDAS}

        # Licença bloqueia todos os perfis, exceto o técnico (precisa conseguir
        # entrar mesmo com a licença vencida/inativa, ou antes dos dados da
        # empresa serem configurados, pra poder resolver o problema).
        if user.get('tipo') != 'tecnico':
            motivo_bloqueio = LicencaService.motivo_bloqueio()
            if motivo_bloqueio:
                return {'status': 403, 'error': motivo_bloqueio}

        AuthService._limpar_tentativas(email_normalizado)

        if user.get('tipo') == 'tecnico':
            print(f"[AUDITORIA] Login TECNICO em {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")

        user_data = {
            'id':    user['idUsuario'],
            'nome':  user['nome'],
            'email': user['email'],
            'tipo':  user['tipo'],
        }

        token = generate_token(user_data)

        return {
            'status': 200,
            'token': token,
            'user': user_data,
        }

    @staticmethod
    def logout(token):
        if token:
            revoke_token(token)
        return {'status': 200, 'message': Geral.LOGOUT_OK}
