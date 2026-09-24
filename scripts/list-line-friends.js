// LINE公式アカウントを「友だち追加」した人のユーザーIDと表示名の一覧を表示するツール。
// 通知先シートに設定するLINEユーザーIDを調べるために、セットアップ時に1回だけ使う。
//
// 使い方: LINE_CHANNEL_ACCESS_TOKEN=xxxx node scripts/list-line-friends.js
require('dotenv').config();

async function main() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error('環境変数 LINE_CHANNEL_ACCESS_TOKEN を設定してください');
    process.exit(1);
  }

  const idsRes = await fetch('https://api.line.me/v2/bot/followers/ids', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!idsRes.ok) {
    console.error('友だち一覧の取得に失敗しました:', idsRes.status, await idsRes.text());
    process.exit(1);
  }
  const { userIds } = await idsRes.json();

  if (!userIds || userIds.length === 0) {
    console.log('まだ誰もこのLINE公式アカウントを友だち追加していません。');
    console.log('奥様・こばさんのLINEでQRコードから友だち追加してから、もう一度実行してください。');
    return;
  }

  for (const userId of userIds) {
    const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : null;
    console.log(`${profile ? profile.displayName : '(表示名取得失敗)'} : ${userId}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
