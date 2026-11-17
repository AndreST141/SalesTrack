# -*- coding: utf-8 -*-
"""
Pytest configuration and shared fixtures for SalesTrack automated tests.
Provides test client, authenticated tokens for different RBAC profiles,
and lifecycle hooks for state isolation.
"""
import sys
import os
import pytest

import importlib.util

# Ensure BACKEND/backend_api-rest is in sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Load app.py without collision with the app/ directory
app_py_path = os.path.join(BASE_DIR, 'app.py')
spec = importlib.util.spec_from_file_location("salestrack_backend_app", app_py_path)
backend_app_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend_app_module)
flask_app = backend_app_module.app

from middlewares.auth_middleware import active_tokens
from app.Services import auth_service

@pytest.fixture
def app():
    """Create and configure a Flask app instance for testing."""
    flask_app.config.update({
        'TESTING': True,
        'JSON_AS_ASCII': False,
    })
    yield flask_app

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture(autouse=True)
def clean_system_state():
    """
    Ensure every test runs in complete isolation by clearing in-memory
    active tokens and rate-limiting brute force registries.
    """
    active_tokens.clear()
    auth_service._tentativas_login.clear()
    yield
    active_tokens.clear()
    auth_service._tentativas_login.clear()

@pytest.fixture
def admin_token():
    """Register and return an admin user token."""
    token = "test-token-admin-12345"
    active_tokens[token] = {
        'id': 1,
        'nome': 'Administrador QA',
        'email': 'admin@salestrack.com',
        'tipo': 'admin'
    }
    return token

@pytest.fixture
def vendedor_token():
    """Register and return a vendedor user token."""
    token = "test-token-vendedor-12345"
    active_tokens[token] = {
        'id': 2,
        'nome': 'Vendedor QA',
        'email': 'vendedor@salestrack.com',
        'tipo': 'vendedor'
    }
    return token

@pytest.fixture
def supervisor_token():
    """Register and return a supervisor user token."""
    token = "test-token-supervisor-12345"
    active_tokens[token] = {
        'id': 3,
        'nome': 'Supervisor QA',
        'email': 'supervisor@salestrack.com',
        'tipo': 'supervisor'
    }
    return token

@pytest.fixture
def tecnico_token():
    """Register and return a tecnico user token."""
    token = "test-token-tecnico-12345"
    active_tokens[token] = {
        'id': 4,
        'nome': 'Tecnico QA',
        'email': 'tecnico@salestrack.com',
        'tipo': 'tecnico'
    }
    return token

@pytest.fixture
def admin_headers(admin_token):
    """Authorization headers for an admin user."""
    return {
        'Authorization': f'Bearer {admin_token}',
        'Content-Type': 'application/json'
    }

@pytest.fixture
def vendedor_headers(vendedor_token):
    """Authorization headers for a vendedor user."""
    return {
        'Authorization': f'Bearer {vendedor_token}',
        'Content-Type': 'application/json'
    }

@pytest.fixture
def supervisor_headers(supervisor_token):
    """Authorization headers for a supervisor user."""
    return {
        'Authorization': f'Bearer {supervisor_token}',
        'Content-Type': 'application/json'
    }

@pytest.fixture
def tecnico_headers(tecnico_token):
    """Authorization headers for a tecnico user."""
    return {
        'Authorization': f'Bearer {tecnico_token}',
        'Content-Type': 'application/json'
    }
