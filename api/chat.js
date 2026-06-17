async function callOpenAI({ system, messages, maxOutputTokens = 1500, model = 'gpt-5.4-mini' }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY が設定されていません');

  const input = [
    {
      role: 'system',
      content: [{ type: 'input_text', text: system }],
    },
    ...messages.map((message) => ({
      role: message.role,
      content: [{ type: 'input_text', text: message.content }],
    })),
  ];

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      max_output_tokens: maxOutputTokens,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'OpenAI API error');
  }

  const text = data.output_text || data.output
    ?.flatMap((item) => item.content || [])
    ?.filter((item) => item.type === 'output_text')
    ?.map((item) => item.text)
    ?.join('');

  if (!text) {
    throw new Error('OpenAI API response did not contain text output');
  }

  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, system, isSubscribed, trialStartDate, exchanges, emotional_flag } = req.body;

    if (!isSubscribed) {
      const elapsed = Date.now() - parseInt(trialStartDate || '0', 10);
      const threeDays = 30 * 24 * 60 * 60 * 1000;
      if (elapsed >= threeDays) {
        return res.status(403).json({ error: 'trial_expired' });
      }
    }

    const exchangeCount = parseInt(exchanges || '0', 10);
    let phaseInstruction = '';
    if (exchangeCount >= 8) {
      phaseInstruction = '\n\n【現在のフェーズ: まとめ】これまでの対話を踏まえ、クライアントが得た気づきを言語化させ、具体的な次のアクションを一緒に引き出す段階です。「今日の対話を通じて、何が一番印象に残りましたか？」「明日から一つだけ変えるとしたら？」のような問いで締めくくりに導いてください。';
    } else if (exchangeCount >= 4) {
      phaseInstruction = '\n\n【現在のフェーズ: 深掘り】表面的な状況から踏み込み、感情・価値観・本音に迫る段階です。「その時、あなたはどんな気持ちでしたか？」「本当はどうしたいと思っているのですか？」「それがあなたにとって大切な理由は何ですか？」のような問いで核心に近づいてください。';
    } else {
      phaseInstruction = '\n\n【現在のフェーズ: 導入】クライアントが安心して話せる雰囲気を作りながら、状況・背景を広く聞く段階です。オープンクエスチョンで現状を整理し、テーマの輪郭を掴んでください。';
    }

    const emotionalInstruction = emotional_flag
      ? '\n\n【感情への対応】クライアントは今、強い感情を抱えています。まず「それは辛かったですね」「そう感じるのは自然なことです」など、感情を丁寧に受け止める一文を必ず入れてから、質問に移ってください。'
      : '';

    const enhancedSystem = system + phaseInstruction + emotionalInstruction;
    const effectiveSystem = isSubscribed
      ? enhancedSystem
      : enhancedSystem + '\n\n【制約】返答は必ず3文以内で簡潔に。箇条書き・選択肢・フォローアップ提案は一切禁止。本質的な問いを1つだけ返すこと。';

    const reply = await callOpenAI({
      system: effectiveSystem,
      messages,
      maxOutputTokens: 1500,
      model: 'gpt-5.4-mini',
    });

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
}
