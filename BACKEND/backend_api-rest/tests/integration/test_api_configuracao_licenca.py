# -*- coding: utf-8 -*-
"""
Integration tests for Configuration and License APIs:
- GET & PUT /api/configuracoes
- GET & PUT /api/licenca
Tests admin privilege enforcement and data persistence.
"""
import pytest
import json
from datetime import date
from unittest.mock import patch

DADOS_EMPRESA_OK = json.dumps({
    'cadastro': {'razaoSocial': 'Empresa Modelo LTDA', 'cnpj': '00.000.000/0001-00'}
})

class TestConfiguracaoLicencaApiIntegration:

    def test_get_configuracoes_authenticated(self, client, vendedor_headers):
        """Validates that any authenticated user can read configurations."""
        with patch('app.Services.configuracao_service.ConfiguracaoRepository.get_all') as mock_get:
            mock_get.return_value = {'permiteEstoqueNegativo': 'false', 'dadosEmpresa': None}
            res = client.get('/api/configuracoes', headers=vendedor_headers)
            assert res.status_code == 200
            data = res.get_json()
            assert 'permiteEstoqueNegativo' in data

    def test_put_configuracoes_as_vendedor_forbidden(self, client, vendedor_headers):
        """Validates that vendedor cannot update system configurations (403)."""
        res = client.put('/api/configuracoes', headers=vendedor_headers, json={'permiteEstoqueNegativo': True})
        assert res.status_code == 403

    @patch('app.Services.configuracao_service.ConfiguracaoRepository.set')
    @patch('app.Services.configuracao_service.ConfiguracaoRepository.get_all')
    def test_put_configuracoes_as_admin_success(self, mock_get, mock_set, client, admin_headers):
        """Validates that admin can update configurations."""
        mock_get.return_value = {'permiteEstoqueNegativo': 'true', 'dadosEmpresa': None}
        res = client.put('/api/configuracoes', headers=admin_headers, json={'permiteEstoqueNegativo': True})
        assert res.status_code == 200
        data = res.get_json()
        assert data['permiteEstoqueNegativo'] is True

    def test_get_licenca_as_vendedor_forbidden(self, client, vendedor_headers):
        """Validates that vendedor cannot access license endpoint."""
        res = client.get('/api/licenca', headers=vendedor_headers)
        assert res.status_code == 403

    @patch('app.Services.licenca_service.ConfiguracaoRepository.get')
    @patch('app.Services.licenca_service.LicencaRepository.get')
    def test_get_licenca_as_admin_success(self, mock_get, mock_cfg_get, client, admin_headers):
        """Validates that admin can inspect system license."""
        mock_cfg_get.return_value = DADOS_EMPRESA_OK
        mock_get.return_value = {
            'idLicenca': 1,
            'cnpj': '00.000.000/0001-00',
            'razaoSocial': 'Empresa Modelo',
            'identificador': 'LIC-123',
            'status': 'ativa',
            'dataInicio': date.today(),
            'dataVencimento': None
        }
        res = client.get('/api/licenca', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['status'] == 'ativa'
        assert data['ativa'] is True
        assert data['dadosEmpresaConfigurados'] is True

    @patch('app.Services.licenca_service.ConfiguracaoRepository.get')
    @patch('app.Services.licenca_service.LicencaRepository.upsert')
    def test_put_licenca_ativa_without_company_data(self, mock_upsert, mock_cfg_get, client, admin_headers):
        """Validates that releasing the license before configuring company data returns 400."""
        mock_cfg_get.return_value = None
        payload = {'dataInicio': date.today().isoformat(), 'status': 'ativa'}
        res = client.put('/api/licenca', headers=admin_headers, json=payload)
        assert res.status_code == 400
        assert "dados da empresa" in res.get_json()['error']
        mock_upsert.assert_not_called()

    @patch('app.Services.licenca_service.ConfiguracaoRepository.get')
    @patch('app.Services.licenca_service.LicencaRepository.upsert')
    @patch('app.Services.licenca_service.LicencaRepository.get')
    def test_put_licenca_as_admin_success(self, mock_get, mock_upsert, mock_cfg_get, client, admin_headers):
        """Validates license update by admin."""
        mock_cfg_get.return_value = DADOS_EMPRESA_OK
        today = date.today()
        mock_get.return_value = {'status': 'ativa', 'dataInicio': today, 'dataVencimento': None}
        payload = {'dataInicio': today.isoformat(), 'status': 'ativa'}
        res = client.put('/api/licenca', headers=admin_headers, json=payload)
        assert res.status_code == 200
        data = res.get_json()
        assert data['status'] == 'ativa'
