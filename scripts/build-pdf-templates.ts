/**
 * Builds fillable AcroForm templates from the original legal PDFs.
 *
 * For each consent document: removes the inline sample/data text rendered in
 * the embedded subset font ONLY on rows that correspond to a fillable slot
 * (so baked clinic data like "ZEUS FISIOTERAPIA", "Aarón López Jarillo" and
 * the practice address stay intact on other rows). Then adds named AcroForm
 * text fields at the exact original coordinates. Output overwrites the
 * matching *_template.pdf in public/consentimientos.
 *
 *   node_modules/.bin/tsx scripts/build-pdf-templates.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
    PDFDocument,
    PDFName,
    PDFArray,
    PDFStream,
    PDFRawStream,
    decodePDFRawStream,
    StandardFonts,
    rgb,
} from 'pdf-lib';
import {
    PATIENT_DOCUMENT_TEMPLATES,
    slotRect,
    type TemplateSpec,
} from '../src/lib/patient-document-templates';

const DIR = path.join(process.cwd(), 'public', 'consentimientos');
const SCORE_RE = /[A-Za-z0-9 áéíóúñÁÉÍÓÚÑüÜ.,;:/()\-º°ª']/;
const BASELINE_TOLERANCE = 3;

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

const MM = (a: number[], b: number[]): number[] => [
    a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
];

interface ShowEv { tokIdx: number; argIdx: number; font: string | null; y: number }

function showEvents(text: string): ShowEv[] {
    const toks = tokenize(text);
    const evs: ShowEv[] = [];
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
        else if (op === 'cm') { const a = pop(6); ctm = MM(a, ctm); }
        else if (op === 'Tf') { fs = parseFloat(toks[i - 1].v); font = toks[i - 2]?.v ?? font; args.length = 0; }
        else if (op === 'BT') { tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); }
        else if (op === 'TL') lead = pop(1)[0];
        else if (op === 'Td') { const [x, y] = pop(2); tlm = MM([1, 0, 0, 1, x, y], tlm); tm = tlm.slice(); }
        else if (op === 'TD') { const [x, y] = pop(2); lead = -y; tlm = MM([1, 0, 0, 1, x, y], tlm); tm = tlm.slice(); }
        else if (op === 'Tm') { const a = pop(6); tlm = a; tm = a.slice(); }
        else if (op === 'T*') { tlm = MM([1, 0, 0, 1, 0, -lead], tlm); tm = tlm.slice(); }
        else if (op === 'Tj' || op === 'TJ' || op === "'" || op === '"') {
            if (op !== 'Tj' && op !== 'TJ') { tlm = MM([1, 0, 0, 1, 0, -lead], tlm); tm = tlm.slice(); }
            const trm = MM(MM([fs, 0, 0, fs, 0, 0], tm), ctm);
            evs.push({ tokIdx: i, argIdx: i - 1, font, y: trm[5] });
            args.length = 0;
        } else args.length = 0;
    }
    return evs;
}

interface ChunkInfo { ref: unknown; pageIdx: number; text: string; toks: Tok[]; evs: ShowEv[] }

async function buildOne(docType: string, spec: TemplateSpec): Promise<void> {
    const srcPath = path.join(DIR, spec.sourcePdf);
    const doc = await PDFDocument.load(await readFile(srcPath), { updateMetadata: false });
    const pages = doc.getPages();

    // 0. Strip every pre-existing annotation. Originals may carry Ink
    //    scribbles + Popups drawn over the sample data to redact it.
    for (const page of pages) page.node.delete(PDFName.of('Annots'));

    // 1. Collect content streams + show-text events per page.
    const fontGids: Record<string, number[]> = {};
    const chunks: ChunkInfo[] = [];

    pages.forEach((page, pi) => {
        const contents = page.node.Contents();
        const refs: unknown[] =
            contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
        for (const ref of refs) {
            const st = doc.context.lookup(ref) as PDFStream;
            const text = Buffer.from(streamBytes(st)).toString('latin1');
            const toks = tokenize(text);
            const evs = showEvents(text);
            chunks.push({ ref, pageIdx: pi, text, toks, evs });
            for (const ev of evs) {
                if (!ev.font) continue;
                (fontGids[ev.font] ||= []).push(...gidsOf(toks[ev.argIdx]));
            }
        }
    });

    // 2. Score each font: the data/sample font is a usage-ordered subset that
    //    does not decode under the +29 heuristic.
    const sampleFonts = new Set<string>();
    for (const [fk, gids] of Object.entries(fontGids)) {
        let ok = 0;
        let tot = 0;
        for (const g of gids) {
            if (!g) continue;
            tot++;
            if (SCORE_RE.test(String.fromCharCode(g + 29))) ok++;
        }
        if (tot && ok / tot < 0.6) sampleFonts.add(fk);
    }
    console.log(`${docType}: sample fonts =`, [...sampleFonts].join(', ') || '(none)');

    // 3. Drop sample-font show-text ops ONLY when they sit on a slot baseline
    //    listed in the spec. Sample-font text on other rows (clinic name,
    //    address, responsible therapist) is preserved.
    const baselines = spec.slotBaselines ?? [];
    for (const ch of chunks) {
        if (ch.toks.some((t) => t.v === 'BI')) {
            throw new Error(`${docType} page ${ch.pageIdx}: inline image present, aborting strip`);
        }
        const drop = new Set<number>();
        for (const ev of ch.evs) {
            if (!ev.font || !sampleFonts.has(ev.font)) continue;
            const onSlot = baselines.some(
                (b) => b.page === ch.pageIdx && Math.abs(ev.y - b.y) <= BASELINE_TOLERANCE
            );
            if (!onSlot) continue;
            drop.add(ev.tokIdx);
            const arg = ch.toks[ev.argIdx];
            if (arg && ['str', 'hex', 'arr'].includes(arg.kind)) drop.add(ev.argIdx);
        }
        if (drop.size === 0) continue;
        let out = '';
        let cursor = 0;
        for (let i = 0; i < ch.toks.length; i++) {
            if (!drop.has(i)) continue;
            out += ch.text.slice(cursor, ch.toks[i].start);
            cursor = ch.toks[i].end;
        }
        out += ch.text.slice(cursor);
        const newStream = doc.context.flateStream(Buffer.from(out, 'latin1'));
        const newRef = doc.context.register(newStream);
        pages[ch.pageIdx].node.set(PDFName.of('Contents'), newRef);
    }

    // 4. Add AcroForm text fields at the slot coordinates.
    const form = doc.getForm();
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const created = new Set<string>();
    for (const slot of spec.slots) {
        const { rect, fontSize } = slotRect(slot);
        const page = pages[slot.page];
        let field;
        if (created.has(slot.field)) {
            field = form.getTextField(slot.field);
        } else {
            field = form.createTextField(slot.field);
            created.add(slot.field);
        }
        field.addToPage(page, {
            x: rect[0],
            y: rect[1],
            width: rect[2] - rect[0],
            height: rect[3] - rect[1],
            borderWidth: 0,
            backgroundColor: undefined,
            textColor: rgb(0, 0, 0),
            font: helv,
        });
        field.setFontSize(fontSize);
    }

    for (const name of created) {
        for (const w of form.getTextField(name).acroField.getWidgets()) {
            w.dict.delete(PDFName.of('BS'));
            w.dict.delete(PDFName.of('MK'));
        }
    }

    const outName = spec.sourcePdf.replace('_original.pdf', '_template.pdf');
    const bytes = await doc.save();
    await writeFile(path.join(DIR, outName), bytes);
    console.log(`${docType}: wrote ${outName} (${spec.slots.length} slots, fields: ${[...created].join(', ')})`);
}

async function main(): Promise<void> {
    for (const [docType, spec] of Object.entries(PATIENT_DOCUMENT_TEMPLATES)) {
        if (!spec) continue;
        await buildOne(docType, spec);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
