/**
 * Inspector: prints every text-show event in a PDF with its baseline
 * coordinates. Used to measure slot positions for AcroForm calibration.
 *
 *   npx tsx scripts/inspect-pdf-lines.ts <path-to-pdf> [pageIndex]
 */
import { readFile } from 'node:fs/promises';
import {
    PDFDocument,
    PDFArray,
    PDFStream,
    PDFRawStream,
    decodePDFRawStream,
} from 'pdf-lib';

function streamBytes(s: PDFStream): Uint8Array {
    if (s instanceof PDFRawStream) return decodePDFRawStream(s).decode();
    // @ts-expect-error pdf-lib content streams expose getContents
    if (typeof s.getContents === 'function') return s.getContents();
    return decodePDFRawStream(s as PDFRawStream).decode();
}

interface Tok { raw: string; start: number; end: number; kind: string; v: string }

function tokenize(s: string): Tok[] {
    const toks: Tok[] = [];
    const re =
        /\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f\s]*>|\[(?:[^\[\]\\]|\\.)*\]|\/[^\s\/\[\]<>(){}]+|-?\d*\.?\d+|BT|ET|Td|TD|Tm|T\*|TL|Tf|Tj|TJ|'|"|cm|q|Q|gs|Do|BI|ID|EI|BDC|EMC|BMC/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
        const raw = m[0];
        let kind = 'op';
        if (raw[0] === '(') kind = 'str';
        else if (raw[0] === '<') kind = 'hex';
        else if (raw[0] === '[') kind = 'arr';
        else if (raw[0] === '/') kind = 'name';
        else if (/^-?\d*\.?\d+$/.test(raw)) kind = 'num';
        toks.push({ raw, start: m.index, end: m.index + raw.length, kind, v: raw });
    }
    return toks;
}

function gidsOf(tok: Tok): number[] {
    const out: number[] = [];
    const collect = (raw: string, isHex: boolean): void => {
        const codes: number[] = [];
        if (isHex) {
            const h = raw.replace(/[<>\s]/g, '');
            for (let i = 0; i < h.length; i += 2) codes.push(parseInt(h.slice(i, i + 2).padEnd(2, '0'), 16));
        } else {
            const body = raw.slice(1, -1).replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_s, g) => {
                const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
                return map[g] ?? String.fromCharCode(parseInt(g, 8));
            });
            for (const ch of body) codes.push(ch.charCodeAt(0));
        }
        for (let i = 0; i + 1 < codes.length; i += 2) out.push((codes[i] << 8) | codes[i + 1]);
    };
    if (tok.kind === 'arr') {
        for (const seg of tok.raw.matchAll(/\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f]+)>/g)) {
            if (seg[1] !== undefined) collect(`(${seg[1]})`, false);
            else collect(`<${seg[2]}>`, true);
        }
    } else {
        collect(tok.raw, tok.kind === 'hex');
    }
    return out;
}

const M = (a: number[], b: number[]): number[] => [
    a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
];

interface Ev { x: number; y: number; size: number; text: string; font: string | null }

function pageEvents(text: string): Ev[] {
    const toks = tokenize(text);
    const evs: Ev[] = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    let tm = [1, 0, 0, 1, 0, 0];
    let tlm = [1, 0, 0, 1, 0, 0];
    let fs = 0;
    let lead = 0;
    let font: string | null = null;
    const args: Tok[] = [];
    const pop = (n: number): number[] => {
        const a = args.slice(-n).map((x) => parseFloat(x.v));
        args.length = Math.max(0, args.length - n);
        return a;
    };
    for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t.kind !== 'op') { args.push(t); continue; }
        const op = t.v;
        if (op === 'q') stack.push(ctm.slice());
        else if (op === 'Q') ctm = stack.pop() ?? ctm;
        else if (op === 'cm') { const a = pop(6); ctm = M(a, ctm); }
        else if (op === 'Tf') { fs = parseFloat(toks[i - 1].v); font = toks[i - 2]?.v ?? font; args.length = 0; }
        else if (op === 'BT') { tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); }
        else if (op === 'TL') lead = pop(1)[0];
        else if (op === 'Td') { const [x, y] = pop(2); tlm = M([1, 0, 0, 1, x, y], tlm); tm = tlm.slice(); }
        else if (op === 'TD') { const [x, y] = pop(2); lead = -y; tlm = M([1, 0, 0, 1, x, y], tlm); tm = tlm.slice(); }
        else if (op === 'Tm') { const a = pop(6); tlm = a; tm = a.slice(); }
        else if (op === 'T*') { tlm = M([1, 0, 0, 1, 0, -lead], tlm); tm = tlm.slice(); }
        else if (op === 'Tj' || op === 'TJ' || op === "'" || op === '"') {
            if (op !== 'Tj' && op !== 'TJ') { tlm = M([1, 0, 0, 1, 0, -lead], tlm); tm = tlm.slice(); }
            const arg = toks[i - 1];
            const gids = gidsOf(arg);
            const txt = gids.map((g) => (g ? String.fromCharCode(g + 29) : '')).join('');
            const trm = M(M([fs, 0, 0, fs, 0, 0], tm), ctm);
            const advanceX = Math.hypot(trm[0], trm[1]);
            const advanceY = Math.hypot(trm[2], trm[3]);
            evs.push({
                x: trm[4],
                y: trm[5],
                size: Math.max(advanceX, advanceY),
                text: txt,
                font,
            });
            args.length = 0;
        } else args.length = 0;
    }
    return evs;
}

interface Line { y: number; size: number; chunks: Ev[] }

function groupLines(evs: Ev[]): Line[] {
    const sorted = evs.slice().sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const lines: Line[] = [];
    let cur: Line | null = null;
    for (const e of sorted) {
        if (cur && Math.abs(e.y - cur.y) <= 2.5) {
            cur.chunks.push(e);
            cur.size = Math.max(cur.size, e.size);
        } else {
            if (cur) lines.push(cur);
            cur = { y: e.y, size: e.size, chunks: [e] };
        }
    }
    if (cur) lines.push(cur);
    return lines;
}

async function main(): Promise<void> {
    const [, , pdfPath, pageArg] = process.argv;
    if (!pdfPath) {
        process.stderr.write('usage: tsx scripts/inspect-pdf-lines.ts <pdf> [pageIndex]\n');
        process.exit(1);
    }
    const doc = await PDFDocument.load(await readFile(pdfPath), { updateMetadata: false });
    const pages = doc.getPages();
    const onlyPage = pageArg !== undefined ? Number(pageArg) : null;

    pages.forEach((page, pi) => {
        if (onlyPage !== null && pi !== onlyPage) return;
        const contents = page.node.Contents();
        const refs: unknown[] =
            contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
        const evs: Ev[] = [];
        for (const ref of refs) {
            const txt = Buffer.from(streamBytes(doc.context.lookup(ref) as PDFStream)).toString('latin1');
            evs.push(...pageEvents(txt));
        }
        const lines = groupLines(evs);
        const { width, height } = page.getSize();
        process.stdout.write(`\n=== page ${pi} (${width.toFixed(1)} x ${height.toFixed(1)}) — ${lines.length} lines ===\n`);
        for (const line of lines) {
            const text = line.chunks.map((c) => c.text).join('');
            const x0 = Math.min(...line.chunks.map((c) => c.x));
            const x1 = Math.max(...line.chunks.map((c) => c.x + line.size * c.text.length * 0.5));
            process.stdout.write(
                `y=${line.y.toFixed(1).padStart(7)} x=${x0.toFixed(1).padStart(6)}-${x1.toFixed(1).padStart(6)} sz=${line.size.toFixed(1)}  ${JSON.stringify(text)}\n`
            );
        }
    });
}

main().catch((e) => {
    process.stderr.write(`${e}\n`);
    process.exit(1);
});
