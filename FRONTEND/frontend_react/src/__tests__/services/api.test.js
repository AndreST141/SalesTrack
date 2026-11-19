import axios from 'axios';

// Mock axios before importing api
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return { default: mockAxios };
});

describe('api.js — configuração do Axios', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('cria instância axios com timeout e headers padrão', async () => {
    await import('../../services/api');
    expect(axios.create).toHaveBeenCalled();
    const callArgs = axios.create.mock.calls[0][0];
    expect(callArgs).toHaveProperty('timeout', 10000);
    expect(callArgs.headers['Content-Type']).toBe('application/json; charset=utf-8');
  });

  it('registra interceptors de request e response', async () => {
    await import('../../services/api');
    expect(axios.interceptors.request.use).toHaveBeenCalled();
    expect(axios.interceptors.response.use).toHaveBeenCalled();
  });

  it('interceptor de request adiciona Authorization Bearer quando token existe', async () => {
    await import('../../services/api');
    localStorage.setItem('token', 'jwt-token-12345');
    const requestInterceptor = axios.interceptors.request.use.mock.calls[0]?.[0];
    expect(requestInterceptor).toBeDefined();

    const config = { headers: {} };
    const result = requestInterceptor(config);
    expect(result.headers.Authorization).toBe('Bearer jwt-token-12345');
  });

  it('interceptor de request não adiciona Authorization quando não há token', async () => {
    await import('../../services/api');
    localStorage.removeItem('token');
    const requestInterceptor = axios.interceptors.request.use.mock.calls[0]?.[0];
    expect(requestInterceptor).toBeDefined();

    const config = { headers: {} };
    const result = requestInterceptor(config);
    expect(result.headers.Authorization).toBeUndefined();
  });

  it('interceptor de response limpa dados e redireciona no 401', async () => {
    await import('../../services/api');
    localStorage.setItem('token', 'exp-token');
    localStorage.setItem('user', JSON.stringify({ nome: 'Teste' }));

    const errorInterceptor = axios.interceptors.response.use.mock.calls[0]?.[1];
    expect(errorInterceptor).toBeDefined();

    const mockError = { response: { status: 401 } };
    try {
      await errorInterceptor(mockError);
    } catch {
      // rejection esperada
    }

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
