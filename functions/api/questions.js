// Cloudflare Pages Function: POST /api/questions
// Принимает { topic }, ходит в OpenAI с серверным ключом (env.OPENAI_API_KEY),
// возвращает { questions: [...] }

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY не задан в env' }, 500);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Невалидный JSON' }, 400); }

  const topic = String(body.topic || '').trim().slice(0, 200);
  if (!topic) return json({ error: 'topic обязателен' }, 400);

  // Простой rate-limit: один запрос в 3 сек с одного IP.
  // (Достаточно, чтобы случайно не слить кошелёк, но не защита от DDoS —
  // на нормальный поток включи Cloudflare Rate Limiting в дашборде.)
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RL && typeof env.RL.limit === 'function') {
    const { success } = await env.RL.limit({ key: ip });
    if (!success) return json({ error: 'Слишком часто, подожди немного' }, 429);
  }

  const systemPrompt = 'Ты генерируешь вопросы для викторины. Отвечай только валидным JSON.';
  const userPrompt =
`Сгенерируй ровно 10 вопросов для викторины на тему "${topic}".
Каждый вопрос — с 4 вариантами ответа, только один правильный.
Вопросы на русском, разной сложности, без повторов и без банальностей.

Верни JSON-объект вида:
{"questions":[{"q":"текст вопроса","options":["A","B","C","D"],"correct":0}, ...]}

Поле correct — индекс правильного варианта (0..3). Ровно 10 элементов в массиве.`;

  const oai = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    }),
  });

  if (!oai.ok) {
    const text = await oai.text();
    return json({ error: 'OpenAI ' + oai.status, details: text.slice(0, 400) }, 502);
  }

  const data = await oai.json();
  const content = data?.choices?.[0]?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(content); }
  catch { return json({ error: 'Модель вернула не-JSON', raw: content.slice(0, 400) }, 502); }

  return json(parsed, 200);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
