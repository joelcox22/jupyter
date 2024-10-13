import * as fs from "jsr:@std/fs";
import * as path from "jsr:@std/path";
import * as cheerio from "npm:cheerio";
import * as htmlEntities from "jsr:@std/html/entities";
import * as Plot from "npm:@observablehq/plot";
import { JSDOM } from "npm:jsdom";
import sharp from "npm:sharp";
import { Buffer } from "node:buffer";

async function getCookie(): Promise<string> {
  const file = path.join(import.meta.dirname!, "cookie.txt");
  try {
    return (await Deno.readTextFile(file)).trim();
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      throw new Error("Cookie file not found");
    } else {
      throw err;
    }
  }
}

function parse(html: string): string {
  return html
    .match(/<main>(.*?)<\/main>/s)?.[1]
    .replace(/<[^>]*>/g, "")
    .trim()!;
}

async function getInput(year: number, day: number): Promise<string> {
  const file = path.join(
    import.meta.dirname!,
    "inputs",
    year.toString(),
    `${day}.txt`
  );
  try {
    return await Deno.readTextFile(file);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      const url = `https://adventofcode.com/${year}/day/${day}/input`;
      const data = fetch(url, {
        headers: {
          Cookie: await getCookie(),
        },
      });
      const response = await data;
      const text = (await response.text()).trim();
      await fs.ensureDir(path.dirname(file));
      await Deno.writeTextFile(file, text);
      return text;
    } else {
      throw err;
    }
  }
}

interface Page {
  part1: string;
  part1Answer?: number;
  part2: string;
  part2Answer?: number;
}

function html(str: string | null) {
  if (!str) return;
  Deno.jupyter.display(Deno.jupyter.html`
    <style>
      * {
        font-family: courier;
        font-size: 1.1em;
      }
      code.input {
        display: block;
        max-height: 200px;
        overflow: auto;
        margin-top: 10px;
        white-space: pre;
      }
    </style>
    ${str}
  `);
}

async function read(year: number, day: number): Promise<Page> {
  const url = `https://adventofcode.com/${year}/day/${day}`;
  const data = fetch(url, {
    headers: {
      Cookie: await getCookie(),
    },
  });
  const response = await data;
  const text = await response.text();
  const $ = cheerio.load(text);
  const articles = $("article");
  const answers = articles
    .next("p")
    .toArray()
    .map((p) =>
      parseInt(
        $(p)
          .text()
          .match(/Your puzzle answer was (?<answer>\d+)\./)?.[1] ?? ""
      )
    );
  return {
    part1:
      articles.eq(0).html() ||
      `failed to read first article element from ${url}`,
    part1Answer: answers[0],
    part2:
      articles.eq(1).html() ||
      `failed to read second article element from ${url}`,
    part2Answer: answers[1],
  };
}

interface Attempt {
  answer: number;
  response: string;
  time: string;
  correct: boolean;
}

interface Results {
  part1: Attempt[];
  part2: Attempt[];
}

async function answer(
  year: number,
  day: number,
  part: number,
  answer: number,
  page: Page
): Promise<boolean> {
  if (typeof answer !== "number") {
    throw new Error("Answer must be a number");
  }
  const attemptsFile = path.join(
    import.meta.dirname!,
    "answers",
    year.toString(),
    `${day}.json`
  );
  await fs.ensureDir(path.dirname(attemptsFile));
  let results: Results = {
    part1: [],
    part2: [],
  };
  try {
    results = JSON.parse(await Deno.readTextFile(attemptsFile));
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      throw err;
    }
  }
  const key = `part${part}` as keyof Results;
  const answerKey = `part${part}Answer` as keyof Page;
  const solved = typeof page[answerKey] === "number" && !isNaN(page[answerKey]);
  if (solved) {
    if (answer === page[answerKey]) {
      console.log(`✅ Part ${part} answer ${answer}`);
      return true;
    } else {
      console.log(
        `❌ Part ${part} answer ${answer} is wrong. The correct answer ${page[answerKey]} was already submitted.`
      );
      return false;
    }
  }
  const alreadyAnswered = results[key].find((a) => a.answer === answer);
  if (alreadyAnswered) {
    console.log(
      `❌ Part ${part} answer ${answer} is wrong, already attempted at ${alreadyAnswered.time}.`
    );
    return false;
  }
  const req = await fetch(
    `https://adventofcode.com/${year}/day/${day}/answer`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: await getCookie(),
      },
      body: new URLSearchParams({
        level: part.toString(),
        answer: answer.toString(),
      }),
    }
  );
  const res = parse(await req.text());
  const correct = res.includes("That's the right answer");
  results[key].push({
    answer,
    time: new Date().toISOString(),
    response: res,
    correct,
  });
  await Deno.writeTextFile(attemptsFile, JSON.stringify(results, null, 2));
  if (correct) {
    console.log(`✅ Part ${part} answer ${answer}`);
    return true;
  } else {
    console.log(`❌ Part ${part} answer ${answer} is wrong. ${res}`);
    return false;
  }
}

export default class Aoc {
  private constructor(
    public year: number,
    public day: number,
    public input: string,
    public page: Page
  ) {}

  static async load(year: number, day: number): Promise<Aoc> {
    const page = await read(year, day);
    html(page.part1);
    const input = await getInput(year, day);
    html(`
      <p>To begin, here's your puzzle input:</p>
      <code class="input">${htmlEntities.escape(input)}</code>
    `);
    const aoc = new Aoc(year, day, input, page);
    return aoc;
  }

  async answer1(value: number): Promise<boolean> {
    const result = await answer(this.year, this.day, 1, value, this.page);
    if (!this.page.part2) {
      this.page = await read(this.year, this.day);
    }
    html(this.page.part2);
    return result;
  }

  async answer2(value: number): Promise<boolean> {
    return answer(this.year, this.day, 2, value, this.page);
  }
}

export async function draw(...marks: Plot.Markish[]) {
  const plot = Plot.plot({
    width: 1000,
    height: 600,
    style: {
      background: "white",
      color: "black",
    },
    marks,
    document: new JSDOM("").window.document,
  });
  return Deno.jupyter.svg`${plot.outerHTML}`;
  // return Deno.jupyter.display({ "image/svg": plot.outerHTML }, { raw: true });
  /*
  const png = await sharp(Buffer.from(plot.outerHTML, "utf-8")).png();
  return Deno.jupyter.display({ "image/svg": png }, { raw: true });
  */
}
