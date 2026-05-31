from flask import request, jsonify
from functools import wraps
from app.Constants.geral import Geral

active_tokens = {}

def token_required(f):

    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')

        if not token:
            return jsonify({'error': Geral.TOKEN_NAO_FORNECIDO}), 401

        if token.startswith('Bearer '):
            token = token[7:]

        if token not in active_tokens:
            return jsonify({'error': Geral.TOKEN_INVALIDO}), 401

        request.user = active_tokens[token]
        return f(*args, **kwargs)

    return decorated
