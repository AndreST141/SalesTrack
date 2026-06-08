# =============================================
# Mensagens fixas da aplicação SalesTrack
# =============================================

class Geral:

    # Auth
    TOKEN_NAO_FORNECIDO     = "Token não fornecido."
    TOKEN_INVALIDO          = "Token inválido ou expirado."
    CREDENCIAIS_INVALIDAS   = "Email ou senha incorretos."
    CAMPOS_OBRIGATORIOS     = "Email e senha são obrigatórios."
    LOGOUT_OK               = "Sessão encerrada com sucesso."

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
