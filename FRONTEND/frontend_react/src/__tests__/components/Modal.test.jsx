import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Modal from '../../components/Modal/Modal';

// Mock CSS
vi.mock('../../components/Modal/style.css', () => ({}));

describe('Modal component', () => {
  it('não renderiza nada quando isOpen é false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Título Modal">
        <p>Conteúdo do Modal</p>
      </Modal>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza título, corpo e rodapé quando isOpen é true', () => {
    render(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Confirmar Operação"
        footer={<button>Confirmar</button>}
      >
        <p>Você tem certeza que deseja excluir?</p>
      </Modal>
    );

    expect(screen.getByText('Confirmar Operação')).toBeInTheDocument();
    expect(screen.getByText('Você tem certeza que deseja excluir?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });

  it('invoca onClose ao clicar no botão fechar (X)', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Modal isOpen={true} onClose={handleClose} title="Modal Teste">
        <p>Conteúdo</p>
      </Modal>
    );

    const closeBtn = screen.getByRole('button');
    await user.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('invoca onClose ao clicar no backdrop externo', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    const { container } = render(
      <Modal isOpen={true} onClose={handleClose} title="Modal Backdrop">
        <p>Conteúdo Interno</p>
      </Modal>
    );

    const backdrop = container.querySelector('.body-modal');
    await user.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('não invoca onClose ao clicar no interior do modal', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Modal isOpen={true} onClose={handleClose} title="Modal Stop Propagation">
        <p>Clique Aqui Dentro</p>
      </Modal>
    );

    await user.click(screen.getByText('Clique Aqui Dentro'));
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('invoca onConfirm ao pressionar tecla Enter', async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn();

    render(
      <Modal isOpen={true} onClose={() => {}} onConfirm={handleConfirm} title="Modal Enter">
        <input placeholder="Digite algo" />
      </Modal>
    );

    const input = screen.getByPlaceholderText('Digite algo');
    await user.type(input, '{Enter}');

    expect(handleConfirm).toHaveBeenCalled();
  });
});
