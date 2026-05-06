export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { messages, system, isSubscribed, exchanges } = req.body;

    // サーバー側の二重チェック（未登録ユーザーが3往復超えたらブロック）
    if (!isSubscribed && exchanges >= 3) {
      return res.status(403).json({ error: 'free_limit_reached' });
    }

    // 未登録ユーザー用のシステムプロンプト制約を追加
    const effectiveSystem = isSubscribed
      ? system
      : system + '\n\n【制約】返答は必ず3文以内で簡潔に。箇条書き・選択肢・フォローアップ提案は一切禁止。本質的な問いを1つだけ返すこと。';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: isSubscribed ? 1000 : 300,  // 未登録は短く
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
