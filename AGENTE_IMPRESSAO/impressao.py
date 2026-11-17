"""Envio do comprovante para a impressora.

O agente recebe o comprovante já montado pelo frontend, como linhas de texto
de largura fixa, e só cuida de fazê-las chegar ao papel. Três caminhos:

  termica_spooler  térmica instalada no Windows  -> ESC/POS (RAW) pelo spooler
  termica_serial   térmica em porta serial (COM) -> ESC/POS direto na porta
  comum_windows    impressora comum / A4         -> texto desenhado pelo driver
"""
import os
import re
import threading
import unicodedata

import pywintypes
import serial
import win32con
import win32print
import win32ui

NOME_DOCUMENTO = 'Comprovante SalesTrack'

# Só para desenvolvimento/testes sem impressora: se definida, nada chega ao
# dispositivo — o trabalho de impressão é gravado neste arquivo (os bytes
# ESC/POS nos tipos térmicos; nos tipos via spooler é o próprio spooler que
# grava, então "Microsoft Print to PDF" + comum_windows gera um PDF).
ARQUIVO_SIMULACAO = os.getenv('SALESTRACK_AGENTE_SIMULACAO') or None

TIPOS = ('termica_spooler', 'termica_serial', 'comum_windows')
BAUD_RATES = (9600, 19200, 38400, 57600, 115200)
COLUNAS_MIN, COLUNAS_MAX = 24, 64
MAX_LINHAS = 600

# acentuação -> (número da tabela no comando ESC t, codec do Python).
# CP850 e CP860 são as tabelas com os acentos do português presentes em
# praticamente toda térmica ESC/POS; "sem_acentos" serve para as demais.
CODEPAGES = {
    'cp850':       (b'\x02', 'cp850'),
    'cp860':       (b'\x03', 'cp860'),
    'sem_acentos': (None, 'ascii'),
}

ESC = b'\x1b'
GS = b'\x1d'
# Linhas em branco no fim, para o texto passar da serrilha/guilhotina
LINHAS_AVANCO_FINAL = 4

# Largura útil (mm) das bobinas de 80 mm e de 58 mm. Na impressora comum o
# comprovante é desenhado com essa largura e, em folha maior (A4), centralizado.
LARGURA_UTIL_80MM = 72
LARGURA_UTIL_58MM = 48
COLUNAS_MAX_58MM = 32

# Uma impressão por vez: dois trabalhos simultâneos na mesma porta se misturam
_trava = threading.Lock()


class ErroImpressao(Exception):
    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.status = status


# ─── Validação ─────────────────────────────────────────────────────

def validar_config(config):
    if not isinstance(config, dict):
        raise ErroImpressao('Configuração da impressora não informada.')

    tipo = config.get('tipo')
    if tipo not in TIPOS:
        raise ErroImpressao('Tipo de impressora inválido.')

    try:
        colunas = int(config.get('colunas'))
    except (TypeError, ValueError):
        raise ErroImpressao('Largura do papel (colunas) inválida.')
    if not COLUNAS_MIN <= colunas <= COLUNAS_MAX:
        raise ErroImpressao('Largura do papel (colunas) inválida.')

    acentuacao = config.get('acentuacao', 'cp850')
    if acentuacao not in CODEPAGES:
        raise ErroImpressao('Opção de acentuação inválida.')

    normalizada = {
        'tipo': tipo,
        'colunas': colunas,
        'acentuacao': acentuacao,
        'cortarPapel': bool(config.get('cortarPapel', True)),
    }

    if tipo == 'termica_serial':
        porta = str(config.get('portaSerial') or '').strip().upper()
        if not re.fullmatch(r'COM\d{1,3}', porta):
            raise ErroImpressao('Selecione a porta COM da impressora.')
        try:
            baud = int(config.get('baudRate'))
        except (TypeError, ValueError):
            baud = None
        if baud not in BAUD_RATES:
            raise ErroImpressao('Velocidade (baud rate) inválida.')
        normalizada.update(portaSerial=porta, baudRate=baud)
    else:
        impressora = str(config.get('impressora') or '').strip()
        if not impressora:
            raise ErroImpressao('Selecione a impressora.')
        normalizada['impressora'] = impressora

    return normalizada


def validar_linhas(linhas):
    """Cada linha: {'texto': str, 'negrito': bool, 'duplo': bool} — 'duplo' é
    altura dupla (a largura não muda, então as colunas continuam valendo)."""
    if not isinstance(linhas, list) or not linhas:
        raise ErroImpressao('Nada para imprimir.')
    if len(linhas) > MAX_LINHAS:
        raise ErroImpressao('Comprovante grande demais.')

    normalizadas = []
    for linha in linhas:
        if not isinstance(linha, dict) or not isinstance(linha.get('texto', ''), str):
            raise ErroImpressao('Linha do comprovante inválida.')
        # Caracteres de controle no texto virariam comandos na impressora
        texto = ''.join(ch if ch.isprintable() else ' ' for ch in linha.get('texto', ''))
        normalizadas.append((texto, bool(linha.get('negrito')), bool(linha.get('duplo'))))
    return normalizadas


# ─── ESC/POS ───────────────────────────────────────────────────────

def _sem_acentos(texto):
    return unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')


def _codificar(texto, codec):
    saida = bytearray()
    for ch in texto:
        try:
            saida += ch.encode(codec)
        except UnicodeEncodeError:
            # Fora da tabela da impressora: cai para a letra sem acento
            saida += _sem_acentos(ch).encode('ascii', 'ignore') or b'?'
    return bytes(saida)


def montar_escpos(linhas, config):
    tabela, codec = CODEPAGES[config['acentuacao']]

    dados = bytearray(ESC + b'@')                    # reinicia a impressora
    if tabela:
        dados += ESC + b't' + tabela                 # tabela de caracteres
    for texto, negrito, duplo in linhas:
        dados += ESC + b'E' + (b'\x01' if negrito else b'\x00')
        dados += GS + b'!' + (b'\x01' if duplo else b'\x00')   # altura dupla
        dados += _codificar(texto[:config['colunas']], codec) + b'\n'
    dados += ESC + b'E\x00' + GS + b'!\x00'
    dados += b'\n' * LINHAS_AVANCO_FINAL
    if config['cortarPapel']:
        dados += GS + b'V\x01'                       # corte parcial
    return bytes(dados)


def _enviar_spooler_raw(impressora, dados):
    try:
        handle = win32print.OpenPrinter(impressora)
        try:
            win32print.StartDocPrinter(handle, 1, (NOME_DOCUMENTO, ARQUIVO_SIMULACAO, 'RAW'))
            try:
                win32print.StartPagePrinter(handle)
                win32print.WritePrinter(handle, dados)
                win32print.EndPagePrinter(handle)
            finally:
                win32print.EndDocPrinter(handle)
        finally:
            win32print.ClosePrinter(handle)
    except pywintypes.error as e:
        raise ErroImpressao(f'Não foi possível imprimir em "{impressora}": {e.strerror}', 502)


def _enviar_serial(porta, baud, dados):
    if ARQUIVO_SIMULACAO:
        with open(ARQUIVO_SIMULACAO, 'wb') as arquivo:
            arquivo.write(dados)
        return
    try:
        with serial.Serial(porta, baudrate=baud, timeout=2, write_timeout=5) as conexao:
            conexao.write(dados)
            conexao.flush()
    except serial.SerialException as e:
        raise ErroImpressao(f'Não foi possível imprimir na porta {porta}: {e}', 502)


# ─── Impressora comum (driver do Windows) ──────────────────────────

def _imprimir_pelo_driver(impressora, linhas, colunas):
    dc = win32ui.CreateDC()
    try:
        dc.CreatePrinterDC(impressora)
    except win32ui.error:
        raise ErroImpressao(f'Impressora "{impressora}" não encontrada no Windows.', 502)

    documento_aberto = False
    try:
        largura_pagina = dc.GetDeviceCaps(win32con.HORZRES)
        altura_pagina = dc.GetDeviceCaps(win32con.VERTRES)
        dpi_x = dc.GetDeviceCaps(win32con.LOGPIXELSX)
        dpi_y = dc.GetDeviceCaps(win32con.LOGPIXELSY)

        largura_mm = LARGURA_UTIL_58MM if colunas <= COLUNAS_MAX_58MM else LARGURA_UTIL_80MM
        largura_cupom = min(largura_pagina, int(dpi_x * largura_mm / 25.4))
        largura_caractere = max(1, largura_cupom // colunas)
        altura_linha = max(1, round(largura_caractere * 1.9 * dpi_y / dpi_x))
        margem_esquerda = (largura_pagina - largura_caractere * colunas) // 2

        fontes = {}

        def fonte(negrito, duplo):
            chave = (negrito, duplo)
            if chave not in fontes:
                fontes[chave] = win32ui.CreateFont({
                    'name':   'Consolas',
                    'height': altura_linha * (2 if duplo else 1),
                    'width':  largura_caractere,
                    'weight': 700 if negrito else 400,
                })
            return fontes[chave]

        if ARQUIVO_SIMULACAO:
            dc.StartDoc(NOME_DOCUMENTO, ARQUIVO_SIMULACAO)
        else:
            dc.StartDoc(NOME_DOCUMENTO)
        documento_aberto = True
        dc.StartPage()
        dc.SetBkMode(win32con.TRANSPARENT)

        y = 0
        for texto, negrito, duplo in linhas:
            altura = altura_linha * (2 if duplo else 1)
            if y + altura > altura_pagina:
                dc.EndPage()
                dc.StartPage()
                y = 0
            recorte = texto[:colunas]
            if recorte:
                dc.SelectObject(fonte(negrito, duplo))
                # Avanço fixo por caractere: cada um ocupa exatamente uma
                # coluna, igual à térmica, seja qual for a métrica da fonte
                dc.ExtTextOut(margem_esquerda, y, 0, None, recorte,
                              (largura_caractere,) * len(recorte))
            y += altura

        dc.EndPage()
        dc.EndDoc()
        documento_aberto = False
    except win32ui.error as e:
        raise ErroImpressao(f'Não foi possível imprimir em "{impressora}": {e}', 502)
    finally:
        if documento_aberto:
            dc.AbortDoc()
        dc.DeleteDC()


# ─── Entrada única ─────────────────────────────────────────────────

def imprimir(config, linhas):
    """Recebe config e linhas já validadas (validar_config / validar_linhas)."""
    with _trava:
        if config['tipo'] == 'comum_windows':
            _imprimir_pelo_driver(config['impressora'], linhas, config['colunas'])
            return

        dados = montar_escpos(linhas, config)
        if config['tipo'] == 'termica_serial':
            _enviar_serial(config['portaSerial'], config['baudRate'], dados)
        else:
            _enviar_spooler_raw(config['impressora'], dados)
