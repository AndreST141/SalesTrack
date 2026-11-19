import StorageService, { ALLOWED_KEYS, BACKUP_VERSION } from '../../services/storageService';

describe('StorageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('salva e recupera itens com tipagem JSON correta', () => {
    StorageService.set('permiteEstoqueNegativo', true);
    expect(StorageService.get('permiteEstoqueNegativo')).toBe(true);

    const dadosEmpresa = { razaoSocial: 'Padaria Modelo', cnpj: '12345678000199' };
    StorageService.set('dadosEmpresa', dadosEmpresa);
    expect(StorageService.get('dadosEmpresa')).toEqual(dadosEmpresa);
  });

  it('retorna fallback padrão quando chave não existe', () => {
    expect(StorageService.get('chaveInexistente', 'fallback_valor')).toBe('fallback_valor');
    expect(StorageService.get('outraChave')).toBeNull();
  });

  it('remove chaves corretamente', () => {
    StorageService.set('permiteExcluir', false);
    expect(StorageService.get('permiteExcluir')).toBe(false);

    StorageService.remove('permiteExcluir');
    expect(StorageService.get('permiteExcluir')).toBeNull();
  });

  it('exportAll inclui apenas chaves permitidas na whitelist', () => {
    StorageService.set('permiteEstoqueNegativo', true);
    StorageService.set('configImpressora', { largura: 80 });
    localStorage.setItem('chaveInvasora', 'segredo123');

    const backup = StorageService.exportAll();
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.appVersion).toBe('SalesTrack-V3');
    expect(backup.data).toHaveProperty('permiteEstoqueNegativo', true);
    expect(backup.data).toHaveProperty('configImpressora', { largura: 80 });
    expect(backup.data).not.toHaveProperty('chaveInvasora');
  });

  it('importAll valida schema e rejeita dados corrompidos', () => {
    expect(StorageService.importAll(null).success).toBe(false);
    expect(StorageService.importAll({}).success).toBe(false);
    expect(StorageService.importAll({ version: '1.0.0' }).success).toBe(false);
    expect(StorageService.importAll({ version: '1.0.0', data: { chaveDesconhecida: 1 } }).success).toBe(false);
    expect(StorageService.importAll({ version: '1.0.0', data: { formasPagamento: 'string_invalida' } }).success).toBe(false);
  });

  it('importAll restaura com sucesso backup válido', () => {
    const backupValido = {
      version: '1.0.0',
      data: {
        permiteEstoqueNegativo: false,
        formasPagamento: [{ value: 'dinheiro', label: 'Dinheiro' }, { value: 'pix', label: 'PIX' }],
      },
    };

    const res = StorageService.importAll(backupValido);
    expect(res.success).toBe(true);
    expect(StorageService.get('permiteEstoqueNegativo')).toBe(false);
    expect(StorageService.get('formasPagamento')).toEqual([{ value: 'dinheiro', label: 'Dinheiro' }, { value: 'pix', label: 'PIX' }]);
  });
});
