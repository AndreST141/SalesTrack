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

### Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução

Com Docker, não é necessário instalar Python, Node.js, dependências do projeto ou MySQL manualmente.

---

## 1. Configurar variáveis de ambiente

Na raiz do projeto, copie o arquivo de exemplo e edite com suas preferências:

```powershell
copy .env.example .env
```

Abra o `.env` e ajuste os valores:

```env
MYSQL_ROOT_PASSWORD=sua_senha_aqui
DB_NAME=salestrack
MYSQL_PORT=3307
BACKEND_PORT=5000
FRONTEND_PORT=5173
VITE_API_URL=http://localhost:5000/api
```

---

## 2. Subir o projeto

Na raiz do projeto, execute:

```powershell
docker-compose up --build -d
```

Aguarde até todos os containers estarem saudáveis. Você pode acompanhar com:

```powershell
docker-compose ps
```

---

## 3. Executar a migration (apenas na primeira vez)

Após os containers subirem, rode a migration para criar os perfis de usuário e as colunas de cancelamento:

```powershell
docker cp BACKEND/database/migration_roles.sql salestrack_database:/tmp/migration.sql
docker exec salestrack_database sh -c "mysql -uroot -pSUA_SENHA salestrack < /tmp/migration.sql"
```

> Substitua `SUA_SENHA` pelo valor de `MYSQL_ROOT_PASSWORD` definido no seu `.env`.

Esse passo só precisa ser feito **uma única vez**. Nas próximas vezes que subir o projeto basta o passo 2.

---

## 🌐 4. Acessar a Aplicação

Após todos os passos, a aplicação estará disponível em:

| Serviço | Endereço |
|---------|----------|
| Frontend | http://localhost:5173 |
| Backend (API) | http://localhost:5000 |
| MySQL | localhost:3307 |

---

## 🔑 Credenciais de Acesso

| Perfil | Login | Senha |
|--------|-------|-------|
| Administrador | admin@salestrack.com | admin123 |
| Vendedor | vendedor@salestrack.com | vendedor123 |
| Técnico | TECNICO | data atual no formato `YYYYMMDD` |

> **Usuário Técnico:** a senha muda todo dia automaticamente. Para logar no dia 07/06/2026, a senha é `20260607`.

---

## 5. Comandos úteis

Ver containers em execução:

```powershell
docker-compose ps
```

Ver logs:

```powershell
docker-compose logs backend --tail=50
docker-compose logs frontend --tail=50
docker-compose logs database --tail=50
```

Parar os containers:

```powershell
docker-compose down
```

Parar e apagar os dados do banco (reset completo):

```powershell
docker-compose down -v
```

> ⚠️ `down -v` apaga o volume do MySQL. Na próxima subida o banco será recriado do zero e a migration precisará ser executada novamente.

---

## 6. Script de Vendas para Teste

Com o sistema rodando, é possível gerar vendas aleatórias para popular o dashboard:

```powershell
docker-compose exec backend python scripts/gerar_vendas.py --quantidade 50
```

Informando um período específico:

```powershell
docker-compose exec backend python scripts/gerar_vendas.py --quantidade 50 --data-inicio 2026-05-01 --data-fim 2026-05-30
```

<<<<<<< HEAD
=======
## 🔑 Credenciais de Teste

| Perfil | Email | Senha |
|--------|-------|-------|
| Administrador | admin@salestrack.com | admin123 |
| Vendedor | vendedor@salestrack.com | vendedor123 |
| Tecnico | tecnico| anoMesDia |

>>>>>>> 4e7573a (Fix capitalization for 'Tecnico' in README)
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
