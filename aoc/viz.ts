import { createCanvas } from "jsr:@gfx/canvas@0.5.6";
import { $ } from 'npm:zx@8';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

$.verbose = true;

export class Viz {
  public frames: number = 0;
  public tmpDir: string;
  constructor(public width: number, public height: number) {
    this.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-'));
  }
  public canvas: any;
  frame(callback: (ctx) => void, base: any) {
    this.canvas = base ?? this.canvas ?? createCanvas(this.width, this.height);
    const ctx = this.canvas.getContext("2d");
    callback(ctx);
    this.frames++;
    this.canvas.save(path.join(this.tmpDir, `${String(this.frames).padStart(10, '0')}.png`), 'png');
  }

  snapshot() {
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.canvas, 0, 0);
    return canvas;
  }

  async render(fps: number = 60, filename: string) {
    // const outfile = path.join(this.tmpDir, 'output.mp4');
    // await $`/opt/homebrew/bin/ffmpeg -framerate ${fps} -pattern_type glob -i ${path.join(this.tmpDir, '*.png')} -r ${fps} -c:v libx264 -pix_fmt yuv420p ${outfile}`;
    const outfile = path.join(this.tmpDir, 'output.gif');
    await $`/opt/homebrew/bin/ffmpeg -framerate ${fps} -pattern_type glob -i ${path.join(this.tmpDir, '*.png')} -vf "scale=320:-1:flags=lanczos" ${outfile}`;
    const out = fs.readFileSync(outfile);
    Deno.jupyter.display(Deno.jupyter.html`<img src="data:image/gif;base64,${out.toString('base64')}" />`);
    // Deno.jupyter.display(Deno.jupyter.html`<video controls><source src="data:video/mp4;base64,${out.toString('base64')}"></video>`);
    // Deno.jupyter.display(Deno.jupyter.html`<embed src="data:video/mp4;base64,${out.toString('base64')}" width="${this.width}" height="${this.height}" />`);
    // if (filename) {
      // console.log('copying', outfile, 'to', filename)
      // fs.cpSync(outfile, filename);
      // Deno.jupyter.display(Deno.jupyter.md`![video](./${filename})`);
    // }
  }
}
