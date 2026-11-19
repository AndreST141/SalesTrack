-- Migration: Cria tabela TokenRevogado para persistencia de tokens JWT revogados
CREATE TABLE IF NOT EXISTS TokenRevogado (
    idTokenRevogado INT AUTO_INCREMENT PRIMARY KEY,
    tokenHash VARCHAR(64) NOT NULL UNIQUE,
    idUsuario INT NULL,
    dataRevogacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dataExpiracao DATETIME NOT NULL,
    INDEX idx_token_hash (tokenHash),
    INDEX idx_data_expiracao (dataExpiracao),
    FOREIGN KEY (idUsuario) REFERENCES Usuario(idUsuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
