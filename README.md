# SalesTrack - Sistema de Gestao de Vendas

Sistema web para gestao de vendas, com dashboard, controle de produtos, clientes, historico de vendas e relatorios.

## 👥 Integrantes do Grupo

- Matheus Sabino Ribeiro - 2313148
- Andre Marcos de Sousa Tavares - 2313280
- Gabriel Pedro Silva Dutra - 2310154
- Guilherme Poloniato Salomao - 2310359

## 📂 Estrutura do Projeto

```text
SalesTrack/
+-- BACKEND/
|   +-- backend_api-rest/   # API REST em Python + Flask
|   +-- database/           # Script do MySQL
+-- FRONTEND/
|   +-- frontend_react/     # React + Vite
+-- docker-compose.yml      # Containers
+-- .env.example            # Exemplo de variaveis de ambiente
+-- README.md
```

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|------------|
| Frontend | React + Vite |
| Backend | Python + Flask |
| Banco de dados | MySQL |
| Servidor | Docker + Docker Compose |

## 🚀 Como Executar com Docker

### Pre-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução

Com Docker, nao e necessario instalar Python, Node.js, dependencias do projeto ou MySQL manualmente.

## 1. Configurar variaveis

Na raiz do projeto, copie o arquivo de exemplo:

```powershell
copy .env.example .env
```

## 2. Subir o projeto

Na raiz do projeto, execute:

```powershell
docker compose up --build
```

## 🌐 3 Acessando a Aplicação

Após executar todos os passos, a aplicação estará disponível em:

* **Frontend:** http://localhost:5173
* **Backend (API):** http://localhost:5000
* **MySQL:** `localhost:3307`

## 4. Comandos uteis

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

## 5. Script de Vendas para Teste

Com o sistema rodando via Docker, e possivel gerar vendas aleatorias pela API:

```powershell
docker compose exec backend python scripts/gerar_vendas.py --quantidade 50
```

Tambem e possivel informar um periodo:

```powershell
docker compose exec backend python scripts/gerar_vendas.py --quantidade 50 --data-inicio 2026-05-01 --data-fim 2026-05-30
```

## 🔑 Credenciais de Teste

| Perfil | Email | Senha |
|--------|-------|-------|
| Administrador | admin@salestrack.com | admin123 |
| Vendedor | vendedor@salestrack.com | vendedor123 |
| tecnico | tecnico| 20260607 |

# ⚙️Execução Manual sem Docker

Use esta opção apenas se quiser executar cada camada separadamente.

### Banco de Dados

Abra o MySQL e execute:

```sql
source C:/caminho/para/SalesTrack/BACKEND/database/database_setup.sql
```

### Backend

Crie um arquivo `BACKEND/backend_api-rest/.env` com:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=salestrack
DB_CHARSET=utf8mb4
```

Depois execute:

```powershell
cd BACKEND/backend_api-rest
pip install -r requirements.txt
python app.py
```

### Frontend

Em outro terminal:

```powershell
cd FRONTEND/frontend_react
npm install
npm run dev
```

O frontend manual ficará disponível em [http://localhost:5173](http://localhost:5173).
