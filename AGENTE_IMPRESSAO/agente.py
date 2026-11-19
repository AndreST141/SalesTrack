"""Agente de Impressão do SalesTrack.

Serviço local que roda no Windows do caixa (fora do Docker) e faz a ponte
entre o navegador e a impressora: nem o navegador nem o container do backend
enxergam o spooler do Windows ou as portas COM da máquina.

A configuração (qual impressora, largura do papel...) fica no frontend e vem
em cada pedido de impressão; o agente não guarda estado.

No caixa ele roda como executável sem janela (gerado por construir_agente.bat
e iniciado pelo iniciar_salestrack.bat), com o log em arquivo. No
desenvolvimento, iniciar_agente.bat roda este script com o log no console.

    GET  /status        confirma que o agente está no ar
    GET  /dispositivos  impressoras do Windows e portas seriais da máquina
    POST /imprimir      { config, linhas } -> imprime
"""
import logging
import os
import re
import sys
from logging.handlers import RotatingFileHandler

import win32api
import win32event
import winerror
from flask import Flask, jsonify, request
from werkzeug.serving import make_server

import dispositivos
import impressao

VERSAO = '1.0.0'
# Mesma porta fixada no frontend (src/services/impressaoService.js)
PORTA = 9317

# Onde o executável (que não tem janela) grava o log
ARQUIVO_LOG = os.path.join(
    os.getenv('LOCALAPPDATA') or os.path.expanduser('~'), 'SalesTrack', 'agente_impressao.log'
)

# Endereços do frontend autorizados a usar o agente. Qualquer página aberta
# no navegador consegue chamar http://127.0.0.1, então sem este filtro um
# site qualquer poderia mandar imprimir. Por padrão vale localhost e IPs de
# rede local; outros endereços entram por SALESTRACK_AGENTE_ORIGENS
# (separados por vírgula, ex.: https://vendas.minhaloja.com.br).
ORIGEM_REDE_LOCAL = re.compile(
    r'https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+'
    r'|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?'
)
ORIGENS_EXTRAS = {
    origem.strip().rstrip('/')
    for origem in os.getenv('SALESTRACK_AGENTE_ORIGENS', '').split(',')
    if origem.strip()
}

app = Flask(__name__)
app.json.ensure_ascii = False


def origem_permitida(origem):
    return bool(ORIGEM_REDE_LOCAL.fullmatch(origem)) or origem in ORIGENS_EXTRAS


@app.before_request
def validar_chamador():
    # O agente só atende pelo próprio computador (protege contra DNS rebinding)
    if request.host.split(':')[0] not in ('127.0.0.1', 'localhost'):
        return jsonify({'error': 'Acesso não autorizado.'}), 403

    origem = request.headers.get('Origin')
    if origem and not origem_permitida(origem):
        return jsonify({'error': 'Origem não autorizada a usar o agente de impressão.'}), 403

    if request.method == 'OPTIONS':
        return '', 204


@app.after_request
def liberar_cors(resposta):
    origem = request.headers.get('Origin')
    if origem and origem_permitida(origem):
        resposta.headers['Access-Control-Allow-Origin'] = origem
        resposta.headers['Vary'] = 'Origin'
        resposta.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        resposta.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        # Exigido pelo Chrome para um site chamar um endereço da própria máquina
        resposta.headers['Access-Control-Allow-Private-Network'] = 'true'
        resposta.headers['Access-Control-Max-Age'] = '600'
    return resposta


@app.get('/status')
def status():
    return jsonify({
        'ok': True,
        'versao': VERSAO,
        'simulacao': bool(impressao.ARQUIVO_SIMULACAO),
    })


@app.get('/dispositivos')
def listar_dispositivos():
    try:
        return jsonify({
            'impressoras': dispositivos.listar_impressoras(),
            'portasSeriais': dispositivos.listar_portas_seriais(),
        })
    except Exception as e:
        return jsonify({'error': f'Não foi possível consultar os dispositivos do Windows: {e}'}), 500


@app.post('/imprimir')
def imprimir():
    dados = request.get_json(silent=True) or {}
    try:
        config = impressao.validar_config(dados.get('config'))
        linhas = impressao.validar_linhas(dados.get('linhas'))
        impressao.imprimir(config, linhas)
    except impressao.ErroImpressao as e:
        app.logger.warning('Impressao recusada (%s): %s', e.status, e)
        return jsonify({'error': str(e)}), e.status
    return jsonify({'success': True}), 200


def configurar_log():
    # Sem console (executável sem janela) o log vai para arquivo
    if sys.stderr is not None:
        logging.basicConfig(level=logging.INFO, format='%(message)s')
        return
    os.makedirs(os.path.dirname(ARQUIVO_LOG), exist_ok=True)
    arquivo = RotatingFileHandler(ARQUIVO_LOG, maxBytes=512 * 1024, backupCount=1, encoding='utf-8')
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s', handlers=[arquivo])


def principal():
    configurar_log()
    log = logging.getLogger('agente')

    # Uma única instância por computador: o executável abre com o Windows e
    # também é chamado pelo iniciar_salestrack.bat. Não dá para confiar em
    # "porta ocupada", porque no Windows dois processos conseguem abrir a
    # mesma porta e passariam a dividir os pedidos entre si.
    instancia_unica = win32event.CreateMutex(None, False, 'SalesTrack.AgenteImpressao')
    if win32api.GetLastError() == winerror.ERROR_ALREADY_EXISTS:
        log.info('O Agente de Impressao ja esta em execucao neste computador.')
        return 0

    try:
        # Só 127.0.0.1: o agente não fica exposto na rede
        servidor = make_server('127.0.0.1', PORTA, app, threaded=True)
    except OSError as e:
        log.error('Nao foi possivel abrir a porta %s: %s', PORTA, e)
        return 1

    log.info('=' * 60)
    log.info('SalesTrack - Agente de Impressao v%s', VERSAO)
    log.info('Rodando em http://127.0.0.1:%s', PORTA)
    if impressao.ARQUIVO_SIMULACAO:
        log.info('MODO SIMULACAO: impressoes gravadas em %s', impressao.ARQUIVO_SIMULACAO)
    if sys.stderr is not None:
        log.info('Deixe esta janela aberta enquanto o agente estiver em uso.')
    log.info('=' * 60)

    try:
        servidor.serve_forever()
    finally:
        win32api.CloseHandle(instancia_unica)
    return 0


if __name__ == '__main__':
    sys.exit(principal())
