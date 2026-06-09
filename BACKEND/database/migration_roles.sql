-- =============================================
-- SalesTrack - Migração: Novos Perfis + canceladoPor
-- Execute após database_setup.sql
-- =============================================

USE salestrack;
SET NAMES utf8mb4;

-- 1. Expandir o ENUM de tipo para incluir supervisor e tecnico
ALTER TABLE Usuario
    MODIFY COLUMN tipo ENUM('admin', 'vendedor', 'supervisor', 'tecnico') DEFAULT 'vendedor';

-- 2. Inserir o usuário TECNICO (senha irrelevante - autenticação dinâmica por data)
--    Login: TECNICO | Senha: data atual no formato YYYYMMDD (ex: 20260605)
--    Nome usa hex literal UTF-8 para evitar problemas de encoding no terminal Windows
--    54C3A9636E69636F = 'Técnico' em UTF-8
INSERT IGNORE INTO Usuario (nome, email, senha, tipo)
VALUES (CONVERT(X'54C3A9636E69636F' USING utf8mb4), 'TECNICO', 'dynamic_date_auth', 'tecnico');

-- Corrigir nome caso já tenha sido inserido com encoding errado
UPDATE Usuario SET nome = CONVERT(X'54C3A9636E69636F' USING utf8mb4) WHERE email = 'TECNICO';

-- 3. Adicionar colunas canceladoPor e autorizadoPor na tabela Venda (idempotente via procedure)
DROP PROCEDURE IF EXISTS sp_add_canceladoPor;

DELIMITER //
CREATE PROCEDURE sp_add_canceladoPor()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'Venda'
          AND COLUMN_NAME  = 'canceladoPor'
    ) THEN
        ALTER TABLE Venda ADD COLUMN canceladoPor VARCHAR(100) DEFAULT NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'Venda'
          AND COLUMN_NAME  = 'autorizadoPor'
    ) THEN
        ALTER TABLE Venda ADD COLUMN autorizadoPor VARCHAR(100) DEFAULT NULL;
    END IF;
END //
DELIMITER ;

CALL sp_add_canceladoPor();
DROP PROCEDURE IF EXISTS sp_add_canceladoPor;
