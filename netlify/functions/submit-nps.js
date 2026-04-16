const NOTION_DATABASE_ID = "69236a331f284a0aa2cfe4d73a548d74";
const NOTION_VERSION = "2022-06-28";
const ICON_URL = "https://nps-master-mv.netlify.app/favicon.png";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Método não permitido" }) };
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Token não configurado" }) };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "JSON inválido" }) };
  }

  const selectField = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return { select: { name: String(value) } };
  };

  const textField = (value) => {
    const v = (value || "").toString().trim();
    if (!v) return { rich_text: [] };
    return { rich_text: [{ text: { content: v.substring(0, 2000) } }] };
  };

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const brtOffset = -3 * 60;
  const local = new Date(now.getTime() + (brtOffset - now.getTimezoneOffset()) * 60000);
  const titulo = `Resposta ${pad(local.getDate())}/${pad(local.getMonth() + 1)} ${pad(local.getHours())}:${pad(local.getMinutes())}`;

  const properties = {
    "Resposta": { title: [{ text: { content: titulo } }] }
  };

  const scaleFields = {
    "Experiência": data.experiencia_geral,
    "Organização": data.organizacao,
    "Atendimento": data.atendimento,
    "Aplicabilidade": data.aplicabilidade,
    "Cidade": data.cidade,
    "Local": data.local,
    "Alimentação": data.alimentacao,
    "Brindes": data.brindes,
    "NPS": data.nps
  };

  for (const [key, value] of Object.entries(scaleFields)) {
    const field = selectField(value);
    if (field) properties[key] = field;
  }

  properties["Mais gostou"] = textField(data.mais_gostou);
  properties["Menos gostou"] = textField(data.menos_gostou);
  properties["Mudaria"] = textField(data.mudaria);
  properties["Nome"] = textField(data.nome);

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
        icon: {
          type: "external",
          external: { url: ICON_URL }
        },
        properties: properties
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro Notion:", response.status, errorText);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro ao salvar", details: errorText }) };
    }

    const result = await response.json();
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: result.id }) };
  } catch (error) {
    console.error("Erro de rede:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro de rede" }) };
  }
};
