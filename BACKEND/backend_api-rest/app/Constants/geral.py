# =============================================
# Mensagens fixas da aplicação SalesTrack
# =============================================

class Geral:

    # Perfis com acesso administrativo total (gestão de usuários, catálogo, relatórios)
    PERFIS_ADMIN = {'admin', 'tecnico'}

    # Auth
    TOKEN_NAO_FORNECIDO     = "Token não fornecido."
    TOKEN_INVALIDO          = "Token inválido ou expirado."
    CREDENCIAIS_INVALIDAS   = "Email ou senha incorretos."
    CAMPOS_OBRIGATORIOS     = "Email e senha são obrigatórios."
    LOGOUT_OK               = "Sessão encerrada com sucesso."
    LOGIN_BLOQUEADO         = "Muitas tentativas de login. Tente novamente em {minutos} minuto(s)."

    # Produto
    PRODUTO_CADASTRADO      = "Produto cadastrado com sucesso."
    PRODUTO_ATUALIZADO      = "Produto atualizado com sucesso."
    PRODUTO_REMOVIDO        = "Produto removido com sucesso."
    PRODUTO_NAO_ENCONTRADO  = "Produto não encontrado."

    # Cliente
    CLIENTE_CADASTRADO      = "Cliente cadastrado com sucesso."
    CLIENTE_ATUALIZADO      = "Cliente atualizado com sucesso."
    CLIENTE_REMOVIDO        = "Cliente removido com sucesso."
    CLIENTE_NAO_ENCONTRADO  = "Cliente não encontrado."

    # Convênio
    CONVENIO_LIMITE_NAO_CONFIGURADO        = "Cliente não possui limite de convênio configurado."
    CONVENIO_CLIENTE_NAO_HABILITADO        = "Cliente não está habilitado para convênio."
    CONVENIO_LANCAMENTO_INVALIDO           = "Um ou mais lançamentos não pertencem a este cliente ou já foram pagos."
    CONVENIO_PAGAMENTO_REGISTRADO          = "Pagamento de convênio registrado com sucesso."
    CLIENTE_CONVENIO_DESABILITAR_BLOQUEADO = "Não é possível desabilitar o convênio: cliente possui saldo devedor pendente."
    CLIENTE_REMOCAO_BLOQUEADA_SALDO        = "Não é possível remover: cliente possui saldo devedor de convênio pendente."
    VENDA_CANCEL_BLOQUEADA_CONVENIO_PAGO   = "Não é possível cancelar: pagamento de convênio já foi registrado para esta venda."

    # Venda
    VENDA_CADASTRADA        = "Venda registrada com sucesso."
    VENDA_NAO_ENCONTRADA    = "Venda não encontrada."
    ERRO_CRIAR_VENDA        = "Erro ao registrar a venda."

    # Cancelamento de venda
    VENDA_CANCELADA         = "Venda cancelada e estoque restaurado com sucesso."
    VENDA_JA_CANCELADA      = "Esta venda já está cancelada."
    SEM_PERMISSAO           = "Acesso não autorizado. Apenas administradores podem realizar esta ação."

    # Usuário
    USUARIO_CADASTRADO      = "Usuário cadastrado com sucesso."
    USUARIO_NAO_ENCONTRADO  = "Usuário não encontrado."
    USUARIO_JA_EXISTE       = "Já existe um usuário com este e-mail."
    TIPO_INVALIDO           = "Perfil inválido. Use: admin, supervisor ou vendedor."
    SENHA_ADMIN_INVALIDA    = "Credenciais de administrador inválidas."

    # Erros gerais
    ERRO_SERVIDOR           = "Erro interno no servidor."
    ERRO_CONEXAO            = "Erro ao conectar ao banco de dados."
