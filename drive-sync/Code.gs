/**
 * 鉄ログ → Googleドライブ 自動送信の受け口（Google Apps Script）
 *
 * 使い方（最初の1回だけ）
 *  1. https://script.google.com で「新しいプロジェクト」を作り、このファイルの中身を貼る
 *  2. 下の FOLDER_ID と SECRET を自分の値にする（SECRET はアプリの「合言葉」と同じにする）
 *  3. 右上「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *       実行ユーザー: 自分 ／ アクセスできるユーザー: 全員
 *  4. 表示された URL（…/exec）をアプリの 設定 →「Googleドライブに自動で送る」に貼って保存
 *
 * 保存されるファイル（FOLDER_ID のフォルダ内、毎回上書き）
 *  - tetsulog-latest.json   … 全記録（トレーニング・InBody・マイページ）
 *  - tetsulog-entries.csv   … トレーニング記録の表（1セット1行、推定1RMつき）
 *  - tetsulog-YYYY-MM.json  … 月ごとのスナップショット（その月の最後の状態）
 */
var FOLDER_ID = 'ここにフォルダIDを入れる';
var SECRET = 'ここに合言葉を入れる';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (!body || body.app !== 'tetsu-log' || body.key !== SECRET) return json_({ ok: false, error: 'unauthorized' });
    delete body.key;
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var text = JSON.stringify(body, null, 2);
    put_(folder, 'tetsulog-latest.json', text, MimeType.PLAIN_TEXT);
    put_(folder, 'tetsulog-' + body.exportedAt.slice(0, 7) + '.json', text, MimeType.PLAIN_TEXT);
    put_(folder, 'tetsulog-entries.csv', toCsv_(body.entries || []), MimeType.CSV);
    return json_({ ok: true, entries: (body.entries || []).length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return ContentService.createTextOutput('tetsu-log drive sync: OK');
}

function put_(folder, name, content, mime) {
  var it = folder.getFilesByName(name);
  if (it.hasNext()) it.next().setContent(content);
  else folder.createFile(name, content, mime);
}

function toCsv_(entries) {
  var cols = ['date', 'country', 'category', 'name', 'weight', 'reps', 'est1RM', 'minutes', 'distance', 'memo', 'id'];
  var rows = [cols.join(',')];
  entries.forEach(function (x) {
    var est = (x.weight != null && x.reps) ? Math.round(x.weight * (1 + x.reps / 30) * 10) / 10 : '';
    rows.push(cols.map(function (c) {
      var v = c === 'est1RM' ? est : x[c];
      if (v === undefined || v === null) return '';
      v = String(v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(','));
  });
  return '﻿' + rows.join('\n');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
