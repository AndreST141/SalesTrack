import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Table from '../../components/Table/Table';

// Mock CSS and file-saver / xlsx
vi.mock('../../components/Table/style.css', () => ({}));
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('xlsx', () => ({ utils: {}, write: vi.fn() }));

describe('Table component', () => {
  const colunas = [
    { key: 'nome', label: 'Nome' },
    { key: 'preco', label: 'Preço', render: (val) => `R$ ${val.toFixed(2)}` },
    { key: 'estoque', label: 'Estoque' },
  ];

  const dados = [
    { id: 1, nome: 'Teclado Mecânico', preco: 250.0, estoque: 15 },
    { id: 2, nome: 'Mouse Gamer', preco: 120.0, estoque: 30 },
    { id: 3, nome: 'Monitor 24', preco: 850.0, estoque: 8 },
  ];

  it('renderiza colunas e linhas com dados formatados', () => {
    render(<Table columns={colunas} data={dados} searchKeys={['nome']} />);

    expect(screen.getByText('Nome')).toBeInTheDocument();
    expect(screen.getByText('Preço')).toBeInTheDocument();
    expect(screen.getByText('Estoque')).toBeInTheDocument();

    expect(screen.getByText('Teclado Mecânico')).toBeInTheDocument();
    expect(screen.getByText('R$ 250.00')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('exibe mensagem customizada de vazio quando não há registros', () => {
    render(<Table columns={colunas} data={[]} emptyMessage="Nenhum produto cadastrado" />);

    expect(screen.getByText('Nenhum produto cadastrado')).toBeInTheDocument();
  });

  it('filtra registros dinamicamente pelo termo de busca', async () => {
    const user = userEvent.setup();
    render(<Table columns={colunas} data={dados} searchKeys={['nome']} searchPlaceholder="Filtrar produtos" />);

    const searchInput = screen.getByPlaceholderText('Filtrar produtos');
    await user.type(searchInput, 'Mouse');

    expect(screen.getByText('Mouse Gamer')).toBeInTheDocument();
    expect(screen.queryByText('Teclado Mecânico')).not.toBeInTheDocument();
    expect(screen.queryByText('Monitor 24')).not.toBeInTheDocument();
  });

  it('dispara onRowClick ao clicar em uma linha da tabela', async () => {
    const user = userEvent.setup();
    const handleRowClick = vi.fn();

    render(<Table columns={colunas} data={dados} onRowClick={handleRowClick} />);

    await user.click(screen.getByText('Monitor 24'));

    expect(handleRowClick).toHaveBeenCalledTimes(1);
    expect(handleRowClick).toHaveBeenCalledWith(dados[2]);
  });
});
