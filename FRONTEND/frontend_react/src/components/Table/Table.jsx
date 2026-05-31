import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import './style.css';

function normalizeStr(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function Table({
  columns = [],
  data = [],
  searchPlaceholder = 'Pesquisar...',
  searchKeys = [],
  onRowClick,
  actions,
  itemsPerPage = 10,
  emptyMessage = 'Nenhum registro encontrado',
  loading = false,
  headerActions,
  advancedFilters,
  activeFilters = {},
  onFilterClick,
}) {
  const [termoBusca, setTermoBusca] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const activeFilterCount = Object.values(activeFilters).filter(
    (v) => v !== '' && v !== null && v !== undefined
  ).length;

  const dadosFiltrados = useMemo(() => {
    let result = data;

    if (activeFilters && Object.keys(activeFilters).length > 0) {
      result = result.filter((item) => {
        return Object.entries(activeFilters).every(([key, filterValue]) => {
          if (filterValue === '' || filterValue === null || filterValue === undefined) return true;
          
          if (key === '_estoqueStatus') {
            if (filterValue === 'negativo') return (item.estoque ?? 0) < 0;
            if (filterValue === 'positivo') return (item.estoque ?? 0) > 0;
            if (filterValue === 'zero') return (item.estoque ?? 0) === 0;
            return true;
          }
          if (key === '_status') {
            if (filterValue === 'ativo') return item.ativo !== false && item.ativo !== 0;
            if (filterValue === 'inativo') return item.ativo === false || item.ativo === 0;
            return true;
          }
          if (key === '_dataInicio') {
            const itemDate = new Date(item.dataVenda);
            const filterDate = new Date(filterValue);
            return itemDate >= filterDate;
          }
          if (key === '_dataFim') {
            const itemDate = new Date(item.dataVenda);
            const filterDate = new Date(filterValue);
            filterDate.setHours(23, 59, 59, 999);
            return itemDate <= filterDate;
          }

          const itemValue = item[key];
          if (itemValue == null) return false;
          return normalizeStr(itemValue).includes(normalizeStr(filterValue));
        });
      });
    }

    if (termoBusca.trim() && searchKeys.length > 0) {
      const termoNorm = normalizeStr(termoBusca);
      result = result.filter((item) =>
        searchKeys.some((key) => {
          const valor = item[key];
          if (valor == null) return false;
          return normalizeStr(valor).includes(termoNorm);
        })
      );
    }

    // Sorting
    if (sortConfig.key && sortConfig.direction) {
      result = [...result].sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        // Handle nulls
        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        // Numeric comparison
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }

        // String comparison
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, termoBusca, searchKeys, activeFilters, sortConfig]);


  const totalPaginas = Math.max(1, Math.ceil(dadosFiltrados.length / itemsPerPage));
  const inicio = (paginaAtual - 1) * itemsPerPage;
  const fim = inicio + itemsPerPage;
  const dadosPaginados = dadosFiltrados.slice(inicio, fim);

  useMemo(() => {
    setPaginaAtual(1);
  }, [termoBusca, activeFilters, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
  };

  const maxBotoesVisiveis = 5;
  const primeiroBotao = Math.max(1, Math.min(paginaAtual - 2, totalPaginas - maxBotoesVisiveis + 1));
  const botoesVisiveis = Array.from(
    { length: Math.min(maxBotoesVisiveis, totalPaginas) },
    (_, i) => primeiroBotao + i
  );

  const mudarPagina = (num) => setPaginaAtual(num);
  const paginaAnterior = () => setPaginaAtual((prev) => Math.max(prev - 1, 1));
  const proximaPagina = () => setPaginaAtual((prev) => Math.min(prev + 1, totalPaginas));

  const totalColunas = columns.length + (actions ? 1 : 0);
  const ghostsNeeded = Math.max(0, itemsPerPage - dadosPaginados.length);

  const exportToExcel = () => {
    if (dadosFiltrados.length === 0) return;
    
    const exportData = dadosFiltrados.map((item) => {
      const row = {};
      columns.forEach((col) => {
        let value = item[col.key];
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        row[col.label] = value ?? '';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataObject = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(dataObject, 'exportacao.xlsx');
  };

  return (
    <div className="body-table">
      {/* Search + Actions bar */}
      <div className="table-header-bar">
        <div className="table-search">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
          />
        </div>
        <div className="table-header-actions">
          {advancedFilters && onFilterClick && (
            <button className="btn-filter" onClick={onFilterClick}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </svg>
              Filtros
              {activeFilterCount > 0 && (
                <span className="filter-badge-count">{activeFilterCount}</span>
              )}
            </button>
          )}
          {headerActions}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <div className="table-scroll-area">
          <table className="table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`th-sortable ${sortConfig.key === col.key ? 'th-sorted' : ''}`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="th-sort-content">
                      {col.label}
                      <span className="sort-icon">
                        {sortConfig.key === col.key ? (
                          sortConfig.direction === 'asc' ? '▲' : '▼'
                        ) : (
                          '⇅'
                        )}
                      </span>
                    </span>
                  </th>
                ))}
                {actions && <th className="th-acoes">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={totalColunas} className="table-loading">
                    Carregando dados...
                  </td>
                </tr>
              ) : dadosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={totalColunas} className="table-empty">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                <>
                  {dadosPaginados.map((item, index) => (
                    <tr
                      key={item.id || item.idVenda || item.idProduto || item.idCliente || index}
                      onClick={() => onRowClick && onRowClick(item)}
                      className={onRowClick ? 'row-clickable' : ''}
                    >
                      {columns.map((col) => (
                        <td key={col.key}>
                          {col.render ? col.render(item[col.key], item) : (item[col.key] ?? '-')}
                        </td>
                      ))}
                      {actions && (
                        <td className="acoes" onClick={(e) => e.stopPropagation()}>
                          {actions(item)}
                        </td>
                      )}
                    </tr>
                  ))}
                  {/* Ghost rows to keep height consistent */}
                  {Array.from({ length: Math.max(0, itemsPerPage - dadosPaginados.length) }).map((_, i) => (
                    <tr key={`ghost-${i}`} className="linha-fantasma">
                      {Array.from({ length: totalColunas }).map((_, j) => (
                        <td key={j}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with pagination */}
        <div className="table-footer">
          <span className="table-info">
            {dadosFiltrados.length > 0
              ? `Exibindo ${inicio + 1} a ${Math.min(fim, dadosFiltrados.length)} de ${dadosFiltrados.length} itens`
              : '0 itens'}
          </span>
          <div className="pagination">
            <button onClick={paginaAnterior} disabled={paginaAtual === 1} className="pagination-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            {botoesVisiveis.map((num) => (
              <button
                key={num}
                className={paginaAtual === num ? 'active' : ''}
                onClick={() => mudarPagina(num)}
              >
                {num}
              </button>
            ))}
            <button onClick={proximaPagina} disabled={paginaAtual === totalPaginas} className="pagination-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Table;
