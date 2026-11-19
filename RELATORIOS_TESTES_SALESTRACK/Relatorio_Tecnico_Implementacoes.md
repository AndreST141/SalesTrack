# Relatório Técnico de Implementações e Revalidação

**Projeto:** SalesTrack — Sistema de Gestão de Vendas
**Data:** 17 de novembro de 2026
**Branch:** `feature/qa-ci-security-hardening`

## Síntese

As implementações de autenticação JWT, rejeição de senhas fora do formato Bcrypt, armazenamento de tokens revogados, workflows e testes já estavam parcialmente presentes na branch. A auditoria anterior declarava aprovação integral, mas a execução real revelou um teste frontend quebrado, 12 erros de ESLint, dependências vulneráveis e workflows que mascaravam falhas de lint e segurança.

## Implementações conferidas e ajustes feitos

- `AuthRepository` valida senhas Bcrypt e rejeita credenciais em texto plano. O script `scripts/migrate_passwords.py` está presente, mas a migração não foi executada contra banco de produção. O script atualiza usuário por usuário; não existe rollback transacional global como dizia o relatório anterior.
- O middleware valida JWT HS256 com expiração de oito horas e consulta a blacklist persistida em MySQL e cache local. Os testes simulam a persistência e o cenário de cache vazio; não foi testada reinicialização contra um MySQL real. A consulta ao repositório trata erro de conexão como token não revogado, então a verificação persistente depende da disponibilidade do banco.
- Removido o segredo JWT fraco embutido no código. O backend agora exige `JWT_SECRET` com pelo menos 32 bytes e falha na inicialização se o segredo não estiver configurado. O `.env.example` tem apenas um valor de substituição. Configure um segredo aleatório em `.env` local e nos secrets do GitHub; não versionar `.env`.
- Corrigido o isolamento do teste de interceptors Axios, que reutilizava o módulo entre casos e causava quatro falhas.
- Corrigidos erros de lint: variáveis não usadas, exportações de hooks dos contextos e sincronizações de estado. Lint permanece com cinco advertências de dependências de hooks.
- Removidos `|| true` dos workflows de lint e segurança; o gate de CI agora depende do job de lint.
- Atualizadas dependências Python para Flask 3.1.3, Flask-CORS 6.0.0, MySQL Connector 9.1.0, python-dotenv 1.2.2 e PyJWT 2.15.0. `npm audit fix` atualizou as dependências transitivas do frontend.

## Resultados executados

| Verificação | Resultado |
|---|---|
| Backend pytest com cobertura | 167/167 aprovados; 80% de cobertura total. Executado em Python 3.14.5 com `JWT_SECRET` de teste configurado no processo. |
| Frontend Vitest com cobertura | 38/38 aprovados em 7 arquivos. Statements 63,70%; branches 49,19%; functions 66,66%; lines 70,90%. |
| ESLint | Código de saída 0; 5 advertências de dependências de hooks em páginas de histórico, produtos e vendas. |
| Build de produção | Concluído com Vite. Aviso: bundle principal acima de 500 kB após minificação. |
| Docker Compose | `docker compose -f docker-compose.yml config --quiet` concluiu com código 0. Docker exibiu avisos de acesso à configuração local. |
| pip-audit | Nenhuma vulnerabilidade conhecida nas dependências Python atualizadas. |
| npm audit | Uma vulnerabilidade alta permanece em `xlsx` (SheetJS); a auditoria informa que não há versão corrigida disponível. Comando termina com código 1. |
| `git diff --check` | Diffs de código sem problemas de whitespace; o relatório foi revisado para remover espaços finais. |

## Workflows e pendências

`.github/workflows/ci.yml` executa testes backend/frontend, build, lint e validação Docker Compose, com lint incluído no gate. `.github/workflows/security.yml` executa `npm audit` e `pip-audit` sem mascarar falhas. A verificação de segurança frontend continuará falhando até substituir `xlsx` por uma opção corrigida ou aceitar e tratar formalmente o risco residual.

A persistência de tokens foi validada com doubles de teste, não com MySQL real. A migração de senhas ainda requer procedimento operacional e deve ser executada somente no ambiente apropriado, com backup. Configure `JWT_SECRET` antes de iniciar o backend localmente.
