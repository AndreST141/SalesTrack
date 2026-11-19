@echo off
rem Coloca o SalesTrack inteiro no ar neste computador: os containers (Docker)
rem e o Agente de Impressao. Pode ser executado quantas vezes for preciso.
rem
rem Tambem registra o agente para abrir sozinho com o Windows; os containers
rem ja voltam sozinhos quando o Docker Desktop inicia.
rem
rem Argumentos sao repassados ao docker-compose (ex.: iniciar_salestrack.bat --build).
setlocal
cd /d "%~dp0"

set "AGENTE_EXE=%~dp0AGENTE_IMPRESSAO\dist\SalesTrackImpressao\SalesTrackImpressao.exe"
set "PORTA_FRONTEND=5173"
if exist ".env" for /f "usebackq tokens=1,2 delims==" %%a in (".env") do if /i "%%a"=="FRONTEND_PORT" set "PORTA_FRONTEND=%%b"

echo [1/2] Subindo os containers do SalesTrack...
if not exist ".env" (
    echo.
    echo Arquivo .env nao encontrado. Crie-o a partir do .env.example
    echo ^(passo 1 do README^) e rode este arquivo de novo.
    goto falha
)
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo O Docker Desktop nao esta em execucao. Abra o Docker Desktop, espere
    echo ele terminar de iniciar e rode este arquivo de novo.
    goto falha
)
docker-compose up -d %*
if errorlevel 1 (
    echo.
    echo Nao foi possivel subir os containers. Veja a mensagem acima.
    goto falha
)

echo.
echo [2/2] Iniciando o Agente de Impressao...
if not exist "%AGENTE_EXE%" (
    echo.
    echo O executavel do agente nao foi encontrado em AGENTE_IMPRESSAO\dist.
    echo O sistema esta no ar, mas sem impressao de comprovantes.
    echo Gere o executavel uma vez com AGENTE_IMPRESSAO\construir_agente.bat.
    goto falha
)

rem Abre junto com o Windows (por usuario, nao precisa de administrador)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v SalesTrackImpressao /t REG_SZ /d "\"%AGENTE_EXE%\"" /f >nul

rem Se o agente ja estiver aberto, esta segunda chamada encerra sozinha
start "" "%AGENTE_EXE%"

set "AGENTE_OK="
for /l %%i in (1,1,15) do if not defined AGENTE_OK (
    curl -s -m 2 -o nul http://127.0.0.1:9317/status && set "AGENTE_OK=1"
    if not defined AGENTE_OK ping -n 2 127.0.0.1 >nul
)
if not defined AGENTE_OK (
    echo.
    echo O agente de impressao nao respondeu. Veja o log em
    echo %LOCALAPPDATA%\SalesTrack\agente_impressao.log
    goto falha
)

echo.
echo SalesTrack no ar: http://localhost:%PORTA_FRONTEND%
echo Agente de impressao ativo ^(abre sozinho com o Windows^).
echo.
rem Da tempo de ler quando aberto com dois cliques, sem travar a janela
timeout /t 10 2>nul
exit /b 0

:falha
echo.
timeout /t 60 2>nul
exit /b 1
