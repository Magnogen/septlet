import { bind } from './gl.js';

on('load', async () => {

  const canvas = $('canvas');
  const app = bind(canvas);
  
  app.fragment(await fetch('./shader/main.frag', { cache: 'reload' }).then(res => res.text()));

  const positions = [];
  const radii = [];

  const tick = () => {

    canvas.width = innerWidth;
    canvas.height = innerHeight;

    app.uniform('time', performance.now() / 1000);
    app.uniform('res', [ canvas.width, canvas.height ]);
    app.uniform('pos', positions)
    app.uniform('r', radii)
    app.uniform('TOTAL_NODES', positions.length)
    
    app.render();

    requestAnimationFrame(tick);
  }

  tick();
    
});