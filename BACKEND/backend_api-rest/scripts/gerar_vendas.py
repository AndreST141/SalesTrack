import argparse
import json
import random
import sys
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


FORMAS_PAGAMENTO = [
    "dinheiro",
    "cartao_credito",
    "cartao_debito",
    "pix",
]


def money(value):
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def data_aleatoria(data_inicio, data_fim):
    """Gera uma data/hora aleatoria entre data_inicio e data_fim."""
    delta = data_fim - data_inicio
    segundos_totais = int(delta.total_seconds())
    segundos_aleatorios = random.randint(0, max(0, segundos_totais))
    data = data_inicio + timedelta(seconds=segundos_aleatorios)
    return data.strftime('%Y-%m-%d %H:%M:%S')


def request_json(method, url, payload=None, token=None):
    data = None
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json; charset=utf-8",
    }

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    request = Request(url, data=data, headers=headers, method=method)

    try:
        with urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} falhou com HTTP {error.code}: {body}") from error
    except URLError as error:
        raise RuntimeError(f"Nao foi possivel conectar em {url}: {error.reason}") from error


def login(api_url, email, senha):
    response = request_json("POST", f"{api_url}/login", {"email": email, "senha": senha})
    token = response.get("token")
    if not token:
        raise RuntimeError("Login nao retornou token. Confira email/senha.")
    return token


def gerar_venda(produtos, clientes, data_inicio=None, data_fim=None):
    produtos_com_estoque = [p for p in produtos if int(p.get("estoque") or 0) > 0]
    if not produtos_com_estoque:
        raise RuntimeError("Nao ha produtos com estoque disponivel para gerar vendas.")

    quantidade_itens = random.randint(1, min(3, len(produtos_com_estoque)))
    produtos_sorteados = random.sample(produtos_com_estoque, quantidade_itens)
    itens = []

    for produto in produtos_sorteados:
        estoque = int(produto.get("estoque") or 0)
        quantidade = random.randint(1, min(3, estoque))
        preco = money(produto["preco"])
        subtotal = money(preco * quantidade)

        produto["estoque"] = estoque - quantidade
        itens.append({
            "idProduto": produto["idProduto"],
            "quantidade": quantidade,
            "precoUnitario": preco,
            "subtotal": subtotal,
        })

    valor_total = money(sum(item["subtotal"] for item in itens))
    desconto = random.choice([0, 0, 0, 5, 10])
    desconto = money(min(desconto, valor_total * 0.25))
    valor_final = money(valor_total - desconto)
    forma_pagamento = random.choice(FORMAS_PAGAMENTO)
    cliente = random.choice(clientes) if clientes else None

    venda = {
        "idCliente": cliente["idCliente"] if cliente else None,
        "valorTotal": valor_total,
        "desconto": desconto,
        "valorFinal": valor_final,
        "formaPagamento": forma_pagamento,
        "pagamentos": [{"forma": forma_pagamento, "valor": valor_final}],
        "observacoes": "Venda gerada automaticamente para testes.",
        "itens": itens,
    }

    # Adiciona data customizada se o intervalo foi fornecido
    if data_inicio and data_fim:
        venda["dataVenda"] = data_aleatoria(data_inicio, data_fim)

    return venda


def main():
    parser = argparse.ArgumentParser(description="Gera vendas de teste pela API do SalesTrack.")
    parser.add_argument("--quantidade", "-q", type=int, default=20, help="Quantidade de vendas para gerar.")
    parser.add_argument("--api-url", default="http://localhost:5000/api", help="URL base da API.")
    parser.add_argument("--email", default="admin@salestrack.com", help="Email do usuario para login.")
    parser.add_argument("--senha", default="admin123", help="Senha do usuario para login.")
    parser.add_argument("--data-inicio", type=str, default=None, help="Data inicio no formato YYYY-MM-DD (ex: 2026-03-01)")
    parser.add_argument("--data-fim", type=str, default=None, help="Data fim no formato YYYY-MM-DD (ex: 2026-03-31)")
    args = parser.parse_args()

    if args.quantidade <= 0:
        raise RuntimeError("A quantidade precisa ser maior que zero.")

    # Processar datas
    data_inicio = None
    data_fim = None
    if args.data_inicio and args.data_fim:
        data_inicio = datetime.strptime(args.data_inicio, "%Y-%m-%d")
        data_fim = datetime.strptime(args.data_fim, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        if data_inicio > data_fim:
            raise RuntimeError("A data de inicio nao pode ser maior que a data de fim.")
        print(f"Gerando vendas com datas entre {args.data_inicio} e {args.data_fim}")
    elif args.data_inicio or args.data_fim:
        raise RuntimeError("Voce precisa informar ambas --data-inicio e --data-fim.")

    api_url = args.api_url.rstrip("/")
    token = login(api_url, args.email, args.senha)
    produtos = request_json("GET", f"{api_url}/produtos", token=token)
    clientes = request_json("GET", f"{api_url}/clientes", token=token)

    if not produtos:
        raise RuntimeError("Nao ha produtos cadastrados para vender.")

    vendas_criadas = 0
    for numero in range(1, args.quantidade + 1):
        venda = gerar_venda(produtos, clientes, data_inicio, data_fim)
        response = request_json("POST", f"{api_url}/vendas", venda, token=token)
        data_info = f" em {venda['dataVenda']}" if venda.get('dataVenda') else ""
        vendas_criadas += 1
        print(f"Venda {numero}/{args.quantidade} criada com id {response.get('id')}{data_info}")

    print(f"\nPronto: {vendas_criadas} vendas geradas.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Erro: {error}", file=sys.stderr)
        sys.exit(1)
