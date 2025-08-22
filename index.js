require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// 1️⃣ Recebe o comando /relatorio e abre o modal
app.post('/slack/relatorio', async (req, res) => {
  const triggerId = req.body.trigger_id;

  const modal = {
    type: 'modal',
    title: { type: 'plain_text', text: 'Relatório financeiro diário' },
    submit: { type: 'plain_text', text: 'Enviar' },
    callback_id: 'relatorio_modal',
    blocks: [
      { type: 'input', block_id: 'especie', label: { type: 'plain_text', text: 'Informe o saldo em espécie:' }, element: { type: 'plain_text_input', action_id: 'valor' } },
      { type: 'input', block_id: 'santander', label: { type: 'plain_text', text: 'Informe o saldo no Santander:' }, element: { type: 'plain_text_input', action_id: 'valor' } },
      { type: 'input', block_id: 'itau', label: { type: 'plain_text', text: 'Informe o saldo no Itaú:' }, element: { type: 'plain_text_input', action_id: 'valor' } },
      { type: 'input', block_id: 'cora', label: { type: 'plain_text', text: 'Informe o saldo no Cora:' }, element: { type: 'plain_text_input', action_id: 'valor' } },
      { type: 'input', block_id: 'contas', label: { type: 'plain_text', text: 'Informe o valor das contas a pagar:' }, element: { type: 'plain_text_input', action_id: 'valor' } },
      { type: 'input', block_id: 'repasses', label: { type: 'plain_text', text: 'Informe o valor dos repasses:' }, element: { type: 'plain_text_input', action_id: 'valor' } }
    ]
  };

  await axios.post('https://slack.com/api/views.open', {
    trigger_id: triggerId,
    view: modal
  }, {
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  res.status(200).send();
});

// 2️⃣ Recebe os dados preenchidos no modal
app.post('/slack/interativo', async (req, res) => {
  const payload = JSON.parse(req.body.payload);
  if (payload.type !== 'view_submission') return res.status(200).send();

  const valores = {};
  for (const campo of ['especie', 'santander', 'itau', 'cora', 'contas', 'repasses']) {
    valores[campo] = parseFloat(payload.view.state.values[campo].valor.value.replace(',', '.')) || 0;
  }

  const saldoInicial = valores.especie + valores.santander + valores.itau + valores.cora;
  const totalSaidas = valores.contas + valores.repasses;
  const saldoFinal = saldoInicial - totalSaidas;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  const relatorio = `
📅 *Relatório do dia - ${dataAtual}*

🔵 *Saldo inicial*:
• Espécie: R$ ${valores.especie.toFixed(2)}
• Santander: R$ ${valores.santander.toFixed(2)}
• Itaú: R$ ${valores.itau.toFixed(2)}
• Cora: R$ ${valores.cora.toFixed(2)}
• *Total*: R$ ${saldoInicial.toFixed(2)}

🔴 *Saídas do dia*:
• Contas a pagar: -R$ ${valores.contas.toFixed(2)}
• Repasses: -R$ ${valores.repasses.toFixed(2)}
• *Total de saídas*: -R$ ${totalSaidas.toFixed(2)}

📉 *Saldo final após saídas*: R$ ${saldoFinal.toFixed(2)}
`;

  await axios.post(SLACK_WEBHOOK_URL, { text: relatorio });
  res.status(200).send();
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});