# -*- coding: utf-8 -*-
"""
Unit tests for LicencaService: license retrieval, status verification,
expiration validation, and license update constraints.
"""
import pytest
import json
from datetime import date, timedelta
from unittest.mock import patch
from app.Services.licenca_service import LicencaService

DADOS_EMPRESA_OK = json.dumps({
    'cadastro': {'razaoSocial': 'Pamonharia Grão de Milho LTDA', 'cnpj': '12.345.678/0001-90'}
})

class TestLicencaServiceUnit:

    @patch('app.Services.licenca_service.LicencaRepository.get')
    def test_obter_licenca_inexistente(self, mock_get):
        """Validates that a missing license row returns None gracefully."""
        mock_get.return_value = None
        res = LicencaService.obter()
        assert res['status'] == 200
        assert res['licenca'] is None

    @patch('app.Services.licenca_service.ConfiguracaoRepository.get')
    @patch('app.Services.licenca_service.LicencaRepository.get')
    def test_obter_licenca_ativa(self, mock_get, mock_cfg_get):
        """Validates proper date serialization and active status for a valid license."""
        mock_cfg_get.return_value = DADOS_EMPRESA_OK
        today = date.today()
        mock_get.return_value = {
            'idLicenca': 1,
            'cnpj': '12.345.678/0001-90',
            'razaoSocial': 'Pamonharia Grão de Milho',
            'status': 'ativa',
            'dataInicio': today,
            'dataVencimento': today + timedelta(days=365)
        }
        res = LicencaService.obter()
        assert res['status'] == 200
        lic = res['licenca']
        assert lic['ativa'] is True
        assert lic['dataInicio'] == today.isoformat()
        assert lic['dadosEmpresaConfigurados'] is True

    @patch('app.Services.licenca_service.ConfiguracaoRepository.get')
    def test_dados_empresa_configurados_rules(self, mock_cfg_get):
        """Validates that company data counts as configured only with name AND CNPJ filled."""
        casos = [
            (None, False),
            ('{json quebrado', False),
            (json.dumps({}), False),
            (json.dumps({'cadastro': {'razaoSocial': 'Empresa', 'cnpj': ''}}), False),
            (json.dumps({'cadastro': {'razaoSocial': '   ', 'cnpj': '12.345.678/0001-90'}}), False),
            (json.dumps({'cadastro': {'nomeFantasia': 'Fantasia', 'cnpj': '12.345.678/0001-90'}}), True),
            (DADOS_EMPRESA_OK, True),
        ]
        for valor, esperado in casos:
            mock_cfg_get.return_value = valor
            assert LicencaService._dados_empresa_configurados() is esperado, valor

    @patch('app.Services.licenca_service.ConfiguracaoRepository.get')
    @patch('app.Services.licenca_service.LicencaRepository.get')
    def test_motivo_bloqueio(self, mock_get, mock_cfg_get):
        """Validates the exact blocking reason: inactive license first, then missing company data."""
        today = date.today()

        # Expired license -> license message (even with company data configured)
        mock_get.return_value = {'status': 'ativa', 'dataVencimento': today - timedelta(days=1)}
        mock_cfg_get.return_value = DADOS_EMPRESA_OK
        assert "Licença inativa" in LicencaService.motivo_bloqueio()
        assert LicencaService.licenca_permite_acesso() is False

        # Active license but no company data -> company data message
        mock_get.return_value = {'status': 'ativa', 'dataVencimento': None}
        mock_cfg_get.return_value = None
        assert "dados da empresa" in LicencaService.motivo_bloqueio()
        assert LicencaService.licenca_permite_acesso() is False

        # Active license and company data configured -> released
        mock_cfg_get.return_value = DADOS_EMPRESA_OK
        assert LicencaService.motivo_bloqueio() is None
        assert LicencaService.licenca_permite_acesso() is True

    def test_esta_ativa_rules(self):
        """Validates status logic: non-active status or expired date turns ativa to False."""
        today = date.today()

        # No row -> returns True (does not block fresh installs)
        assert LicencaService._esta_ativa(None) is True

        # Suspended status
        assert LicencaService._esta_ativa({'status': 'suspensa', 'dataVencimento': today + timedelta(days=10)}) is False

        # Expired date
        assert LicencaService._esta_ativa({'status': 'ativa', 'dataVencimento': today - timedelta(days=1)}) is False

        # Active with future expiration
        assert LicencaService._esta_ativa({'status': 'ativa', 'dataVencimento': today + timedelta(days=10)}) is True

        # Active without expiration
        assert LicencaService._esta_ativa({'status': 'ativa', 'dataVencimento': None}) is True

    def test_atualizar_missing_data_inicio(self):
        """Validates that dataInicio is mandatory when updating license."""
        res = LicencaService.atualizar({'status': 'ativa'})
        assert res['status'] == 400
        assert res['error'] == 'Data de início é obrigatória.'

    @patch('app.Services.licenca_service.ConfiguracaoRepository.get')
    @patch('app.Services.licenca_service.LicencaRepository.upsert')
    def test_atualizar_ativa_blocked_without_company_data(self, mock_upsert, mock_cfg_get):
        """Validates that the license cannot be released (ativa) before company data is configured."""
        mock_cfg_get.return_value = None
        res = LicencaService.atualizar({'status': 'ativa', 'dataInicio': date.today().isoformat()})
        assert res['status'] == 400
        assert "dados da empresa" in res['error']
        mock_upsert.assert_not_called()

    @patch('app.Services.licenca_service.ConfiguracaoRepository.get')
    @patch('app.Services.licenca_service.LicencaRepository.upsert')
    @patch('app.Services.licenca_service.LicencaRepository.get')
    def test_atualizar_suspensa_allowed_without_company_data(self, mock_get, mock_upsert, mock_cfg_get):
        """Validates that non-releasing statuses do not depend on company data."""
        mock_cfg_get.return_value = None
        mock_get.return_value = {'status': 'suspensa', 'dataInicio': date.today(), 'dataVencimento': None}
        dados = {'status': 'suspensa', 'dataInicio': date.today().isoformat()}
        res = LicencaService.atualizar(dados)
        assert res['status'] == 200
        mock_upsert.assert_called_once_with(dados)

    @patch('app.Services.licenca_service.ConfiguracaoRepository.get')
    @patch('app.Services.licenca_service.LicencaRepository.upsert')
    @patch('app.Services.licenca_service.LicencaRepository.get')
    def test_atualizar_success(self, mock_get, mock_upsert, mock_cfg_get):
        """Validates successful license update."""
        mock_cfg_get.return_value = DADOS_EMPRESA_OK
        today = date.today()
        mock_get.return_value = {
            'status': 'ativa',
            'dataInicio': today,
            'dataVencimento': None
        }
        dados = {'status': 'ativa', 'dataInicio': today.isoformat()}
        res = LicencaService.atualizar(dados)
        assert res['status'] == 200
        mock_upsert.assert_called_once_with(dados)
