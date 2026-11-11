# -*- coding: utf-8 -*-
"""
Unit tests for UserService: role validation, duplicate email prevention,
minimum password length constraints, and user deletion.
"""
import pytest
from unittest.mock import patch
from app.Services.user_service import UserService
from app.Constants.geral import Geral

class TestUserServiceUnit:

    @patch('app.Services.user_service.UserRepository.get_all')
    def test_list_users(self, mock_get_all):
        """Validates user listing."""
        mock_get_all.return_value = [{'idUsuario': 1, 'nome': 'Admin', 'tipo': 'admin'}]
        res = UserService.list()
        assert res['status'] == 200
        assert len(res['usuarios']) == 1

    def test_create_missing_fields(self):
        """Validates that missing any of nome, email, senha, tipo returns 400."""
        res = UserService.create({'nome': 'Teste', 'email': 't@s.com', 'senha': ''})
        assert res['status'] == 400
        assert res['error'] == Geral.CAMPOS_OBRIGATORIOS

    def test_create_invalid_role(self):
        """Validates that unauthorized role strings are rejected."""
        dados = {'nome': 'User Inv', 'email': 'inv@s.com', 'senha': '1234', 'tipo': 'hacker'}
        res = UserService.create(dados)
        assert res['status'] == 400
        assert res['error'] == Geral.TIPO_INVALIDO

    @patch('app.Services.user_service.UserRepository.find_by_email')
    def test_create_duplicate_email(self, mock_find_email):
        """Validates duplicate email rejection returning 409."""
        mock_find_email.return_value = {'idUsuario': 1, 'email': 'existente@salestrack.com'}
        dados = {'nome': 'Duplicado', 'email': 'existente@salestrack.com', 'senha': '1234', 'tipo': 'vendedor'}
        res = UserService.create(dados)
        assert res['status'] == 409
        assert res['error'] == Geral.USUARIO_JA_EXISTE

    @patch('app.Services.user_service.UserRepository.find_by_email')
    @patch('app.Services.user_service.UserRepository.create')
    def test_create_success(self, mock_create, mock_find_email):
        """Validates successful user creation returning 201."""
        mock_find_email.return_value = None
        mock_create.return_value = 8
        dados = {'nome': 'Novo Vendedor', 'email': 'novo@salestrack.com', 'senha': 'password123', 'tipo': 'vendedor'}
        res = UserService.create(dados)
        assert res['status'] == 201
        assert res['id'] == 8
        assert res['message'] == Geral.USUARIO_CADASTRADO

    def test_update_missing_mandatory(self):
        """Validates that update requires nome and tipo."""
        res = UserService.update(1, {'nome': '', 'tipo': 'admin'})
        assert res['status'] == 400
        assert res['error'] == Geral.CAMPOS_OBRIGATORIOS

    def test_update_short_password(self):
        """Validates that updating password with less than 4 chars is rejected."""
        res = UserService.update(1, {'nome': 'Admin', 'tipo': 'admin', 'senha': '12'})
        assert res['status'] == 400
        assert "mínimo 4 caracteres" in res['error']

    @patch('app.Services.user_service.UserRepository.update')
    def test_update_success(self, mock_update):
        """Validates successful user update."""
        res = UserService.update(1, {'nome': 'Admin Renomeado', 'tipo': 'admin', 'senha': 'nova_senha_forte'})
        assert res['status'] == 200
        assert "sucesso" in res['message']

    @patch('app.Services.user_service.UserRepository.delete')
    def test_delete_success(self, mock_delete):
        """Validates user inativation/deletion."""
        res = UserService.delete(3)
        assert res['status'] == 200
        assert "inativado" in res['message']
