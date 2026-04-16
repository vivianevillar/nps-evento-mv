// Netlify Function: submit-nps
// Recebe POST do form HTML e cria página na database Notion "NPS - Evento Master MV (v2)"

const NOTION_DATABASE_ID = "69236a331f284a0aa2cfe4d73a548d74";
const NOTION_VERSION = "2022-06-28";

exports.handler = async (event) => {
  // CORS headers — libera chamadas do site Netlify
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Só aceita POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Método não permitido" })
    };
  }

  // Token do Notion vem da variável de ambiente
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) {
    console.error("NOTION_TOKEN não configurado");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Configuração do servidor ausente" })
    };
  }

  // Parse do body
  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "JSON inválido" })
    };
  }

  // Helper: monta campo select só se tiver valor
  const selectField = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return { select: { name: String(value) } };
  };

  // Helper: monta rich_text só se tiver valor
  const textField = (value) => {
    const v = (value || "").toString().trim();
    if (!v) return { rich_text: [] };
    return { rich_text: [{ text: { content: v.substring(0, 2000) } }] };
  };

  // Título da página: "Resposta DD/MM HH:MM"
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  // Ajusta pra horário de Brasília (UTC-3)
  const brtOffset = -3 * 60;
  const local = new Date(now.getTime() + (brtOffset - now.getTimezoneOffset()) * 60000);
  const titulo = `Resposta ${pad(local.getDate())}/${pad(local.getMonth() + 1)} ${pad(local.getHours())}:${pad(local.getMinutes())}`;

  // Monta propriedades da página Notion
  const properties = {
    "Resposta": {
      title: [{ text: { content: titulo } }]
    }
  };

  // Campos escala 1-5
  const scaleFields = {
    "Como você avalia a experiência geral do evento?": data.experiencia_geral,
    "Como você avalia a organização do evento?": data.organizacao,
    "Como você avalia o atendimento do time MV?": data.atendimento,
    "Como você avalia a aplicabilidade dos conteúdos no seu negócio?": data.aplicabilidade,
    "Como você avalia a cidade escolhida (São Paulo)?": data.cidade,
    "Como você avalia o local do evento?": data.local,
    "Como você avalia a alimentação em geral?": data.alimentacao,
    "Como você avalia os brindes recebidos?": data.brindes,
    "Em uma escala de 0 a 10, o quanto você recomendaria este evento para um conhecido?": data.nps
  };

  for (const [key, value] of Object.entries(scaleFields)) {
    const field = selectField(value);
    if (field) properties[key] = field;
  }

  // Campos de texto
  properties["O que você mais gostou no evento?"] = textField(data.mais_gostou);
  properties["O que você menos gostou no evento?"] = textField(data.menos_gostou);
  properties["O que você mudaria ou acrescentaria para uma próxima edição?"] = textField(data.mudaria);
  properties["Nome (opcional)"] = textField(data.nome);

  // Chama API do Notion
  try {
    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: properties
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro Notion API:", response.status, errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Erro ao salvar no Notion",
          details: errorText
        })
      };
    }

    const result = await response.json();
    console.log("Resposta salva:", result.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: result.id })
    };
  } catch (error) {
    console.error("Erro de rede:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Erro de rede ao contactar Notion" })
    };
  }
};
