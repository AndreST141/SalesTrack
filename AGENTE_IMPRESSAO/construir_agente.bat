@echo off
rem Gera o executavel do Agente de Impressao em dist\SalesTrackImpressao\.
rem So quem desenvolve precisa rodar isto (e de novo quando o agente mudar):
rem com o executavel pronto, o computador do caixa nao precisa de Python.
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Preparando o ambiente Python...
    py -3 -m venv .venv 2>nul || python -m venv .venv
)
if not exist ".venv\Scripts\python.exe" goto erro

".venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r requirements.txt pyinstaller
if errorlevel 1 goto erro

rem O Windows trava o executavel em uso: encerra o agente antes de recriar
taskkill /im SalesTrackImpressao.exe /f >nul 2>&1

rem Pasta (e nao arquivo unico): o formato de arquivo unico se descompacta na
rem pasta temporaria a cada inicio e deixa sobras quando o Windows desliga.
rem Arquivos intermediarios vao para a pasta temporaria, fora do projeto.
set "TRABALHO=%TEMP%\salestrack_agente_build"
".venv\Scripts\python.exe" -m PyInstaller --noconfirm --clean --noconsole ^
    --name SalesTrackImpressao ^
    --distpath dist --workpath "%TRABALHO%" --specpath "%TRABALHO%" ^
    agente.py
if errorlevel 1 goto erro
rmdir /s /q "%TRABALHO%" >nul 2>&1

echo.
echo Executavel gerado em AGENTE_IMPRESSAO\dist\SalesTrackImpressao\
echo Rode o iniciar_salestrack.bat (na raiz do projeto) para coloca-lo no ar.
goto fim

:erro
echo.
echo Nao foi possivel gerar o executavel do agente.
echo Confira se o Python 3 esta instalado (https://www.python.org/downloads/)
echo e se ha internet para baixar as dependencias.
exit /b 1

:fim
endlocal
