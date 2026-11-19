# -*- coding: utf-8 -*-
"""
Integration tests for User Management API (/api/usuarios):
- GET /api/usuarios
- POST /api/usuarios
- PUT /api/usuarios/<id>
- DELETE /api/usuarios/<id>
Validates admin exclusivity and error handling.
"""
import pytest
from unittest.mock import patch
from app.Constants.geral import Geral

class TestUsuariosApiIntegration:

    def test_usuarios_unauthenticated(self, client):
        """Validates that user management endpoints reject unauthenticated calls."""
        assert client.get('/api/usuarios').status_code == 401
        assert client.post('/api/usuarios').status_code == 401
        assert client.put('/api/usuarios/1').status_code == 401
        assert client.delete('/api/usuarios/1').status_code == 401

    def test_usuarios_as_vendedor_forbidden(self, client, vendedor_headers):
        """Validates that vendedor role cannot manage users (403 Forbidden)."""
        assert client.get('/api/usuarios', headers=vendedor_headers).status_code == 403
        assert client.post('/api/usuarios', headers=vendedor_headers, json={}).status_code == 403
        assert client.put('/api/usuarios/1', headers=vendedor_headers, json={}).status_code == 403
        assert client.delete('/api/usuarios/1', headers=vendedor_headers).status_code == 403

    @patch('app.Services.user_service.UserRepository.get_all')
    def test_get_usuarios_as_admin(self, mock_get_all, client, admin_headers):
        """Validates that admin can list users."""
        mock_get_all.return_value = [{'idUsuario': 1, 'nome': 'Admin', 'email': 'a@s.com', 'tipo': 'admin'}]
        res = client.get('/api/usuarios', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 1

    @patch('app.Services.user_service.UserRepository.find_by_email')
    @patch('app.Services.user_service.UserRepository.create')
    def test_post_usuario_as_admin_success(self, mock_create, mock_find, client, admin_headers):
        """Validates successful user creation by administrator."""
        mock_find.return_value = None
        mock_create.return_value = 12
        payload = {'nome': 'Caixa 1', 'email': 'caixa1@salestrack.com', 'senha': 'password123', 'tipo': 'vendedor'}
        res = client.post('/api/usuarios', headers=admin_headers, json=payload)
        assert res.status_code == 201
        data = res.get_json()
        assert data['success'] is True
        assert data['id'] == 12

    @patch('app.Services.user_service.UserRepository.existe_gerenciavel')
    @patch('app.Services.user_service.UserRepository.update')
    def test_put_usuario_as_admin_success(self, mock_update, mock_existe, client, admin_headers):
        """Validates user update by administrator."""
        mock_existe.return_value = True
        payload = {'nome': 'Caixa Renomeado', 'tipo': 'supervisor'}
        res = client.put('/api/usuarios/12', headers=admin_headers, json=payload)
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True

    @patch('app.Services.user_service.UserRepository.existe_gerenciavel')
    @patch('app.Services.user_service.UserRepository.delete')
    def test_delete_usuario_as_admin_success(self, mock_delete, mock_existe, client, admin_headers):
        """Validates user inativation by administrator."""
        mock_existe.return_value = True
        res = client.delete('/api/usuarios/12', headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True

    @patch('app.Services.user_service.UserRepository.delete')
    def test_delete_own_user_blocked(self, mock_delete, client, admin_headers):
        """Validates that the logged admin (id 1 in the fixture) cannot inactivate itself."""
        res = client.delete('/api/usuarios/1', headers=admin_headers)
        assert res.status_code == 400
        assert "próprio usuário" in res.get_json()['error']
        mock_delete.assert_not_called()
