import { Game } from './engine/Game';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element #webgl-canvas not found.');
  }

  const game = new Game(canvas);
  game.start();

  // Expose to window for debugging & testing in devtools console
  (window as unknown as { gtaGame: Game }).gtaGame = game;
});
