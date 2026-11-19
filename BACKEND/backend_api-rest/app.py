import os
import traceback
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from dotenv import load_dotenv
from routes.api import auth_bp, produto_bp, cliente_bp, venda_bp, categoria_bp, dashboard_bp, usuario_bp, relatorio_bp, configuracao_bp, licenca_bp, convenio_bp
from app.Constants.geral import Geral

load_dotenv()

DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

app = Flask(__name__)

# =============================================
# Configuração de charset UTF-8 para JSON
# Garante que caracteres especiais (acentos, ç, etc.)
# sejam retornados corretamente na API
# =============================================
app.config['JSON_AS_ASCII'] = False          # Flask < 2.3
app.config['JSON_SORT_KEYS'] = False

# Flask 2.3+ usa o JSON provider
try:
    app.json.ensure_ascii = False
    app.json.sort_keys = False
except AttributeError:
    pass  # Flask < 2.3, usa as configs acima

allowed_origins = [
    origin.strip()
    for origin in os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173').split(',')
    if origin.strip()
]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

# Garantir Content-Type com charset=utf-8 em todas as respostas JSON
@app.after_request
def set_utf8_content_type(response):
    if response.content_type and response.content_type.startswith('application/json'):
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
    return response

# Nunca deixar uma exceção não tratada virar uma página de debug/HTML pro
# cliente (mesmo que DEBUG seja ligado por engano em algum ambiente) — loga
# o traceback completo no servidor e responde um JSON genérico e seguro.
@app.errorhandler(Exception)
def handle_unexpected_error(e):
    # Erros HTTP legítimos (404, 405, etc.) continuam com o tratamento
    # padrão do Flask/Werkzeug — só exceções inesperadas (erro de banco,
    # bug de código) caem aqui.
    if isinstance(e, HTTPException):
        return e
    traceback.print_exc()
    return jsonify({'error': Geral.ERRO_SERVIDOR}), 500

app.register_blueprint(auth_bp)
app.register_blueprint(produto_bp)
app.register_blueprint(cliente_bp)
app.register_blueprint(venda_bp)
app.register_blueprint(categoria_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(usuario_bp)
app.register_blueprint(relatorio_bp)
app.register_blueprint(configuracao_bp)
app.register_blueprint(licenca_bp)
app.register_blueprint(convenio_bp)

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 SalesTrack Backend — Controller > Service > Repository")
    print("="*60)
    print("📍 http://localhost:5000")
    print("="*60 + "\n")
    app.run(debug=DEBUG, host='0.0.0.0', port=5000)
