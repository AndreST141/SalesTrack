export function mascaraCPF(v) {
    const n = String(v ?? '').replace(/\D/g, '').slice(0, 11);
    return n.replace(/^(\d{3})(\d)/, '$1.$2')
            .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function mascaraTelefone(v) {
    const n = String(v ?? '').replace(/\D/g, '').slice(0, 11);
    if (n.length <= 10) return n.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/\($/, '(');
    return n.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

export function mascaraCEP(v) {
    const n = String(v ?? '').replace(/\D/g, '').slice(0, 8);
    return n.length > 5 ? n.slice(0, 5) + '-' + n.slice(5) : n;
}

export const MASCARAS = {
    cpf: mascaraCPF,
    telefone: mascaraTelefone,
    cep: mascaraCEP,
};
