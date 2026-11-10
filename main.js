// 入口：创建游戏实例
import { Game } from './Game.js?v=20261110t';
import { Storage } from './Storage.js?v=20261110t';
import { pullProgress } from './Account.js?v=20261110t';
import { Room } from './Room.js?v=20261110t';

function showError(err) {
  console.error(err);
  document.getElementById('nogl').classList.remove('hidden');
}

try {
  const game = new Game(document.getElementById('game'));
  game.start();
  window.__room = new Room(game);   // 同图比赛
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
