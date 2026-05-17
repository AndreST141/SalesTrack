import { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import './style.css';

function FilterModal({ isOpen, onClose, filters = [], activeFilters = {}, onApply }) {
    const [localFilters, setLocalFilters] = useState({});

    useEffect(() => {
        if (isOpen) {
            setLocalFilters({ ...activeFilters });
        }
    }, [isOpen]);

    function handleChange(key, value) {
        setLocalFilters((prev) => ({ ...prev, [key]: value }));
    }

    function handleApply() {
        onApply(localFilters);
        onClose();
    }

    function handleClear() {
        const cleared = {};
        filters.forEach((f) => { cleared[f.key] = ''; });
        setLocalFilters(cleared);
        onApply(cleared);
        onClose();
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Filtros Avançados"
            maxWidth="520px"
            onConfirm={handleApply}
            className='modal-footer-buttons'
            footer={
                <>
                    <button className="btn-modal-cancel" onClick={handleClear}>
                        Limpar Filtros
                    </button>
                    <button className="btn-modal-confirm" onClick={handleApply}>
                        Aplicar Filtros
                    </button>
                </>
            }
        >
            <div className="filter-modal-grid">
                {filters.map((filter) => (
                    <div className="filter-field" key={filter.key}>
                        <label>{filter.label}</label>
                        {filter.type === 'select' ? (
                            <select
                                value={localFilters[filter.key] || ''}
                                onChange={(e) => handleChange(filter.key, e.target.value)}
                            >
                                {/* <option value="">Todos</option> */}
                                {(filter.options || []).map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        ) : filter.type === 'date' ? (
                            <input
                                type="date"
                                value={localFilters[filter.key] || ''}
                                onChange={(e) => handleChange(filter.key, e.target.value)}
                            />
                        ) : (
                            <input
                                type="text"
                                value={localFilters[filter.key] || ''}
                                onChange={(e) => handleChange(filter.key, e.target.value)}
                                placeholder={filter.placeholder || `Filtrar por ${filter.label.toLowerCase()}...`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {Object.entries(localFilters).some(([, v]) => v !== '' && v !== null && v !== undefined) && (
                <div className="filter-active-pills">
                    <span className="filter-pills-label">Filtros ativos:</span>
                    {Object.entries(localFilters)
                        .filter(([, v]) => v !== '' && v !== null && v !== undefined)
                        .map(([key, value]) => {
                            const filterDef = filters.find((f) => f.key === key);
                            const displayValue = filterDef?.type === 'select'
                                ? (filterDef.options?.find((o) => o.value === value)?.label || value)
                                : value;
                            return (
                                <span className="filter-pill" key={key}>
                                    {filterDef?.label}: {displayValue}
                                    <button onClick={() => handleChange(key, '')}>×</button>
                                </span>
                            );
                        })}
                </div>
            )}
        </Modal>
    );
}

export default FilterModal;
