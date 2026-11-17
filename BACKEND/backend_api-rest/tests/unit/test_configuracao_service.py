# -*- coding: utf-8 -*-
"""
Unit tests for ConfiguracaoService: boolean parsing for negative stock,
JSON parsing for company metadata, and configuration updates.
"""
import pytest
import json
from unittest.mock import patch
from app.Services.configuracao_service import ConfiguracaoService

class TestConfiguracaoServiceUnit:

    @patch('app.Services.configuracao_service.ConfiguracaoRepository.get_all')
    def test_listar_configuracoes_defaults(self, mock_get_all):
        """Validates configuration retrieval with valid company JSON."""
        mock_get_all.return_value = {
            'permiteEstoqueNegativo': 'true',
            'dadosEmpresa': json.dumps({'nomeFantasia': 'Peg Pag Borges', 'cnpj': '11.222.333/0001-44'})
        }
        res = ConfiguracaoService.listar()
        assert res['status'] == 200
        cfg = res['configuracoes']
        assert cfg['permiteEstoqueNegativo'] is True
        assert cfg['dadosEmpresa']['nomeFantasia'] == 'Peg Pag Borges'

    @patch('app.Services.configuracao_service.ConfiguracaoRepository.get_all')
    def test_listar_configuracoes_corrupted_json(self, mock_get_all):
        """Validates that malformed JSON in dadosEmpresa is handled safely as None."""
        mock_get_all.return_value = {
            'permiteEstoqueNegativo': 'false',
            'dadosEmpresa': '{corrupted json string'
        }
        res = ConfiguracaoService.listar()
        assert res['status'] == 200
        assert res['configuracoes']['permiteEstoqueNegativo'] is False
        assert res['configuracoes']['dadosEmpresa'] is None

    @patch('app.Services.configuracao_service.ConfiguracaoRepository.set')
    @patch('app.Services.configuracao_service.ConfiguracaoRepository.get_all')
    def test_atualizar_configuracoes(self, mock_get_all, mock_set):
        """Validates configuration update for negative stock flag and company data."""
        mock_get_all.return_value = {
            'permiteEstoqueNegativo': 'true',
            'dadosEmpresa': None
        }
        res = ConfiguracaoService.atualizar({'permiteEstoqueNegativo': True})
        assert res['status'] == 200
        mock_set.assert_called_with('permiteEstoqueNegativo', True)
