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
+-- AGENTE_IMPRESSAO/       # Agente local de impressao (roda no Windows do caixa)
+-- docker-compose.yml      # Containers
+-- iniciar_salestrack.bat  # Sobe os containers e o agente de impressao (Windows)
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
| Impressão | Agente local em Python (pywin32 + pyserial) |

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
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
TECNICO_SECRET=gere_com_pyotp_random_base32
```

> `TECNICO_SECRET` precisa ser uma string base32 válida. Gere uma nova com:
> `docker-compose exec backend python -c "import pyotp; print(pyotp.random_base32())"`
> Guarde esse valor em sigilo — é a credencial de acesso técnico do sistema.

---

## 2. Subir o projeto

No Windows, dê dois cliques em `iniciar_salestrack.bat`, na raiz do projeto. Ele sobe os
containers e o Agente de Impressão (seção 7) e pode ser executado quantas vezes for preciso.
Na primeira vez a montagem das imagens leva alguns minutos; depois de atualizar o código, rode
`iniciar_salestrack.bat --build`.

Para subir só os containers, manualmente:

```powershell
docker-compose up --build -d
```

Aguarde até todos os containers estarem saudáveis. Você pode acompanhar com:

```powershell
docker-compose ps
```

---

## 3. Executar a migration (apenas se o banco já existia antes desta versão)

Em uma instalação **nova** (volume do MySQL vazio), o `docker-compose.yml` já monta e executa
`database_setup.sql` e `migration_roles.sql` automaticamente — não é preciso fazer nada aqui.

Se você já tinha um banco criado com uma versão anterior do projeto (volume do MySQL já existente),
rode a migration manualmente uma única vez:

```powershell
docker cp BACKEND/database/migration_roles.sql salestrack_database:/tmp/migration.sql
docker exec salestrack_database sh -c "mysql -uroot -pSUA_SENHA salestrack < /tmp/migration.sql"
```

> Substitua `SUA_SENHA` pelo valor de `MYSQL_ROOT_PASSWORD` definido no seu `.env`.

O script é seguro para rodar mais de uma vez (não duplica dados nem colunas).

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
| Técnico | TECNICO | código TOTP (app autenticador) — veja abaixo |

> **Usuário Técnico:** a senha é um código TOTP padrão (RFC 6238, o mesmo esquema do Google
> Authenticator/Authy), calculado a partir do segredo definido em `TECNICO_SECRET` no `.env`.
> Para cadastrar o segredo no seu app autenticador (uma única vez), rode:
>
> ```powershell
> docker-compose exec backend python scripts/gerar_codigo_tecnico.py
> ```
>
> O script mostra a chave para colar no app e o código válido no momento. Depois do cadastro,
> o app mostra sozinho o código atual — não precisa mais rodar o script no dia a dia.

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

---

## 🖨️ 7. Impressão de comprovantes (Agente de Impressão)

A impressora fica ligada ao computador do caixa, e nem o navegador nem os containers do Docker
conseguem acessar as impressoras do Windows ou as portas COM. Quem faz essa ponte é o
**Agente de Impressão**: um programa pequeno que roda direto no Windows de cada caixa
(fora do Docker).

O agente vem junto com o sistema: é um executável em `AGENTE_IMPRESSAO\dist\SalesTrackImpressao\`
que o `iniciar_salestrack.bat` coloca no ar com os containers. O computador do caixa não precisa
de Python nem de nenhuma outra instalação.

### No computador do caixa

1. Rode o `iniciar_salestrack.bat` (passo 2). Além de subir o sistema, ele registra o agente para
   abrir sozinho junto com o Windows.
2. Confira que o Docker Desktop também inicia com o Windows (**Settings → General → Start Docker
   Desktop when you sign in**); assim os containers voltam sozinhos depois de reiniciar.

O agente roda sem janela, em `http://127.0.0.1:9317`. Se a impressão falhar, o log fica em
`%LOCALAPPDATA%\SalesTrack\agente_impressao.log`.

Para tirar o agente do computador:

```powershell
taskkill /im SalesTrackImpressao.exe /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v SalesTrackImpressao /f
```

### Configurar a impressora

Entre em **Configurações → Impressão** e escolha o tipo:

| Tipo | Quando usar |
|------|-------------|
| Térmica instalada no Windows | Térmica (ESC/POS) que aparece em "Impressoras e scanners" — USB, rede ou serial com driver |
| Térmica em porta serial (COM) | Térmica ligada direto numa porta COM do Gerenciador de Dispositivos, sem driver de impressora |
| Impressora comum / A4 | Jato de tinta, laser ou "Microsoft Print to PDF" — o comprovante sai pelo driver do Windows |

Selecione a impressora (ou a porta COM), clique em **Imprimir Página de Teste** e ajuste a
largura do papel e a acentuação até o teste sair correto. Depois clique em **Salvar Configuração**.

A configuração vale para aquele computador e navegador: cada caixa configura a própria impressora.

### Para quem desenvolve

- **Gerar o executável:** rode `AGENTE_IMPRESSAO\construir_agente.bat` (precisa de
  [Python 3](https://www.python.org/downloads/)), e de novo sempre que o código do agente mudar.
  A pasta `dist\` não é versionada pelo Git: ao instalar em um cliente, ela precisa ir junto com a
  pasta do projeto.
- **Rodar pelo código, com o log no console:** `AGENTE_IMPRESSAO\iniciar_agente.bat`. Só um agente
  roda por vez, então encerre antes o executável (`taskkill /im SalesTrackImpressao.exe /f`).
- **Sem impressora:** defina `SALESTRACK_AGENTE_SIMULACAO` com o caminho de um arquivo antes de
  iniciar o agente; as impressões são gravadas nele em vez de irem para o dispositivo.
- **Acesso por domínio:** o agente só responde ao próprio computador e a páginas abertas em
  `localhost` ou em IPs de rede local. Outros endereços entram pela variável de ambiente
  `SALESTRACK_AGENTE_ORIGENS` (ex.: `https://vendas.minhaloja.com.br`).

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
ALLOWED_ORIGINS=http://localhost:5173
TECNICO_SECRET=gere_com_pyotp_random_base32
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
