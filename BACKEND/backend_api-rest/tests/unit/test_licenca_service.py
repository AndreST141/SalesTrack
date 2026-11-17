# -*- coding: utf-8 -*-
"""
Unit tests for LicencaService: license retrieval, status verification,
expiration validation, and license update constraints.
"""
import pytest
from datetime import date, timedelta
from unittest.mock import patch
from app.Services.licenca_service import LicencaService

class TestLicencaServiceUnit:

    @patch('app.Services.licenca_service.LicencaRepository.get')
    def test_obter_licenca_inexistente(self, mock_get):
        """Validates that a missing license row returns None gracefully."""
        mock_get.return_value = None
        res = LicencaService.obter()
        assert res['status'] == 200
        assert res['licenca'] is None

    @patch('app.Services.licenca_service.LicencaRepository.get')
    def test_obter_licenca_ativa(self, mock_get):
        """Validates proper date serialization and active status for a valid license."""
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

    @patch('app.Services.licenca_service.LicencaRepository.upsert')
    @patch('app.Services.licenca_service.LicencaRepository.get')
    def test_atualizar_success(self, mock_get, mock_upsert):
        """Validates successful license update."""
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
