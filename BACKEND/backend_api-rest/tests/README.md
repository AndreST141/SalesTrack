# Suíte de Testes Automatizados - SalesTrack

Este diretório contém a suíte profissional de testes automatizados do backend do **SalesTrack**, desenvolvida com foco em qualidade de software, rastreabilidade aos requisitos funcionais (RF-001 a RF-012) e integridade de regras de negócio (RNE-001 a RNE-006).

---

## 1. Estrutura da Suíte de Testes

A organização segue a divisão em camadas da arquitetura (Controllers, Services, Repositories e Middlewares):

```
tests/
├── conftest.py                       # Fixtures compartilhadas, cliente Flask, tokens RBAC e reset de estado
├── README.md                         # Documentação técnica e guia de execução
│
├── unit/                             # Testes Unitários de Regras de Negócio e Serviços
│   ├── test_auth_service.py          # Autenticação, força bruta, lockout e TOTP técnico
│   ├── test_venda_service.py         # Validação de pagamentos, split payment, estoque e cancelamento
│   ├── test_produto_service.py       # Validação de preços, campos obrigatórios e soft-delete
│   ├── test_cliente_service.py       # Cadastro, validação de nome e reativação
│   ├── test_user_service.py          # Papéis (RBAC), e-mails duplicados e tamanho de senha
│   ├── test_licenca_service.py       # Regras de validade e expiração de licença
│   ├── test_configuracao_service.py  # Flag de estoque negativo e JSON de dados da empresa
│   ├── test_categoria_dashboard_service.py # Listagem de categorias e cálculo de KPIs
│   ├── test_relatorio_service.py     # 4 modalidades de relatórios analíticos
│   └── test_repositories.py          # Acesso a banco, locks transacionais FOR UPDATE e rollback
│
├── integration/                      # Testes de Integração de APIs e Endpoints HTTP
│   ├── test_api_auth.py              # Endpoints /api/login e /api/logout
│   ├── test_api_produtos.py          # CRUD completo e controle de acesso em /api/produtos
│   ├── test_api_clientes.py          # CRUD de clientes e listagem em /api/clientes
│   ├── test_api_vendas.py            # Criação de vendas, detalhes e cancelamento
│   ├── test_api_dashboard.py         # KPIs, gráficos e categorias
│   ├── test_api_relatorios.py        # Endpoints analíticos com filtros de período
│   ├── test_api_configuracao_licenca.py # Configurações e licença com restrição de admin
│   ├── test_api_usuarios.py          # Gestão de usuários do sistema
│   └── test_security_rbac.py         # Matriz de controle de acesso (RBAC), tokens e headers UTF-8
│
└── system/                           # Testes de Sistema e Fluxos Fim-a-Fim (E2E)
    ├── test_sales_workflow.py        # Fluxo completo: login -> catálogo -> cliente -> venda -> cancelamento
    └── test_inventory_control_workflow.py # Fluxo de controle de estoque e política de saldo negativo
```

---

## 2. Tecnologias Utilizadas

- **[pytest](https://docs.pytest.org/):** Framework principal de execução e asserções.
- **[pytest-cov](https://pytest-cov.readthedocs.io/):** Coleta e análise de cobertura de código (*coverage*).
- **[pytest-mock](https://pytest-mock.readthedocs.io/):** Isolamento de serviços externos e banco de dados.
- **[Flask Test Client](https://flask.palletsprojects.com/testing/):** Emulação de requisições HTTP RESTful com injeção de *headers* e *payloads* JSON.
- **[pyotp](https://pyauth.github.io/pyotp/):** Validação criptográfica do algoritmo TOTP RFC 6238 para o perfil técnico.
- **[bcrypt](https://github.com/pyca/bcrypt/):** Validação de hashes seguros de senhas.

---

## 3. Instalação das Dependências

### 3.1. Via Docker (recomendado — mesmo Python 3.11 da produção)

Não precisa de Python instalado na máquina. A partir da raiz do projeto (PowerShell), com a imagem `salestrack-backend` já construída pelo `docker compose`:

```powershell
docker run --rm -v "${PWD}\BACKEND\backend_api-rest:/src" -w /src salestrack-backend sh -c "pip install -q -r requirements-dev.txt && python -m pytest -v"
```

O container roda fora da rede do Compose, então não alcança o banco real — e nem precisa: todo acesso ao banco é mockado.

### 3.2. Via ambiente virtual Python local

```bash
# Dentro de BACKEND/backend_api-rest:
pip install -r requirements-dev.txt
```

> As versões fixadas em `requirements.txt` (bcrypt, mysql-connector) são as da imagem Docker (Python 3.11). Em versões muito novas do Python pode não haver pacote pronto para elas — nesse caso use o Docker.

`requirements-dev.txt`, `pytest.ini` e a pasta `tests/` estão no `.dockerignore`, então não entram na imagem de produção.

---

## 4. Como Executar os Testes

Os comandos abaixo devem ser executados **dentro de `BACKEND/backend_api-rest`** (onde fica o `pytest.ini`). Via Docker, troque `pytest` por `python -m pytest` no final do comando da seção 3.1.

### 4.1. Executar todos os testes
```bash
pytest
```

### 4.2. Execução com saída detalhada
```bash
pytest -v
```

### 4.3. Executar apenas uma categoria de testes
```bash
# Apenas testes unitários
pytest tests/unit

# Apenas testes de integração de API
pytest tests/integration

# Apenas testes de sistema / fluxos completos
pytest tests/system
```

### 4.4. Executar um arquivo de teste específico
```bash
pytest tests/unit/test_auth_service.py
```

### 4.5. Executar um cenário de teste específico pelo nome
```bash
pytest -k "test_login_brute_force_lockout"
```

---

## 5. Como Gerar e Interpretar o Relatório de Cobertura

Para medir o percentual de código coberto pelos testes automatizados:

### 5.1. Relatório em terminal com linhas faltantes
```bash
pytest --cov=app --cov=middlewares --cov=routes --cov-report=term-missing
```

### 5.2. Relatório gráfico em HTML
```bash
pytest --cov=app --cov=middlewares --cov=routes --cov-report=html:tests/coverage_html
```

O relatório em HTML será gerado na pasta `tests/coverage_html/index.html`. Abra esse arquivo no navegador para visualizar linha por linha o código coberto e os pontos não atingidos.

### 5.3. Interpretação dos Resultados
- **100% de Cobertura em Rotas e Middlewares:** Garante que todos os interceptadores de autenticação, checagem de tokens Bearer e serialização UTF-8 estão plenamente validados.
- **Serviços (Services):** 100% em autenticação, clientes, licença e relatórios; 99% em produtos; 90% em vendas. Ainda baixos: `convenio_service` (21%) e `configuracao_service` (48%) — próximos candidatos a receber testes.
- **86% nos Controladores (Controllers):** Confirma o tratamento de códigos de resposta HTTP (200, 201, 400, 401, 403, 404, 409, 422, 429).
- **Total medido em 2026-11-14:** 171 testes, 71% de cobertura de linhas.
- **Linhas faltantes nos Repositórios:** Correspondem às exceções de falha de conexão física com o MySQL quando o servidor de banco de dados não está em execução.

---

## 6. Isolamento e Boas Práticas Adotadas

1. **Estado Limpo (`clean_system_state`):** Fixture com `autouse=True` que limpa o dicionário em memória de sessões (`active_tokens`) e o histórico de tentativas de ataque de força bruta antes e depois de cada teste individual.
2. **Sem Dependência de Ordem:** Nenhum teste depende da execução prévia de outro.
3. **Mocks Estratégicos:** O banco de dados físico é mockado nos cenários onde o container Docker não está ativo, garantindo que a suíte seja 100% executável em qualquer máquina de desenvolvimento.
