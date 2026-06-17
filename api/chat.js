async function callOpenAI({ system, messages, maxOutputTokens = 1500, model }) {
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
      const threeDays = 30 * 24 * 60 * 60 * 1000;
      if (elapsed >= threeDays) {
        return res.status(403).json({ error: 'trial_expired' });
      }
    }

    const exchangeCount = parseInt(exchanges || '0', 10);
    let phaseInstruction = '';
    if (exchangeCount >= 8) {
      phaseInstruction = '\n\n【現在のフェーズ: Willの具体化】ここまでの整理を踏まえ、今回の1on1で実際にどう臨むかを言葉にする段階です。必要であれば、最初の一言、最初の質問、今日は確認しないことを小さく絞り込んでください。';
    } else if (exchangeCount >= 4) {
      phaseInstruction = '\n\n【現在のフェーズ: Optionsの深掘り】表面的な整理から一歩進み、どんな関わり方がありそうか、自分が急ぎすぎていることは何か、どこまで踏み込むかを考える段階です。少し難しさが残る問いでも構いませんが、実務に持ち込める形から離れすぎないでください。';
    } else {
      phaseInstruction = '\n\n【現在のフェーズ: GoalとRealityの整理】初心者でも詰まりにくいよう、まずは「今回いちばん困っていること」「部下のどの反応が気になっているか」「今日は避けたいこと」など、具体的な入口から整理してください。抽象的に迫りすぎず、相手が答えやすい問いを一つ返してください。';
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
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    });

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
};