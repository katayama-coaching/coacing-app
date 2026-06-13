export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
   const { messages, system, isSubscribed, trialStartDate, exchanges, emotional_flag } = req.body;

// サーバー側の二重チェック（トライアル期限切れならブロック）
if (!isSubscribed) {
  const elapsed = Date.now() - parseInt(trialStartDate || '0');
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  if (elapsed >= threeDays) {
    return res.status(403).json({ error: 'trial_expired' });
  }
}

    // 会話回数に基づいてフェーズを判定
    const exchangeCount = parseInt(exchanges || '0');
    let phase = 'intro';
    let phaseInstruction = '';
    if (exchangeCount >= 8) {
      phase = 'closing';
      phaseInstruction = '\n\n【現在のフェーズ: まとめ】これまでの対話を踏まえ、クライアントが得た気づきを言語化させ、具体的な次のアクションを一緒に引き出す段階です。「今日の対話を通じて、何が一番印象に残りましたか？」「明日から一つだけ変えるとしたら？」のような問いで締めくくりに導いてください。';
    } else if (exchangeCount >= 4) {
      phase = 'deep';
      phaseInstruction = '\n\n【現在のフェーズ: 深掘り】表面的な状況から踏み込み、感情・価値観・本音に迫る段階です。「その時、あなたはどんな気持ちでしたか？」「本当はどうしたいと思っているのですか？」「それがあなたにとって大切な理由は何ですか？」のような問いで核心に近づいてください。';
    } else {
      phaseInstruction = '\n\n【現在のフェーズ: 導入】クライアントが安心して話せる雰囲気を作りながら、状況・背景を広く聞く段階です。オープンクエスチョンで現状を整理し、テーマの輪郭を掴んでください。';
    }

    // 感情フラグがある場合は共感を優先する指示を追加
    const emotionalInstruction = emotional_flag
      ? '\n\n【感情への対応】クライアントは今、強い感情を抱えています。まず「それは辛かったですね」「そう感じるのは自然なことです」など、感情を丁寧に受け止める一文を必ず入れてから、質問に移ってください。'
      : '';

    const enhancedSystem = system + phaseInstruction + emotionalInstruction;

    // 未登録ユーザー用のシステムプロンプト制約を追加
    const effectiveSystem = isSubscribed
      ? enhancedSystem
      : enhancedSystem + '\n\n【制約】返答は必ず3文以内で簡潔に。箇条書き・選択肢・フォローアップ提案は一切禁止。本質的な問いを1つだけ返すこと。';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        system: effectiveSystem,
        messages: messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'API error' });
    }

    const reply = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
