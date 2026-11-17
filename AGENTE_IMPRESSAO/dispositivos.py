"""Descoberta dos dispositivos de impressão da máquina: impressoras instaladas
no Windows (spooler) e portas seriais (as mesmas do Gerenciador de Dispositivos)."""
import re

import win32print
from serial.tools import list_ports


def listar_impressoras():
    try:
        padrao = win32print.GetDefaultPrinter()
    except Exception:
        # O Windows levanta erro quando não há impressora padrão definida
        padrao = None

    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    impressoras = []
    for p in win32print.EnumPrinters(flags, None, 2):
        offline = bool(
            p['Attributes'] & win32print.PRINTER_ATTRIBUTE_WORK_OFFLINE
            or p['Status'] & win32print.PRINTER_STATUS_OFFLINE
        )
        impressoras.append({
            'nome':    p['pPrinterName'],
            'porta':   p['pPortName'],
            'driver':  p['pDriverName'],
            'padrao':  p['pPrinterName'] == padrao,
            'offline': offline,
        })

    # Impressora padrão primeiro, depois ordem alfabética
    return sorted(impressoras, key=lambda i: (not i['padrao'], i['nome'].lower()))


def listar_portas_seriais():
    portas = [
        {
            'porta':      p.device,
            # Nome amigável do Gerenciador de Dispositivos, ex.: "USB-SERIAL CH340 (COM3)"
            'descricao':  p.description or '',
            'fabricante': p.manufacturer or '',
        }
        for p in list_ports.comports()
    ]

    def numero(porta):
        achado = re.search(r'\d+', porta['porta'])
        return int(achado.group()) if achado else 0

    return sorted(portas, key=numero)
