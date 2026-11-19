/**
 * ImpressaoService — cliente do Agente de Impressão.
 *
 * O agente (pasta AGENTE_IMPRESSAO) é um serviço local que roda no Windows
 * do caixa, iniciado junto com o sistema pelo iniciar_salestrack.bat: é ele
 * que enxerga as impressoras instaladas (spooler) e as portas COM, coisa que
 * nem o navegador nem o backend em Docker conseguem. Por isso o endereço é
 * sempre o próprio computador onde o navegador está aberto.
 */
import axios from 'axios';

// Mesma porta fixada em AGENTE_IMPRESSAO/agente.py
const AGENTE_URL = 'http://127.0.0.1:9317';

const agente = axios.create({
    baseURL: AGENTE_URL,
    timeout: 5000,
});

// Sem resposta = agente parado/não instalado neste computador (quem chama
// distingue pelo campo agenteIndisponivel para orientar o usuário).
function traduzirErro(err) {
    if (!err.response) {
        const erro = new Error('Agente de impressão não encontrado neste computador.');
        erro.agenteIndisponivel = true;
        return erro;
    }
    return new Error(err.response.data?.error || 'Erro no agente de impressão.');
}

const ImpressaoService = {
    /** @returns {Promise<{ ok: boolean, versao: string, simulacao: boolean }>} */
    async status() {
        try {
            const res = await agente.get('/status');
            return res.data;
        } catch (err) {
            throw traduzirErro(err);
        }
    },

    /**
     * Impressoras instaladas no Windows e portas seriais da máquina.
     * @returns {Promise<{ impressoras: Array, portasSeriais: Array }>}
     */
    async listarDispositivos() {
        try {
            const res = await agente.get('/dispositivos', { timeout: 15000 });
            return res.data;
        } catch (err) {
            throw traduzirErro(err);
        }
    },

    /**
     * @param {object} config — configImpressora (ConfigContext)
     * @param {Array<{ texto: string, negrito?: boolean, duplo?: boolean }>} linhas
     *   — ver utils/comprovante.js
     */
    async imprimir(config, linhas) {
        try {
            await agente.post('/imprimir', { config, linhas }, { timeout: 20000 });
        } catch (err) {
            throw traduzirErro(err);
        }
    },
};

export default ImpressaoService;
