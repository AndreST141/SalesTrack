# SalesTrack - Sistema de Gestao de Vendas

Sistema web para gestao de vendas, com dashboard, controle de produtos, clientes, historico de vendas e relatorios.

## Integrantes do Grupo

- Matheus Sabino Ribeiro - 2313148
- Andre Marcos de Sousa Tavares - 2313280
- Gabriel Pedro Silva Dutra - 2310154
- Guilherme Poloniato Salomao - 2310359

## Estrutura do Projeto

```text
SalesTrack/
+-- backend_api-rest/   # API REST em Python + Flask
+-- frontend_react/     # React + Vite
+-- database/           # Banco de Dados MySQL
+-- docker-compose.yml  # Containers do Docker
+-- .env.example        # Exemplo de login do MySQL
+-- README.md
```

## Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|------------|
| Frontend | React + Vite |
| Backend | Python + Flask |
| Banco de dados | MySQL |
| Servidor | Docker + Docker Compose |

## Como Executar com Docker

### Pre-requisitos

- Docker Desktop instalado e em execucao

Com Docker, nao e necessario instalar Python, Node.js, dependencias do projeto ou MySQL manualmente.

### 1. Configurar variaveis

Na raiz do projeto, copie o arquivo de exemplo:

```powershell
copy .env.example .env
```

Exemplo de configuracao:

```env
MYSQL_ROOT_PASSWORD=root
DB_NAME=salestrack
MYSQL_PORT=3307
BACKEND_PORT=5000
FRONTEND_PORT=5173
VITE_API_URL=http://localhost:5000/api
```

### 2. Subir o projeto

Na raiz do projeto, execute:

```powershell
docker compose up --build
```

O Docker Compose ira criar e iniciar tres servicos:

- `salestrack_database`: banco MySQL com o script `database/database_setup.sql`.
- `salestrack_backend`: API Flask conectada ao banco.
- `salestrack_frontend`: aplicacao React servida pelo Nginx.

### 3. Acessar o sistema

- Frontend: http://localhost:5173
- Backend/API: http://localhost:5000
- MySQL: `localhost:3307` ou a porta configurada em `MYSQL_PORT`

### 4. Comandos uteis

Ver containers em execucao:

```powershell
docker compose ps
```

Ver logs:

```powershell
docker compose logs backend --tail=50
docker compose logs frontend --tail=50
docker compose logs database --tail=50
```

Parar os containers:

```powershell
docker compose down
```

Parar e apagar os dados do volume MySQL:

```powershell
docker compose down -v
```

## Credenciais de Teste

| Perfil | Email | Senha |
|--------|-------|-------|
| Administrador | admin@salestrack.com | admin123 |
| Vendedor | vendedor@salestrack.com | vendedor123 |

## Execucao Manual sem Docker

Use esta opcao apenas se quiser executar cada camada separadamente.

### Banco de Dados

Abra o MySQL e execute:

```sql
source C:/caminho/para/SalesTrack/database/database_setup.sql
```

### Backend

Crie um arquivo `backend_api-rest/.env` com:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=salestrack
DB_CHARSET=utf8mb4
```

Depois execute:

```powershell
cd backend_api-rest
pip install -r requirements.txt
python app.py
```

### Frontend

Em outro terminal:

```powershell
cd frontend_react
npm install
npm run dev
```

O frontend manual ficara disponivel em `http://localhost:5173`.
