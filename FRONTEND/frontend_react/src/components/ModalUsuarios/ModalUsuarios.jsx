import React from 'react';
import Modal from '../Modal/Modal';
import './style.css';

export default function ModalUsuarios({ isOpen, onClose, usuarios, loading }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Usuários" closeOnOverlayClick>
      {loading ? (
        <p className="modal-loading">Carregando usuários…</p>
      ) : usuarios && usuarios.length ? (
        <ul className="modal-usuarios-list">
          {usuarios.map(u => (
            <li key={u.idUsuario} className="modal-usuario-item">
              <strong>{u.nome}</strong> – {u.email}
              <span className={`badge ${u.tipo}`}>{u.tipo}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="modal-empty">Nenhum usuário encontrado.</p>
      )}
    </Modal>
  );
}
