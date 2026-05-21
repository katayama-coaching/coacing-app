const { Resend } = require('resend');
const { google } = require('googleapis');

const RESULT_CONTENT = {
  'ChatGPT/Codexタイプ': {
    reason: '対話で要件を整理しながら、柔軟に実装方針を決める力が高いタイプです。',
    firstStep: 'まずは小さな機能を1つ決めて、AIと要件定義→実装→テストの順で進めましょう。',
    review: '本の「AIに仕様を先に渡す」章を読み返し、プロンプトの粒度をそろえると効果が上がります。'
  },
  'Cursorタイプ': {
    reason: 'エディタ内で素早く試行錯誤し、実装速度を最大化できるタイプです。',
    firstStep: '既存プロジェクトで1画面だけ改善し、差分レビューの習慣を付けましょう。',
    review: '本の「小さく作ってすぐ検証」の章を復習すると相性がさらに良くなります。'
  },
  'Windsurfタイプ': {
    reason: '文脈を活かした連続的な提案を取り込み、開発フローを滑らかに進めるタイプです。',
    firstStep: '1日の定型作業をAI提案中心で回し、どこまで短縮できるか記録してみましょう。',
    review: '本の「人間は意思決定に集中する」考え方を再確認すると実践しやすくなります。'
  },
  'Claude Codeタイプ': {
    reason: '品質・設計・説明の納得感を大切にし、堅実に進められるタイプです。',
    firstStep: '設計メモを先に書き、AIにレビューしてもらってから実装に入りましょう。',
    review: '本の「レビュー観点を先に定義する」章を復習すると品質が安定します。'
  },
  'Devin/OpenHandsタイプ': {
    reason: '長いタスクを分解して委任し、成果物ベースで管理するのが得意なタイプです。',
    firstStep: 'まずは半日で終わるタスクを1つ丸ごと任せ、レビュー基準を明確にしましょう。',
    review: '本の「自動化と責任分界点」の章を読み返すと運用がスムーズになります。'
  }
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, consent, resultType, answers, inflow } = req.body || {};
    if (!name || !email || !consent || !resultType || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const content = RESULT_CONTENT[resultType] || RESULT_CONTENT['ChatGPT/Codexタイプ'];
    const now = new Date().toISOString();
    const answersText = answers.map((a, i) => `Q${i + 1}:${a.answer}`).join(' / ');

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'あなたに向いているAIエージェント診断結果',
      text:
`【診断結果】\n${resultType}\n\n【向いている理由】\n${content.reason}\n\n【最初の一歩】\n${content.firstStep}\n\n【本の復習ポイント】\n${content.review}\n\n---\nこのメールは診断結果と今後のご案内を希望された方にお送りしています。\n配信停止をご希望の場合は、このメールに「配信停止希望」と返信してください。`
    });

    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${process.env.GOOGLE_SHEET_NAME}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[now, name, email, resultType, answersText, inflow || 'Kindle読者特典', consent ? '同意あり' : '同意なし']]
      }
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: e.message });
  }
};
