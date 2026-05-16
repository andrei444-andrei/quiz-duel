// Vercel Serverless Function: POST /api/questions
// Принимает { topic }, ходит в OpenAI с серверным ключом (process.env.OPENAI_API_KEY),
// возвращает { questions: [...] }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY не задан в env' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: 'Невалидный JSON' }); }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Пустое тело запроса' });
  }

  const topic = String(body.topic || '').trim().slice(0, 200);
  if (!topic) return res.status(400).json({ error: 'topic обязателен' });

  const systemPrompt = 'Ты генерируешь вопросы для викторины. Отвечай только валидным JSON.';
  const userPrompt =
`Сгенерируй ровно 10 вопросов для викторины на тему "${topic}".
Каждый вопрос — с 4 вариантами ответа, только один правильный.
Вопросы на русском, разной сложности, без повторов и без банальностей.

Верни JSON-объект вида:
{"questions":[{"q":"текст вопроса","options":["A","B","C","D"],"correct":0}, ...]}

Поле correct — индекс правильного варианта (0..3). Ровно 10 элементов в массиве.`;

  try {
    const oai = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
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
      return res.status(502).json({ error: 'OpenAI ' + oai.status, details: text.slice(0, 400) });
    }

    const data = await oai.json();
    const content = data?.choices?.[0]?.message?.content || '';
    let parsed;
    try { parsed = JSON.parse(content); }
    catch { return res.status(502).json({ error: 'Модель вернула не-JSON', raw: content.slice(0, 400) }); }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: 'Internal error', details: String(e).slice(0, 400) });
  }
}
