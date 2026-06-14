export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sign, isSubscribed, trialStartDate } = req.body;

    // 有料ユーザーのみ利用可能
    if (!isSubscribed) {
      const elapsed = Date.now() - parseInt(trialStartDate || '0');
      const threeDays = 30 * 24 * 60 * 60 * 1000;
      if (elapsed >= threeDays) {
        return res.status(403).json({ error: 'trial_expired' });
      }
    }

    const ZODIAC_SIGNS = {
      aries: '牡羊座', taurus: '牡牛座', gemini: '双子座',
      cancer: '蟹座', leo: '獅子座', virgo: '乙女座',
      libra: '天秤座', scorpio: '蠍座', sagittarius: '射手座',
      capricorn: '山羊座', aquarius: '水瓶座', pisces: '魚座',
    };

    if (!sign || !ZODIAC_SIGNS[sign]) {
      return res.status(400).json({ error: '星座を選択してください' });
    }

    const today = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    });

    const randomSeed = Math.floor(Math.random() * 10000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `あなたは個性豊かな占い師です。今日（${today}）の${ZODIAC_SIGNS[sign]}の運勢を占ってください。

重要：乱数シード=${randomSeed}を使って、毎回完全に異なる結果を生成してください。
- スコアは1〜5をランダムに。毎回同じパターンにしないこと。
- luckyNumberは${randomSeed % 99 + 1}を参考に1〜99の中からランダムに選ぶこと。絶対に固定値にしないこと。
- luckyColorは赤・青・緑・黄・紫・オレンジ・ピンク・白・黒・金・銀・茶・ターコイズ・ラベンダー・珊瑚色など多様な色からランダムに選ぶこと。
- メッセージは毎回異なる表現・視点・具体的なシチュエーションを使うこと。

必ず以下のJSON形式のみで返してください。説明文やコードブロックは不要です：
{
  "overall": "総合運のメッセージ（具体的なシチュエーションを含む50文字程度）",
  "overallScore": 1から5のランダムな整数,
  "love": "恋愛運のメッセージ（具体的な場面や行動を含む50文字程度）",
  "loveScore": 1から5のランダムな整数,
  "work": "仕事運のメッセージ（具体的なアドバイスを含む50文字程度）",
  "workScore": 1から5のランダムな整数,
  "money": "金運のメッセージ（具体的な行動指針を含む50文字程度）",
  "moneyScore": 1から5のランダムな整数,
  "luckyColor": "ランダムなラッキーカラー（毎回必ず異なる色）",
  "luckyNumber": シード値から導いたランダムな1から99の整数,
  "advice": "今日だけの特別なアドバイス（40文字程度、毎回異なる内容）"
}`,
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'API error' });
    }

    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const jsonText = text.trim().replace(/^```json?\n?|\n?```$/g, '');
    const fortune = JSON.parse(jsonText);

    return res.status(200).json({ sign: ZODIAC_SIGNS[sign], fortune });

  } catch (error) {
    return res.status(500).json({ error: '運勢の取得に失敗しました' });
  }
}
