# -*- coding: utf-8 -*-
"""
Integration tests for Relatorios API:
- GET /api/relatorio/vendas
- GET /api/relatorio/mais-vendidos
- GET /api/relatorio/sem-movimento
- GET /api/relatorio/estoque
"""
import pytest
from datetime import datetime
from unittest.mock import patch

class TestRelatoriosApiIntegration:

    def test_relatorios_unauthenticated(self, client):
        """Validates that all reports endpoints require authentication."""
        assert client.get('/api/relatorio/vendas').status_code == 401
        assert client.get('/api/relatorio/mais-vendidos').status_code == 401
        assert client.get('/api/relatorio/sem-movimento').status_code == 401
        assert client.get('/api/relatorio/estoque').status_code == 401

    def test_relatorio_vendas_missing_dates(self, client, admin_headers):
        """Validates that GET /api/relatorio/vendas without dates returns 400."""
        res = client.get('/api/relatorio/vendas', headers=admin_headers)
        assert res.status_code == 400
        data = res.get_json()
        assert "data_inicio e data_fim" in data['error']

    @patch('app.Services.relatorio_service.RelatorioRepository.get_vendas_periodo')
    def test_relatorio_vendas_success(self, mock_repo, client, admin_headers):
        """Validates GET /api/relatorio/vendas with valid date parameters."""
        mock_repo.return_value = [{
            'idVenda': 1,
            'valorTotal': '100.00',
            'desconto': '0.00',
            'valorFinal': '100.00',
            'dataVenda': datetime(2026, 10, 15, 12, 0, 0),
            'pagamentos': []
        }]
        res = client.get('/api/relatorio/vendas?data_inicio=2026-10-01&data_fim=2026-10-31', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['valorFinal'] == 100.0

    @patch('app.Services.relatorio_service.RelatorioRepository.get_produtos_mais_vendidos')
    def test_relatorio_mais_vendidos_success(self, mock_repo, client, admin_headers):
        """Validates GET /api/relatorio/mais-vendidos."""
        mock_repo.return_value = [{
            'idProduto': 1,
            'nome': 'Bolo',
            'totalVendido': '20',
            'receitaTotal': '100.00',
            'precoMedio': '5.00'
        }]
        res = client.get('/api/relatorio/mais-vendidos?data_inicio=2026-10-01&data_fim=2026-10-31', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['totalVendido'] == 20

    @patch('app.Services.relatorio_service.RelatorioRepository.get_produtos_sem_movimento')
    def test_relatorio_sem_movimento_success(self, mock_repo, client, admin_headers):
        """Validates GET /api/relatorio/sem-movimento."""
        mock_repo.return_value = [{
            'idProduto': 9,
            'nome': 'Sem Venda',
            'preco': '15.00',
            'estoque': 5,
            'valorEstoque': '75.00',
            'dataCadastro': datetime(2025, 5, 1)
        }]
        res = client.get('/api/relatorio/sem-movimento?data_inicio=2026-01-01&data_fim=2026-10-31', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['estoque'] == 5

    @patch('app.Services.relatorio_service.RelatorioRepository.get_estoque_detalhado')
    def test_relatorio_estoque_success(self, mock_repo, client, admin_headers):
        """Validates GET /api/relatorio/estoque."""
        mock_repo.return_value = [{
            'idProduto': 2,
            'nome': 'Curau',
            'preco': '6.00',
            'estoque': 15,
            'valorEstoque': '90.00',
            'receitaTotal': '180.00',
            'totalVendido': '30',
            'ultimaVenda': None
        }]
        res = client.get('/api/relatorio/estoque', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1
        assert data[0]['valorEstoque'] == 90.0


REPO = 'app.Services.relatorio_service.RelatorioRepository.'
PERIODO = '?data_inicio=2026-10-01&data_fim=2026-10-31'

# (url, método do repository que a rota chama)
ENDPOINTS = [
    ('/api/relatorio/vendas' + PERIODO,        'get_vendas_periodo'),
    ('/api/relatorio/mais-vendidos' + PERIODO, 'get_produtos_mais_vendidos'),
    ('/api/relatorio/sem-movimento' + PERIODO, 'get_produtos_sem_movimento'),
    ('/api/relatorio/estoque',                 'get_estoque_detalhado'),
]


class TestRelatoriosRbac:
    """Relatórios expõem faturamento: só admin e técnico (igual à tela
    /relatorios no frontend). Vendedor e supervisor recebem 403 sem que o
    banco seja sequer consultado."""

    @pytest.mark.parametrize('url,metodo', ENDPOINTS)
    @pytest.mark.parametrize('perfil', ['vendedor', 'supervisor'])
    def test_perfis_sem_acesso_recebem_403(self, perfil, url, metodo, client, request):
        headers = request.getfixturevalue(f'{perfil}_headers')
        with patch(REPO + metodo) as mock_repo:
            res = client.get(url, headers=headers)
        assert res.status_code == 403
        assert res.get_json()['error'] == 'Acesso não autorizado.'
        mock_repo.assert_not_called()

    @pytest.mark.parametrize('url,metodo', ENDPOINTS)
    @pytest.mark.parametrize('perfil', ['admin', 'tecnico'])
    def test_perfis_com_acesso_recebem_200(self, perfil, url, metodo, client, request):
        headers = request.getfixturevalue(f'{perfil}_headers')
        with patch(REPO + metodo, return_value=[]) as mock_repo:
            res = client.get(url, headers=headers)
        assert res.status_code == 200
        assert res.get_json() == []
        mock_repo.assert_called_once()

    def test_permissao_checada_antes_da_validacao(self, client, vendedor_headers):
        """Vendedor recebe 403 mesmo com parâmetros inválidos (não vaza 400 com detalhes)."""
        res = client.get('/api/relatorio/vendas?data_inicio=abc', headers=vendedor_headers)
        assert res.status_code == 403


class TestRelatoriosValidacaoParametros:
    """Parâmetros inválidos devolvem 400 explícito — nunca 500 nem 200 vazio."""

    @pytest.mark.parametrize('endpoint', ['vendas', 'mais-vendidos', 'sem-movimento'])
    @pytest.mark.parametrize('query', ['', '?data_inicio=2026-10-01', '?data_fim=2026-10-31', '?data_inicio=&data_fim='])
    def test_periodo_ausente(self, endpoint, query, client, admin_headers):
        res = client.get(f'/api/relatorio/{endpoint}{query}', headers=admin_headers)
        assert res.status_code == 400
        assert 'data_inicio e data_fim' in res.get_json()['error']

    @pytest.mark.parametrize('endpoint', ['vendas', 'mais-vendidos', 'sem-movimento'])
    @pytest.mark.parametrize('inicio,fim', [
        ('abc', '2026-10-31'),
        ('2026-10-01', 'xyz'),
        ('01/10/2026', '31/10/2026'),
        ('2026-02-30', '2026-03-01'),
        ("2026-10-01' OR '1'='1", '2026-10-31'),
    ])
    def test_data_em_formato_invalido(self, endpoint, inicio, fim, client, admin_headers):
        with patch(REPO + 'get_vendas_periodo') as m1, \
             patch(REPO + 'get_produtos_mais_vendidos') as m2, \
             patch(REPO + 'get_produtos_sem_movimento') as m3:
            res = client.get(f'/api/relatorio/{endpoint}',
                             query_string={'data_inicio': inicio, 'data_fim': fim},
                             headers=admin_headers)
        assert res.status_code == 400
        assert 'AAAA-MM-DD' in res.get_json()['error']
        for m in (m1, m2, m3):
            m.assert_not_called()

    @pytest.mark.parametrize('endpoint', ['vendas', 'mais-vendidos', 'sem-movimento'])
    def test_data_inicial_depois_da_final(self, endpoint, client, admin_headers):
        res = client.get(f'/api/relatorio/{endpoint}?data_inicio=2026-10-31&data_fim=2026-10-01',
                         headers=admin_headers)
        assert res.status_code == 400
        assert 'posterior' in res.get_json()['error']

    @patch(REPO + 'get_vendas_periodo', return_value=[])
    def test_periodo_de_um_dia_e_aceito(self, mock_repo, client, admin_headers):
        res = client.get('/api/relatorio/vendas?data_inicio=2026-10-15&data_fim=2026-10-15',
                         headers=admin_headers)
        assert res.status_code == 200
        mock_repo.assert_called_once_with('2026-10-15', '2026-10-15')

    @pytest.mark.parametrize('limite', ['abc', '0', '-5', '501', '2.5', ''])
    def test_limite_invalido(self, limite, client, admin_headers):
        with patch(REPO + 'get_produtos_mais_vendidos') as mock_repo:
            res = client.get(f'/api/relatorio/mais-vendidos{PERIODO}&limite={limite}',
                             headers=admin_headers)
        assert res.status_code == 400
        assert 'limite' in res.get_json()['error']
        mock_repo.assert_not_called()

    @pytest.mark.parametrize('query,esperado', [('', 100), ('&limite=1', 1), ('&limite=500', 500)])
    def test_limite_valido_chega_como_inteiro(self, query, esperado, client, admin_headers):
        with patch(REPO + 'get_produtos_mais_vendidos', return_value=[]) as mock_repo:
            res = client.get(f'/api/relatorio/mais-vendidos{PERIODO}{query}', headers=admin_headers)
        assert res.status_code == 200
        mock_repo.assert_called_once_with('2026-10-01', '2026-10-31', esperado)
