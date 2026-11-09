// 入口：创建游戏实例
import { Game } from './Game.js?v=20261110k';

function showError(err) {
  console.error(err);
  document.getElementById('nogl').classList.remove('hidden');
}

try {
  const game = new Game(document.getElementById('game'));
  game.start();
  window.__game = game;      // 方便在控制台调试
  window.__jumpReady = true;
} catch (err) {
  showError(err);
}
