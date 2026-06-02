/**
 * StorageService — Camada de abstração para persistência.
 *
 * Hoje usa localStorage; quando o backend estiver pronto basta trocar
 * a implementação interna dos métodos get/set para chamadas API.
 *
 * ALLOWED_KEYS: whitelist de chaves gerenciadas pelo app.
 * Qualquer chave fora dessa lista é ignorada no export/import,
 * evitando vazamento de dados não-relacionados.
 */

const BACKUP_VERSION = '1.0.0';
const APP_VERSION = 'SalesTrack-V3';

const ALLOWED_KEYS = [
  'dadosEmpresa',
  'configImpressora',
  'formasPagamento',
  'permiteEstoqueNegativo',
  'permiteExcluir',
];

// ─── Helpers ───────────────────────────────────────────────────────

function safeParse(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ─── Service ───────────────────────────────────────────────────────

const StorageService = {
  /**
   * Lê uma chave do storage.
   * @param {string} key
   * @param {*} defaultValue — valor retornado se a chave não existir
   */
  get(key, defaultValue = null) {
    const raw = localStorage.getItem(key);
    return safeParse(raw, defaultValue);
  },

  /**
   * Persiste um valor no storage (serializado como JSON).
   * Valores primitivos (boolean, string) também são serializados.
   */
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  /**
   * Remove uma chave do storage.
   */
  remove(key) {
    localStorage.removeItem(key);
  },

  /**
   * Exporta APENAS as chaves permitidas + metadata para backup.
   * Retorna um objeto pronto para download como JSON.
   */
  exportAll() {
    const data = {};
    for (const key of ALLOWED_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        data[key] = safeParse(raw, raw);
      }
    }
    return {
      version: BACKUP_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
  },

  /**
   * Importa dados de um backup JSON.
   *
   * Validações:
   *  1. Deve ter `version` (string)
   *  2. Deve ter `data` (objeto com pelo menos 1 chave conhecida)
   *  3. `formasPagamento` se presente deve ser array
   *
   * Operação ATÔMICA: salva tudo num snapshot antes de escrever.
   * Se qualquer passo falhar, restaura o snapshot original.
   *
   * @param {object} backup — objeto parseado do arquivo JSON
   * @returns {{ success: boolean, error?: string }}
   */
  importAll(backup) {
    // ─── Validação de schema ──────────────────────────────────
    if (!backup || typeof backup !== 'object') {
      return { success: false, error: 'Arquivo inválido: não é um objeto JSON.' };
    }
    if (!backup.version || typeof backup.version !== 'string') {
      return { success: false, error: 'Arquivo sem versionamento. Não é um backup válido do SalesTrack.' };
    }
    if (!backup.data || typeof backup.data !== 'object') {
      return { success: false, error: 'Arquivo sem dados. Estrutura de backup inválida.' };
    }

    const knownKeys = Object.keys(backup.data).filter((k) => ALLOWED_KEYS.includes(k));
    if (knownKeys.length === 0) {
      return { success: false, error: 'Nenhuma chave reconhecida no backup.' };
    }

    // Validação de tipos específicos
    if (backup.data.formasPagamento && !Array.isArray(backup.data.formasPagamento)) {
      return { success: false, error: 'formasPagamento deve ser um array.' };
    }

    // ─── Snapshot para rollback (atomicidade) ─────────────────
    const snapshot = {};
    for (const key of ALLOWED_KEYS) {
      const raw = localStorage.getItem(key);
      snapshot[key] = raw; // null se não existia
    }

    try {
      // Limpa chaves gerenciadas e escreve as do backup
      for (const key of ALLOWED_KEYS) {
        localStorage.removeItem(key);
      }
      for (const key of knownKeys) {
        localStorage.setItem(key, JSON.stringify(backup.data[key]));
      }
      return { success: true };
    } catch (err) {
      // ─── Rollback ─────────────────────────────────────────
      for (const key of ALLOWED_KEYS) {
        if (snapshot[key] !== null) {
          localStorage.setItem(key, snapshot[key]);
        } else {
          localStorage.removeItem(key);
        }
      }
      return { success: false, error: `Falha ao restaurar: ${err.message}. Dados originais mantidos.` };
    }
  },
};

export { ALLOWED_KEYS, BACKUP_VERSION };
export default StorageService;
