from flask import Flask
from flask_cors import CORS
from routes.api import auth_bp, produto_bp, cliente_bp, venda_bp, categoria_bp, dashboard_bp

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

CORS(app, resources={r"/api/*": {"origins": "*"}})

# Garantir Content-Type com charset=utf-8 em todas as respostas JSON
@app.after_request
def set_utf8_content_type(response):
    if response.content_type and response.content_type.startswith('application/json'):
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
    return response

app.register_blueprint(auth_bp)
app.register_blueprint(produto_bp)
app.register_blueprint(cliente_bp)
app.register_blueprint(venda_bp)
app.register_blueprint(categoria_bp)
app.register_blueprint(dashboard_bp)

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 SalesTrack Backend — Controller > Service > Repository")
    print("="*60)
    print("📍 http://localhost:5000")
    print("="*60 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
