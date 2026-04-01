const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
require('dotenv').config();
const { Mistral } = require('@mistralai/mistralai');

// ========== CONFIGURAÇÕES ==========

// Configuração do Mistral - CORRIGIDO
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

const MEU_NUMERO = "558597935916";


// Configurações Runrun.it
const RUNRUNIT = {
  appKey: "5d34905dc4f5b7bbd96616fd27111300",
  userToken: "3dt0GbitZvU4bvGC8RGs",
  formId: "A63kMfO8ledjQ9YJ",
  webhookPort: 3000,
  webhookUrl: "https://risa-pleuropneumonic-nonclamorously.ngrok-free.dev/webhook/runrunit"
};

// ========== SERVIDOR WEBHOOK ==========
const app = express();
app.use(express.json());

// Mapeamento temporário: ticket_id -> whatsapp_number
const ticketWhatsAppMap = new Map();

// Variável para controlar se o cliente WhatsApp está pronto
let clientReady = false;
let globalClient = null;

// Endpoint do webhook CORRIGIDO
app.post('/webhook/runrunit', async (req, res) => {
  console.log('\n📨 ========== WEBHOOK RECEBIDO ==========');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body COMPLETO:', JSON.stringify(req.body, null, 2));
  
  try {
    if (req.body.event === 'task:create') {
      const taskData = req.body.data.task;
      const ticketId = taskData.id;
      
      console.log(`✅ Ticket criado: #${ticketId}`);
      
      // ========== BUSCAR DADOS ESTRUTURADOS DO FORMULÁRIO ==========
  let formData = {};

  try {
    console.log(`🔍 Extraindo dados do HTML para o ticket #${ticketId}...`);
    
    const response = await fetch(`https://runrun.it/api/v1.0/tasks/${ticketId}/form_answers`, {
      method: 'GET',
      headers: {
        'App-Key': RUNRUNIT.appKey,
        'User-Token': RUNRUNIT.userToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const formAnswers = await response.json();
      const htmlAnswer = formAnswers.form_answer || '';
      
      const extractValue = (label) => {
        const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`<b>${escapedLabel}<\\/b><br\\/>([^<]+)`, 'i');
        const match = htmlAnswer.match(regex);
        return match ? match[1].trim() : null;
      };
      
      formData["Seu nome"] = extractValue("Seu nome");
      formData["Empresa"] = extractValue("Empresa que trabalha ?");
      formData["WhatsApp"] = extractValue("WhatsApp");
      formData["Assunto"] = extractValue("Assunto da Solicitação");
      formData["Sistema"] = extractValue("Qual dos sistemas sua empresa utiliza?");
      formData["Modulo"] = extractValue("Selecione o módulo");
      
      console.log('📊 DADOS EXTRAÍDOS DO HTML:', formData);
      console.log(`✅ Sistema: ${formData["Sistema"]}`);
      console.log(`✅ Módulo: ${formData["Modulo"]}`);
      
    } else {
      console.log(`⚠️ Erro ao buscar respostas: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Erro ao extrair dados:', error.message);
  }
// ========== FIM DA EXTRAÇÃO ==========

// ========== ATUALIZAR TÍTULO DA TAREFA NO RUNRUN.IT ==========
    try {
    const nomeCliente = formData["Empresa"] || "Cliente";  // <-- MUDOU AQUI
    const modulo = formData["Modulo"] || "Suporte";
    const novoTitulo = `[${nomeCliente}] - ${modulo}`;
    
    console.log(`📝 Atualizando título da tarefa #${ticketId} para: ${novoTitulo}`);
    
    const updateResponse = await fetch(`https://runrun.it/api/v1.0/tasks/${ticketId}`, {
      method: 'PUT',
      headers: {
        'App-Key': RUNRUNIT.appKey,
        'User-Token': RUNRUNIT.userToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        task: {
          title: novoTitulo
        }
      })
    });
    
    if (updateResponse.ok) {
      console.log(`✅ Título atualizado com sucesso para: ${novoTitulo}`);
    } else {
      console.log(`⚠️ Erro ao atualizar título: ${updateResponse.status}`);
    }
  } catch (error) {
    console.error('❌ Erro ao atualizar título:', error.message);
  }
// ========== FIM ATUALIZAR TÍTULO ==========
      let whatsappNumber = null;
      
      // ========== BUSCAR WHATSAPP DO FORMULÁRIO ==========
      try {
        console.log(`🔍 Buscando respostas do formulário para o ticket #${ticketId}...`);
        
        const response = await fetch(`https://runrun.it/api/v1.0/tasks/${ticketId}/form_answers`, {
          method: 'GET',
          headers: {
            'App-Key': RUNRUNIT.appKey,
            'User-Token': RUNRUNIT.userToken,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`📡 API form_answers respondeu com status: ${response.status}`);
        
        if (response.ok) {
          const formAnswers = await response.json();
          console.log('📋 RESPOSTAS DO FORMULÁRIO (RAW):', JSON.stringify(formAnswers, null, 2));
          
          const htmlAnswer = formAnswers.form_answer || '';
          console.log('📄 HTML do formulário:', htmlAnswer);
          
          const whatsappRegex = /<b>WhatsApp<\/b><br\/>([^<]+)/i;
          const match = htmlAnswer.match(whatsappRegex);
          
          if (match && match[1]) {
            whatsappNumber = match[1].trim();
            console.log(`📱 WhatsApp encontrado via regex: ${whatsappNumber}`);
          } else {
            const phoneRegex = /(\+55\d{10,13}|\d{10,13})/g;
            const phoneMatches = htmlAnswer.match(phoneRegex);
            if (phoneMatches && phoneMatches.length > 0) {
              whatsappNumber = phoneMatches[0];
              console.log(`📱 WhatsApp encontrado via regex de telefone: ${whatsappNumber}`);
            }
          }
        } else {
          console.log(`⚠️ Erro ao buscar respostas: ${response.status}`);
          const errorText = await response.text();
          console.log('Detalhe do erro:', errorText);
        }
      } catch (apiError) {
        console.error('❌ Erro na API:', apiError.message);
      }
      // ========== FIM DA BUSCA ==========
      
      if (whatsappNumber) {
        const formattedNumber = formatWhatsAppNumber(whatsappNumber);
        
        if (formattedNumber) {
          console.log(`📤 Tentando validar número: ${whatsappNumber} -> ${formattedNumber}`);
          
          // Monta mensagem com os dados extraídos
          let mensagem = `✅ *Confirmação de Chamado #${ticketId}*\n\n`;
          mensagem += `Olá! Recebemos seu problema.\n\n`;
          
          if (formData["Sistema"]) {
            mensagem += `📌 *Sistema:* ${formData["Sistema"]}\n`;
          }
          if (formData["Modulo"]) {
            mensagem += `📌 *Módulo:* ${formData["Modulo"]}\n`;
          }
          if (formData["Assunto"]) {
            mensagem += `📌 *Assunto:* ${formData["Assunto"]}\n`;
          }
          
          mensagem += `\nNossa equipe técnica já foi notificada e retornará em breve!`;
          
          console.log(`📝 MENSAGEM A SER ENVIADA:\n${mensagem}`);
          
          try {
            const contactId = await globalClient.getNumberId(formattedNumber);
            if (contactId) {
              await globalClient.sendMessage(contactId._serialized, mensagem);
              console.log(`✅ CONFIRMAÇÃO ENVIADA para ${contactId._serialized}`);
            } else {
              console.error(`❌ O número ${formattedNumber} não foi encontrado/validado pelo WhatsApp.`);
            }
          } catch (err) {
            console.error(`❌ Erro técnico ao enviar para ${formattedNumber}:`, err.message);
          }
        } else {
          console.log(`⚠️ Número formatado inválido: ${whatsappNumber}`);
        }
      } else {
        console.log(`⚠️ WhatsApp NÃO ENCONTRADO para o ticket ${ticketId}`);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.status(200).send('OK');
  }
});


// Inicia servidor webhook
app.listen(RUNRUNIT.webhookPort, () => {
  console.log(`🌐 Webhook server rodando na porta ${RUNRUNIT.webhookPort}`);
  console.log(`📡 Endpoint: http://localhost:${RUNRUNIT.webhookPort}/webhook/runrunit`);
});

// ========== FUNÇÕES AUXILIARES ==========

// Função para buscar WhatsApp por email
async function getWhatsappByEmail(email) {
  console.log(`🔍 Buscando WhatsApp para email: ${email}`);
  
  try {
    const response = await fetch(`https://runrun.it/api/v1.0/users?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'App-Key': RUNRUNIT.appKey,
        'User-Token': RUNRUNIT.userToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const users = await response.json();
      if (users.length > 0 && users[0].custom_fields) {
        const whatsapp = users[0].custom_fields.whatsapp || 
                         users[0].custom_fields.telefone || 
                         users[0].custom_fields.celular;
        if (whatsapp) {
          console.log(`✅ WhatsApp encontrado: ${whatsapp}`);
          return whatsapp;
        }
      }
    } else {
      console.log(`⚠️ Erro na API: ${response.status}`);
      if (response.status === 401) {
        console.log('🔑 Suas chaves do Runrun.it podem estar incorretas. Verifique no painel do Runrun.it');
      }
    }
  } catch (error) {
    console.error('❌ Erro ao buscar usuário:', error.message);
  }
  
  return null;
}

// Função para formatar número do WhatsApp
function formatWhatsAppNumber(number) {
  let cleaned = number.toString().replace(/\D/g, '');
  
  // Se tiver 13 dígitos e começar com 55 (padrão internacional completo)
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    // Remove o '9' extra se ele estiver na posição correta (55 + DDD + 9...)
    // O WhatsApp costuma usar o formato de 12 dígitos internamente no Brasil
    const ddd = cleaned.substring(2, 4);
    const num = cleaned.substring(cleaned.length - 8);
    cleaned = `55${ddd}${num}`;
  } 
  else if (cleaned.length === 11) { // Formato: 85997935916
    const ddd = cleaned.substring(0, 2);
    const num = cleaned.substring(cleaned.length - 8);
    cleaned = `55${ddd}${num}`;
  }
  else if (cleaned.length === 10) { // Formato: 8597935916
    cleaned = `55${cleaned}`;
  }

  return `${cleaned}@c.us`;
}

// ========== WHATSAPP BOT ==========
// ========== WHATSAPP BOT ==========
// ========== WHATSAPP BOT ==========
// Detecta se está rodando no Windows

// ========== CONFIGURAÇÃO DO CHROME PARA RENDER ==========
// ISSO DEVE SER A PRIMEIRA COISA NO ARQUIVO, ANTES DO CLIENT

if (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') {
  const fs = require('fs');
  
  // Caminho que foi baixado
  const chromePaths = [
    '/opt/render/.cache/puppeteer/chrome/linux-121.0.6167.85/chrome-linux64/chrome',  // ADICIONADO
    '/opt/render/.cache/puppeteer/chrome/linux-120.0.6099.109/chrome-linux64/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
  ];
  
  let chromePath = null;
  for (const p of chromePaths) {
    if (fs.existsSync(p)) {
      chromePath = p;
      break;
    }
  }
  
  if (chromePath) {
    process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
    console.log(`✅ Chrome encontrado em: ${chromePath}`);
  }
}

// ========== RESTO DO SEU CÓDIGO ==========
// ... (imports, configurações, etc)

// Depois de todas as configurações, crie o client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

// Armazena o client globalmente para uso no webhook
globalClient = client;

client.on('qr', qr => qrcode.generate(qr, {small: true}));

client.on('ready', () => {
  clientReady = true;
  console.log('🚀 WMS EXPERT ONLINE');
  console.log(`📱 Bot configurado para responder com !bot`);
  console.log(`🔗 Webhook configurado: ${RUNRUNIT.webhookUrl}`);
  console.log(`📞 Número do bot: ${MEU_NUMERO}`);
  console.log(`✅ Cliente WhatsApp pronto para receber mensagens!`);
});

let ultimaResposta = new Map();
const userHistory = new Map();

// Função que processa a mensagem
async function processarMensagem(msg, comando) {
  if (comando === '') {
    await client.sendMessage(msg.from, `Olá! Como posso ajudar?

📞 *Financeiro*: (85) 8641-3456
📞 *Comercial*: (85) 9135-0235

🐞 *Chamados Técnicos*:
https://runrun.it/share/form/A63kMfO8ledjQ9YJ

🔑 *Ativação WMS Legado*:
https://wms-ativador.vercel.app/gerador

🏢 *Localização*:
Salinas Shopping, Av. Washington Soares, 909 - Sala 65F

Estou aqui para ajudar!`);
    return;
  }
  
  console.log(`\n💬 [COMANDO] ${comando}`);
  
  const body = comando.toLowerCase();
  
  // 1. FINANCEIRO
  if (body.includes('financeiro') || body.includes('fatura') || body.includes('pagamento') || 
      body.includes('boleto') || body.includes('cobrança') || body.includes('preço') || 
      body.includes('valor') || body.includes('custo')) {
    const resposta = "📞 *Contato Financeiro*\n\nEntre em contato com nosso setor financeiro:\n(85) 8641-3456\n\nEstamos à disposição para ajudar com questões de pagamento, boletos e negociações.";
    ultimaResposta.set(msg.from, resposta);
    await client.sendMessage(msg.from, resposta);
    return;
  }
  
  // 2. COMERCIAL
  if (body.includes('comercial') || body.includes('vendas') || body.includes('contratar') || 
      body.includes('orçamento') || body.includes('demonstração') || body.includes('demo') ||
      body.includes('planos') || body.includes('assinar')) {
    const resposta = "💼 *Contato Comercial*\n\nFale com nosso time comercial:\n(85) 9135-0235\n\nTeremos prazer em apresentar nossas soluções e fazer um orçamento personalizado para sua empresa.";
    ultimaResposta.set(msg.from, resposta);
    await client.sendMessage(msg.from, resposta);
    return;
  }
  
  // 3. CONHECER EMPRESA / LOCALIZAÇÃO
  if (body.includes('conhecer') || body.includes('empresa') || body.includes('local') || 
      body.includes('endereço') || body.includes('onde fica') || body.includes('visitar') ||
      body.includes('escritório') || body.includes('sala')) {
    const resposta = "🏢 *Nossa Localização*\n\nSalinas Shopping\nAv. Washington Soares, 909 - Sala 65F\nEdson Queiroz, Fortaleza - CE\n\nEstamos de portas abertas para recebê-lo!";
    ultimaResposta.set(msg.from, resposta);
    await client.sendMessage(msg.from, resposta);
    return;
  }
  
  // 4. ATIVAÇÃO DO SISTEMA WMS LEGADO
  if (body.includes('ativar') || body.includes('ativação') || body.includes('legado') || 
      body.includes('chave') || body.includes('licença') || body.includes('gerar') ||
      body.includes('ativador')) {
    const resposta = `🔑 *Ativação do WMS Legado*

Siga os passos abaixo para gerar sua chave de ativação:

1. *Acesse o Ativador*:
   https://wms-ativador.vercel.app/gerador

2. *Clique em "Registrar"*

3. *Insira seu CNPJ*

4. *Clique em "Registrar"*

5. *Copie o código chave gerado* (Ex: WJMLMDVW-XXXX)

6. *Acesse o sistema WMS* e cole a chave de liberação

7. *Clique em "OK" para finalizar*

*Pronto!* Seu sistema está ativado.

⚠️ *Importante:* O ativador é APENAS para gerar chave de ativação, não cria usuários.`;
    ultimaResposta.set(msg.from, resposta);
    await client.sendMessage(msg.from, resposta);
    return;
  }
  
  // 5. PROBLEMAS NO WMS
  const wmsPalavras = ['problema', 'erro', 'bug', 'falha', 'não funciona', 'travando', 'lento', 
                       'painel', 'dashboard', 'relatório', 'inventário', 'expedição', 'movimentação',
                       'wms', 'desktop', 'web', 'mobile', 'sistema', 'não abre', 'não carrega',
                       'cadastro', 'estoque', 'produto', 'nota fiscal', 'nf-e', 'pedido', 'suporte'];
  
  const isWMSProblem = wmsPalavras.some(palavra => body.includes(palavra));
  
  if (isWMSProblem) {
    const resposta = `🐞 *Abrir Chamado Técnico*\n\n` +
                     `Para abrir um chamado, acesse o formulário abaixo e preencha com os detalhes do problema:\n\n` +
                     `https://runrun.it/share/form/${RUNRUNIT.formId}\n\n` +
                     `⚠️ *Importante:* Após preencher o formulário, você receberá uma confirmação automática aqui no WhatsApp com o número do seu chamado.\n\n` +
                     `Nossa equipe técnica analisará e retornará em breve!`;
    ultimaResposta.set(msg.from, resposta);
    await client.sendMessage(msg.from, resposta);
    return;
  }
  
  // IA MISTRAL
  try {
    console.log("🤖 Processando pergunta com IA (Mistral)...");
    
    let history = userHistory.get(msg.from) || [];
    history.push({ role: "user", content: comando });
    
    if (history.length > 10) history = history.slice(-10);
    
    const messages = [
      { 
        role: "system", 
        content: `Você é o assistente virtual da WMS Expert. Responda de forma direta e objetiva.

INFORMAÇÕES IMPORTANTES:
- Financeiro: (85) 8641-3456
- Comercial: (85) 9135-0235
- Endereço: Salinas Shopping, Av. Washington Soares, 909 - Sala 65F
- Ativação: https://wms-ativador.vercel.app/gerador
- Chamados: https://runrun.it/share/form/A63kMfO8ledjQ9YJ`
      },
      ...history
    ];
    
    const completion = await mistral.chat.complete({
      model: "mistral-small-latest",
      messages: messages,
      temperature: 0.7,
      max_tokens: 200
    });

    const resposta = completion.choices[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";
    
    history.push({ role: "assistant", content: resposta });
    userHistory.set(msg.from, history);
    
    ultimaResposta.set(msg.from, resposta);
    await client.sendMessage(msg.from, resposta);
    console.log("✅ Resposta enviada.");

  } catch (error) {
    console.error("❌ Erro:", error.message);
    const erroMsg = "Estou com dificuldades técnicas. Por favor, abra um chamado em: https://runrun.it/share/form/A63kMfO8ledjQ9YJ";
    ultimaResposta.set(msg.from, erroMsg);
    await client.sendMessage(msg.from, erroMsg);
  }
}

client.on('message_create', async msg => {
  console.log(`🔔 Mensagem recebida: ${msg.body}, de: ${msg.from}`);
  if (msg.from.includes('@g.us')) return;
  
  const NUMERO_CLIENTE = "558586412738";
  const numeroRemetente = msg.from.replace('@c.us', '');
  
  // Se for o cliente, processa qualquer mensagem (sem !bot)
  if (numeroRemetente === NUMERO_CLIENTE) {
    let comando = msg.body;
    await processarMensagem(msg, comando);
    return;
  }
  
  // Se for o seu número, só processa com !bot
  if (numeroRemetente === MEU_NUMERO && msg.body.startsWith('!bot')) {
    let comando = msg.body.substring(4).trim();
    await processarMensagem(msg, comando);
    return;
  }
  
  // Qualquer outro número, ignora
  console.log(`⚠️ Número não autorizado: ${numeroRemetente}`);
});

client.initialize();