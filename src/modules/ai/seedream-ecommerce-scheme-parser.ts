/** 与阶段二 `images/generations` 的 `prompt` 拼接规则一致，便于前端自选方案后调用出图接口 */
export function formatSeedreamGenerationPrompt(positive: string, negative: string): string {
  const pos = positive.trim();
  const neg = negative.trim();
  return neg.length ? `${pos}\n\n【负面提示词 / 请避免】\n${neg}` : pos;
}

export type ParsedEcommerceSeedreamScheme = {
  /** 1 / 2 / 3 */
  schemeIndex: 1 | 2 | 3;
  /** 方案标题片段，如「方案一：【生活场景植入】」 */
  headingSnippet: string;
  positive: string;
  negative: string;
};

const SCHEME_MARKS: Array<{ schemeIndex: 1 | 2 | 3; mark: string }> = [
  { schemeIndex: 1, mark: "**方案一" },
  { schemeIndex: 2, mark: "**方案二" },
  { schemeIndex: 3, mark: "**方案三" },
];

function sliceBetween(full: string, startMark: string, nextMark: string | undefined): string | null {
  const i = full.indexOf(startMark);
  if (i === -1) return null;
  if (!nextMark) {
    return full.slice(i);
  }
  const j = full.indexOf(nextMark, i + startMark.length);
  if (j === -1) {
    return full.slice(i);
  }
  return full.slice(i, j);
}

function firstFenceAfterLabelRegex(block: string, labelRe: RegExp): string | null {
  const m = labelRe.exec(block);
  if (!m) return null;
  const slice = block.slice(m.index! + m[0].length);
  const f = slice.match(/```(?:markdown)?\s*([\s\S]*?)```/i);
  return f ? f[1].trim() : null;
}

/** 从分析模型 Markdown 中拆出三套方案的提示词与负面提示词（容错：缺一则另一侧仍可解析） */
export function parseEcommerceSeedreamSchemes(raw: string): ParsedEcommerceSeedreamScheme[] {
  const out: ParsedEcommerceSeedreamScheme[] = [];
  for (let k = 0; k < SCHEME_MARKS.length; k++) {
    const { schemeIndex, mark } = SCHEME_MARKS[k]!;
    const nextMark = SCHEME_MARKS[k + 1]?.mark;
    const block = sliceBetween(raw, mark, nextMark);
    if (!block) continue;

    const negIdx = (() => {
      const a = block.indexOf("**负面提示词**");
      const b = block.indexOf("**反向提示词**");
      if (a === -1) return b;
      if (b === -1) return a;
      return Math.min(a, b);
    })();

    const posPart = negIdx === -1 ? block : block.slice(0, negIdx);
    const negPart = negIdx === -1 ? "" : block.slice(negIdx);

    const posLabel = /\*\*\s*提示词\s*\*\*\s*[:：]?\s*/;
    const negLabel =
      /\*\*\s*(?:负面提示词|反向提示词)\s*\*\*\s*[:：]?\s*/;
    const positive = firstFenceAfterLabelRegex(posPart, posLabel);
    const negative = firstFenceAfterLabelRegex(negPart, negLabel);

    const pos = positive?.length ? positive : "";
    const neg = negative?.length ? negative : "";
    if (!pos && !neg) continue;

    const headLine = block.split(/\r?\n/).find((l) => l.includes(`方案${["一", "二", "三"][schemeIndex - 1]}`));
    out.push({
      schemeIndex,
      headingSnippet: (headLine ?? mark).trim().slice(0, 120),
      positive: pos,
      negative: neg,
    });
  }
  return out;
}
