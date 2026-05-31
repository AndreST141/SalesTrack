# SalesTrack - Sistema de Gestao de Vendas

Sistema web para gestao de vendas, com dashboard, controle de produtos, clientes, historico de vendas e relatorios.

## 👥 Integrantes do Grupo

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

## 🚀 Como Executar com Docker

### Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução

Com Docker, não é necessário instalar Python, Node.js, dependências do projeto ou MySQL manualmente.

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

## 🌐 3. Acessar o sistema

- Frontend: http://localhost:5173
- Backend/API: http://localhost:5000

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
## ⚙️ 5. Dockerfile do Backend

```Dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
```
## 🎨 6. Dockerfile do Frontend

```Dockerfile
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:5000/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
```

## Credenciais de Teste

| Perfil | Email | Senha |
|--------|-------|-------|
| Administrador | admin@salestrack.com | admin123 |
| Vendedor | vendedor@salestrack.com | vendedor123 |

## Execução Manual sem Docker

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
