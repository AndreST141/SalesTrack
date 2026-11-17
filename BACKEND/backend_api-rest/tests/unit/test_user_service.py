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

    @patch('app.Services.user_service.UserRepository.existe_gerenciavel')
    @patch('app.Services.user_service.UserRepository.update')
    def test_update_success(self, mock_update, mock_existe):
        """Validates successful user update."""
        mock_existe.return_value = True
        res = UserService.update(1, {'nome': 'Admin Renomeado', 'tipo': 'admin', 'senha': 'nova_senha_forte'})
        assert res['status'] == 200
        assert "sucesso" in res['message']
        mock_update.assert_called_once_with(1, 'Admin Renomeado', 'admin', 'nova_senha_forte')

    @patch('app.Services.user_service.UserRepository.existe_gerenciavel')
    @patch('app.Services.user_service.UserRepository.update')
    def test_update_not_manageable(self, mock_update, mock_existe):
        """Validates that a nonexistent (or tecnico) user cannot be edited through the screen."""
        mock_existe.return_value = False
        res = UserService.update(99, {'nome': 'Técnico', 'tipo': 'admin'})
        assert res['status'] == 404
        assert res['error'] == Geral.USUARIO_NAO_ENCONTRADO
        mock_update.assert_not_called()

    @patch('app.Services.user_service.UserRepository.existe_gerenciavel')
    @patch('app.Services.user_service.UserRepository.delete')
    def test_delete_success(self, mock_delete, mock_existe):
        """Validates user inativation/deletion."""
        mock_existe.return_value = True
        res = UserService.delete(3)
        assert res['status'] == 200
        assert "inativado" in res['message']
        mock_delete.assert_called_once_with(3)

    @patch('app.Services.user_service.UserRepository.existe_gerenciavel')
    @patch('app.Services.user_service.UserRepository.delete')
    def test_delete_not_manageable(self, mock_delete, mock_existe):
        """Validates that a nonexistent (or tecnico) user cannot be inactivated."""
        mock_existe.return_value = False
        res = UserService.delete(99, solicitante_id=1)
        assert res['status'] == 404
        mock_delete.assert_not_called()

    @patch('app.Services.user_service.UserRepository.delete')
    def test_delete_self_blocked(self, mock_delete):
        """Validates that an admin cannot inactivate their own user (lock-out protection)."""
        res = UserService.delete(1, solicitante_id=1)
        assert res['status'] == 400
        assert "próprio usuário" in res['error']
        mock_delete.assert_not_called()
