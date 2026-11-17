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

Para instalar as dependências de testes no seu ambiente virtual Python:

```bash
# A partir da raiz do projeto:
pip install -r BACKEND/backend_api-rest/requirements-dev.txt

# Ou se estiver dentro de BACKEND/backend_api-rest:
pip install -r requirements-dev.txt
```

---

## 4. Como Executar os Testes

Graças aos arquivos de configuração `pytest.ini` configurados na raiz e no backend, os testes podem ser executados a partir de qualquer diretório:

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
pytest BACKEND/backend_api-rest/tests/unit

# Apenas testes de integração de API
pytest BACKEND/backend_api-rest/tests/integration

# Apenas testes de sistema / fluxos completos
pytest BACKEND/backend_api-rest/tests/system
```

### 4.4. Executar um arquivo de teste específico
```bash
pytest BACKEND/backend_api-rest/tests/unit/test_auth_service.py
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
pytest --cov=app --cov=middlewares --cov=routes --cov-report=html:BACKEND/backend_api-rest/tests/coverage_html
```

O relatório em HTML será gerado na pasta `tests/coverage_html/index.html`. Abra esse arquivo no navegador para visualizar linha por linha o código coberto e os pontos não atingidos.

### 5.3. Interpretação dos Resultados
- **100% de Cobertura em Rotas e Middlewares:** Garante que todos os interceptadores de autenticação, checagem de tokens Bearer e serialização UTF-8 estão plenamente validados.
- **95% a 100% em Serviços (Services):** Comprova que toda a lógica de negócio do sistema (descontos, troco, split payment, regras de bloqueio contra força bruta e cancelamento) opera conforme a especificação.
- **97% nos Controladores (Controllers):** Confirma o tratamento de códigos de resposta HTTP (200, 201, 400, 401, 403, 404, 422, 429).
- **Linhas faltantes nos Repositórios:** Correspondem às exceções de falha de conexão física com o MySQL quando o servidor de banco de dados não está em execução.

---

## 6. Isolamento e Boas Práticas Adotadas

1. **Estado Limpo (`clean_system_state`):** Fixture com `autouse=True` que limpa o dicionário em memória de sessões (`active_tokens`) e o histórico de tentativas de ataque de força bruta antes e depois de cada teste individual.
2. **Sem Dependência de Ordem:** Nenhum teste depende da execução prévia de outro.
3. **Mocks Estratégicos:** O banco de dados físico é mockado nos cenários onde o container Docker não está ativo, garantindo que a suíte seja 100% executável em qualquer máquina de desenvolvimento.
