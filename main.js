// 入口：创建游戏实例
import { Game } from './Game.js?v=20261114a';
import { Storage } from './Storage.js?v=20261114a';
import { pullProgress } from './Account.js?v=20261114a';
import { Room } from './Room.js?v=20261114a';
import { RogueUI } from './RogueUI.js?v=20261114a';
import { initInstall } from './Install.js?v=20261114a';
import { Invite } from './Invite.js?v=20261114a';
import { Chat } from './Chat.js?v=20261114a';
import { WhatsApp } from './WhatsApp.js?v=20261114a';
import { Milestones } from './Milestones.js?v=20261114a';

function showError(err) {
  console.error(err);
  document.getElementById('nogl').classList.remove('hidden');
}

try {
  const game = new Game(document.getElementById('game'));
  game.start();
  window.__room = new Room(game);   // 同图比赛
  window.__rogueUI = new RogueUI(game);   // Roguelike 模式
  initInstall();             // “下载到手机”按钮 + 离线缓存
  window.__invite = new Invite(game);   // 邀请好友：二维码、分享、每 10 人送兑换码
  window.__chat = new Chat(game);   // 留言板（聊天大厅）
  window.__wa = new WhatsApp(game);   // 填 WhatsApp 领随机皮肤
  window.__ms = new Milestones(game);   // 成绩挑战：达到目标分数送随机皮肤
  window.__game = game;      // 方便在控制台调试
  window.__jumpReady = true;

  // 多设备同步：打开页面、切回这个标签页时，从账号拉取别的设备上的新进度（只在主菜单时，避免打断游戏）
  let pulling = false;
  const pull = async () => {
    if (pulling || !Storage.getAccount() || game.state !== 'menu') return;
    pulling = true;
    try { const r = await pullProgress(); if (r.changed && game.state === 'menu') location.reload(); } catch (e) { /* 忽略 */ } finally { pulling = false; }
  };
  setTimeout(pull, 1200);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
} catch (err) {
  showError(err);
}
