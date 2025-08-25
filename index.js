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
  console.log('🔔 Slash command recebido:', req.body);
  const triggerId = req.body.trigger_id;

  const modal = {
    type: 'modal',
    title: { type: 'plain_text', text: 'Relatório financeiro' },
    submit: { type: 'plain_text', text: 'Enviar' },
    callback_id: 'relatorio_modal',
    blocks: [
      {
        type: 'input',
        block_id: 'especie',
        label: { type: 'plain_text', text: 'Informe o saldo em espécie:' },
        element: { type: 'plain_text_input', action_id: 'especie_valor' }
      },
      {
        type: 'input',
        block_id: 'santander',
        label: { type: 'plain_text', text: 'Informe o saldo no Santander:' },
        element: { type: 'plain_text_input', action_id: 'santander_valor' }
      },
      {
        type: 'input',
        block_id: 'itau',
        label: { type: 'plain_text', text: 'Informe o saldo no Itaú:' },
        element: { type: 'plain_text_input', action_id: 'itau_valor' }
      },
      {
        type: 'input',
        block_id: 'cora',
        label: { type: 'plain_text', text: 'Informe o saldo no Cora:' },
        element: { type: 'plain_text_input', action_id: 'cora_valor' }
      },
      {
        type: 'input',
        block_id: 'contas',
        label: { type: 'plain_text',
          text: 'Informe o valor das contas a pagar:' },
          element: { type: 'plain_text_input', action_id: 'contas_valor' }
        },
      {
        type: 'input',
        block_id: 'repasses',
        label: { type: 'plain_text', text: 'Informe o valor dos repasses:' },
        element: { type: 'plain_text_input', action_id: 'repasses_valor' }
      }
    ]
  };

try {
    const response = await axios.post('https://slack.com/api/views.open', {
      trigger_id: triggerId,
      view: modal
    }, {
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

    console.log('📤 Resposta da Slack API:', response.data);

    if (!response.data.ok) {
      console.error('⚠️ Erro ao abrir modal:', response.data.error);
    }

    res.status(200).send();
  } catch (error) {
    console.error('❌ Erro inesperado ao abrir modal:', error.response?.data || error.message);
    res.status(500).send();
  }
});

// 2️⃣ Recebe os dados preenchidos no modal
app.post('/slack/interativo', async (req, res) => {
  const payload = JSON.parse(req.body.payload);
  if (payload.type !== 'view_submission') return res.status(200).send();

  const valores = {};
  for (const campo of ['especie', 'santander', 'itau', 'cora', 'contas', 'repasses']) {
    valores[campo] = parseFloat(payload.view.state.values[campo][`${campo}_valor`].value.replace(',', '.')) || 0;
  }

  const saldoInicial = valores.santander + valores.itau + valores.cora; // removido valores.especie no somatório conforme solicitação do Wanderson
  const totalSaidas = valores.contas + valores.repasses;
  const saldoFinal = saldoInicial - totalSaidas;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  const relatorio = `
📅 *Relatório do dia - ${dataAtual}*

🔵 *Saldo inicial*:
• Espécie: ${valores.especie.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
• Santander: ${valores.santander.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
• Itaú: ${valores.itau.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
• Cora: ${valores.cora.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
• *Total*: ${saldoInicial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}

🔴 *Saídas do dia*:
• Contas a pagar: -${valores.contas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
• Repasses: -${valores.repasses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
• *Total de saídas*: -${totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}

📉 *Saldo final após saídas*: ${saldoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
`;

  await axios.post(SLACK_WEBHOOK_URL, { text: relatorio });
  res.status(200).send();
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
