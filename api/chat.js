async function callOpenAI({ system, messages, maxOutputTokens = 1000, model }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY が設定されていません');

  const input = [
    {
      role: 'system',
      content: [{ type: 'input_text', text: system }],
    },
    ...messages.map((message) => ({
      role: message.role,
      content: [{
        type: message.role === 'assistant' ? 'output_text' : 'input_text',
        text: message.content,
      }],
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, system, isSubscribed, trialStartDate, exchanges, emotional_flag } = req.body;

    if (!isSubscribed) {
      const elapsed = Date.now() - parseInt(trialStartDate || '0', 10);
      const trialWindow = 30 * 24 * 60 * 60 * 1000;
      if (elapsed >= trialWindow) {
        return res.status(403).json({ error: 'trial_expired' });
      }
    }

    const exchangeCount = parseInt(exchanges || '0', 10);

    const learningInstruction = [
      '【学習モード】あなたは整理の代行者ではなく、GROWを学ぶための伴走者です。',
      '毎回、短い受け止めを置いたあと、観察1つと質問1つを基本にしてください。',
      '完成した答え、模範解答、最初の一言の決定版を早い段階で出しすぎないでください。',
      '相手の代わりに整理し切らず、本人が少し考える余白を残してください。',
      'ユーザーが例を求めた場合も、例は1つまでに留め、最後は「あなたの言葉にするとどうなりますか」と返してください。'
    ].join('');

    let phaseInstruction = '';
    if (exchangeCount >= 8) {
      phaseInstruction = [
        '【現在のフェーズ: Willの具体化】',
        'ここまでの整理を踏まえ、今回はどう臨むかを本人の言葉で短く定める段階です。',
        '最初の一言、確認したいこと、今日は急がないことのうち1つか2つに絞ってください。',
        'あなたが完成版を提示するより、本人に言い切らせることを優先してください。'
      ].join('');
    } else if (exchangeCount >= 4) {
      phaseInstruction = [
        '【現在のフェーズ: Optionsの深掘り】',
        '表面的な整理から一歩進み、どんな関わり方がありそうかを考える段階です。',
        '少し難しさは残してよいので、選択肢の比較、優先順位、踏み込みすぎるリスクなどを本人に考えさせてください。',
        '選択肢を出し切るより、「どちらを優先したいか」「何を手放すか」を問う方を優先してください。'
      ].join('');
    } else {
      phaseInstruction = [
        '【現在のフェーズ: GoalとRealityの整理】',
        '初心者でも詰まりにくいよう、まずは今回いちばん知りたいこと、気になっている部下の反応、今日は避けたいことなど、具体的な入口から入ってください。',
        'ただし、すぐに2択や正解例で片づけすぎず、本人の言葉を一段引き出す問いを優先してください。',
        '問いはやさしく、でも少し考えないと答えられない深さを保ってください。'
      ].join('');
    }

    const emotionalInstruction = emotional_flag
      ? [
          '【感情への対応】クライアントは今、強い感情を抱えています。',
          'まず感情を短く受け止めてから質問へ進んでください。',
          'ただし、慰めで完結せず、「今いちばん引っかかっていることは何か」を考えられる問いにつなげてください。'
        ].join('')
      : '';

    const enhancedSystem = [system, learningInstruction, phaseInstruction, emotionalInstruction].join('\n\n');
    const effectiveSystem = isSubscribed
      ? enhancedSystem
      : enhancedSystem + '\n\n【制約】返答は必ず3文以内で簡潔に。箇条書き・選択肢の列挙・フォローアップ提案は一切禁止。本質的な問いを1つだけ返すこと。';

    const reply = await callOpenAI({
      system: effectiveSystem,
      messages,
      maxOutputTokens: 1000,
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    });

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
};