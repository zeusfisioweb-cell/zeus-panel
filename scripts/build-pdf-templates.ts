/**
 * Builds fillable AcroForm templates from the original legal PDFs.
 *
 * For each consent document: removes the inline sample/test data (rendered in a
 * separate handwriting subset font) from the content streams and adds named
 * AcroForm text fields at the exact original coordinates. Output overwrites the
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
    normalizeLine,
    type TemplateSpec,
} from '../src/lib/patient-document-templates';

const DIR = path.join(process.cwd(), 'public', 'consentimientos');
const SCORE_RE = /[A-Za-z0-9 áéíóúñÁÉÍÓÚÑüÜ.,;:/()\-º°ª']/;

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
    const collect = (raw: string, isHex: boolean) => {
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

async function buildOne(docType: string, spec: TemplateSpec): Promise<void> {
    const srcPath = path.join(DIR, spec.sourcePdf);
    const doc = await PDFDocument.load(await readFile(srcPath), { updateMetadata: false });
    const pages = doc.getPages();

    // 0. Strip every pre-existing annotation. The original carries Ink
    //    scribbles + Popups that were drawn over the sample data to redact it
    //    (they survive sample-font stripping and show as struck-through/cut
    //    blanks). addToPage repopulates Annots with only our widgets.
    for (const page of pages) page.node.delete(PDFName.of('Annots'));

    // 1. Score every font resource across all pages; the sample/test-data font
    //    is a usage-ordered subset that does not decode under the +29 heuristic.
    const fontGids: Record<string, number[]> = {};
    type PageChunk = { pageIdx: number; ref: unknown; text: string };
    const chunks: PageChunk[] = [];

    pages.forEach((page, pi) => {
        const node = page.node;
        const contents = node.Contents();
        const refs: unknown[] =
            contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
        for (const ref of refs) {
            const st = (doc.context.lookup(ref) as PDFStream);
            const text = Buffer.from(streamBytes(st)).toString('latin1');
            chunks.push({ pageIdx: pi, ref, text });
            const toks = tokenize(text);
            let font: string | null = null;
            for (let i = 0; i < toks.length; i++) {
                const t = toks[i];
                if (t.v === 'Tf') font = toks[i - 2]?.v ?? font;
                else if ((t.v === 'Tj' || t.v === 'TJ' || t.v === "'" || t.v === '"') && font) {
                    (fontGids[font] ||= []).push(...gidsOf(toks[i - 1]));
                }
            }
        }
    });

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

    // 2. Rewrite each content stream, dropping show-text ops whose active font
    //    is a sample font (and their operand). Positioning ops are preserved.
    for (const ch of chunks) {
        const toks = tokenize(ch.text);
        if (toks.some((t) => t.v === 'BI')) {
            throw new Error(`${docType} page ${ch.pageIdx}: inline image present, aborting strip`);
        }
        const drop = new Set<number>();
        let font: string | null = null;
        for (let i = 0; i < toks.length; i++) {
            const t = toks[i];
            if (t.v === 'Tf') font = toks[i - 2]?.v ?? font;
            else if (t.v === 'Tj' || t.v === 'TJ' || t.v === "'" || t.v === '"') {
                if (font && sampleFonts.has(font)) {
                    drop.add(i);
                    if (toks[i - 1] && ['str', 'hex', 'arr'].includes(toks[i - 1].kind)) drop.add(i - 1);
                }
            }
        }
        if (drop.size === 0) continue;
        let out = '';
        let cursor = 0;
        for (let i = 0; i < toks.length; i++) {
            if (!drop.has(i)) continue;
            out += ch.text.slice(cursor, toks[i].start);
            cursor = toks[i].end;
        }
        out += ch.text.slice(cursor);
        const newStream = doc.context.flateStream(Buffer.from(out, 'latin1'));
        const newRef = doc.context.register(newStream);
        const node = pages[ch.pageIdx].node;
        node.set(PDFName.of('Contents'), newRef);
    }

    // 3. Add AcroForm text fields at the original slot coordinates.
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
        // Fixed size derived from the original blank: the slot width equals the
        // sample-text extent, so Helvetica at this size always fits.
        field.setFontSize(fontSize);
    }

    // Signature areas: a clean printed line under each "Firma" label. No
    // AcroForm field — an editable field renders as a tinted box in Chrome,
    // which reads as broken. The line is signable on paper or with any PDF
    // viewer's annotate/sign tool.
    for (const sig of spec.signatureFields ?? []) {
        // White band from just under the "Firma" label down past where the
        // original guide + baked sample signature sit (vector ink that the
        // annotation/font strips don't remove). Clear of the label and prose.
        const top = sig.labelBaseline - 4;
        const bottom = sig.labelBaseline - 118;
        pages[sig.page].drawRectangle({
            x: 64,
            y: bottom,
            width: 472,
            height: top - bottom,
            color: rgb(1, 1, 1),
            borderWidth: 0,
        });
        // One clean signature line a short gap below the label.
        pages[sig.page].drawLine({
            start: { x: 76, y: sig.labelBaseline - 24 },
            end: { x: 320, y: sig.labelBaseline - 24 },
            thickness: 0.75,
            color: rgb(0.4, 0.4, 0.4),
        });
    }

    // Remove widget border/background dicts so no box is drawn over the legal
    // prose when appearances are regenerated at fill time.
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

const M = (a: number[], b: number[]): number[] => [
    a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
];

interface Ev { ref: unknown; opI: number; argI: number; x: number; y: number; size: number; text: string }
interface Line { y: number; xMin: number; size: number; evs: Ev[]; text: string }

function pageLines(text: string, ref: unknown): Ev[] {
    const toks = tokenize(text);
    const evs: Ev[] = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    let tm = [1, 0, 0, 1, 0, 0];
    let tlm = [1, 0, 0, 1, 0, 0];
    let fs = 0;
    let lead = 0;
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
        else if (op === 'Tf') { fs = parseFloat(toks[i - 1].v); args.length = 0; }
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
            evs.push({ ref, opI: i, argI: i - 1, x: trm[4], y: trm[5], size: Math.hypot(trm[2], trm[3]), text: txt });
            args.length = 0;
        } else args.length = 0;
    }
    return evs;
}

function groupLines(evs: Ev[]): Line[] {
    const sorted = evs.slice().sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const lines: Line[] = [];
    let cur: Line | null = null;
    for (const e of sorted) {
        if (!e.text) continue;
        if (cur && Math.abs(e.y - cur.y) <= 2.5) {
            cur.evs.push(e);
            cur.xMin = Math.min(cur.xMin, e.x);
            cur.size = Math.max(cur.size, e.size);
            cur.text += e.text;
        } else {
            if (cur && cur.text.trim()) lines.push(cur);
            cur = { y: e.y, xMin: e.x, size: e.size, evs: [e], text: e.text };
        }
    }
    if (cur && cur.text.trim()) lines.push(cur);
    return lines;
}

async function buildHistoria(docType: string, spec: TemplateSpec): Promise<void> {
    const srcPath = path.join(DIR, spec.sourcePdf);
    const doc = await PDFDocument.load(await readFile(srcPath), { updateMetadata: false });
    const pages = doc.getPages();
    const form = doc.getForm();
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const anchors = spec.historiaAnchors ?? [];
    const HEADING_MIN = 13;
    const LABEL_X = 95;

    interface FieldDef {
        name: string;
        page: number;
        rect: [number, number, number, number];
        multiline: boolean;
    }
    const fields: FieldDef[] = [];
    const dropByRef = new Map<unknown, Set<number>>();
    const markDrop = (ref: unknown, ...idx: number[]) => {
        let s = dropByRef.get(ref);
        if (!s) { s = new Set(); dropByRef.set(ref, s); }
        for (const i of idx) s.add(i);
    };

    pages.forEach((page, pi) => {
        const { width, height } = page.getSize();
        const rightMargin = width - 72;
        const contents = page.node.Contents();
        const refs: unknown[] =
            contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
        const evs: Ev[] = [];
        for (const ref of refs) {
            const txt = Buffer.from(streamBytes(doc.context.lookup(ref) as PDFStream)).toString('latin1');
            evs.push(...pageLines(txt, ref));
        }
        const lines = groupLines(evs);
        // Section headings are ~15.6pt; the document title is ~14.9pt — exclude
        // it so the date/place line (between title and first heading) is found.
        const SECTION_MIN = 15.2;
        const firstHeadingY =
            lines.find((l) => l.size >= SECTION_MIN && l.xMin < LABEL_X)?.y ?? height;

        // Static = headings, indented labels/prompts, page footer (bottom) and
        // the running header (top band) — none of which carry sample data.
        const isStatic = (l: Line): boolean =>
            l.size >= HEADING_MIN ||
            l.y < 50 ||
            l.y > height - 55 ||
            l.xMin >= LABEL_X;

        let open: { field: string; topY: number } | null = null;
        const closeBlock = (bottomY: number) => {
            if (!open) return;
            const top = open.topY;
            const bot = Math.min(bottomY, top - 12);
            fields.push({
                name: open.field,
                page: pi,
                rect: [76, bot, rightMargin, top],
                multiline: true,
            });
            open = null;
        };

        for (const line of lines) {
            const norm = normalizeLine(line.text);

            // Date/place line: body-size text in the left column sitting between
            // the title and the first section heading (not a header/footer).
            if (
                line.size >= 9 &&
                line.size < HEADING_MIN &&
                line.xMin < LABEL_X &&
                line.y > firstHeadingY &&
                line.y < height - 55
            ) {
                for (const e of line.evs) markDrop(e.ref, e.opI, e.argI);
                fields.push({
                    name: 'historia_fecha',
                    page: pi,
                    rect: [line.xMin, line.y - line.size * 0.28, rightMargin, line.y + line.size],
                    multiline: false,
                });
                continue;
            }

            if (isStatic(line)) {
                // Inline "Label:value" on the same indented line.
                if (line.xMin >= LABEL_X && line.text.includes(':')) {
                    const colon = line.evs.findIndex((e) => e.text.includes(':'));
                    const valueEvs = line.evs.slice(colon + 1);
                    const anchor = anchors.find((a) => a.kind === 'inline' && norm.startsWith(a.match));
                    if (anchor) {
                        closeBlock(line.y + line.size);
                        for (const e of valueEvs) markDrop(e.ref, e.opI, e.argI);
                        const labelEnd = line.evs[colon];
                        const x0 = valueEvs[0]?.x ?? labelEnd.x + labelEnd.size * 0.7;
                        fields.push({
                            name: anchor.field,
                            page: pi,
                            rect: [x0, line.y - line.size * 0.28, rightMargin, line.y + line.size],
                            multiline: false,
                        });
                        continue;
                    }
                }
                // Heading / label-only / prompt: may open a block.
                const block = anchors.find((a) => a.kind === 'block' && norm.startsWith(a.match));
                if (block) {
                    closeBlock(line.y + line.size);
                    // Drop the block top a bit below the heading so the
                    // top of the rendered value (ascender of «-marker / first
                    // capital) is not clipped by the box edge.
                    open = { field: block.field, topY: line.y - line.size * 1.6 };
                } else {
                    closeBlock(line.y + line.size);
                }
                continue;
            }

            // Value line: belongs to the currently open block.
            for (const e of line.evs) markDrop(e.ref, e.opI, e.argI);
        }
        closeBlock(60);
    });

    // Rewrite content streams, removing dropped show-text ops + operands.
    pages.forEach((page) => {
        const contents = page.node.Contents();
        const refs: unknown[] =
            contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
        for (const ref of refs) {
            const drop = dropByRef.get(ref);
            if (!drop || drop.size === 0) continue;
            const raw = Buffer.from(streamBytes(doc.context.lookup(ref) as PDFStream)).toString('latin1');
            const toks = tokenize(raw);
            let out = '';
            let cursor = 0;
            for (let i = 0; i < toks.length; i++) {
                if (!drop.has(i)) continue;
                out += raw.slice(cursor, toks[i].start);
                cursor = toks[i].end;
            }
            out += raw.slice(cursor);
            const ns = doc.context.flateStream(Buffer.from(out, 'latin1'));
            page.node.set(PDFName.of('Contents'), doc.context.register(ns));
        }
    });

    const created = new Set<string>();
    for (const f of fields) {
        let tf;
        if (created.has(f.name)) tf = form.getTextField(f.name);
        else { tf = form.createTextField(f.name); created.add(f.name); }
        if (f.multiline) tf.enableMultiline();
        tf.addToPage(pages[f.page], {
            x: f.rect[0],
            y: f.rect[1],
            width: Math.max(8, f.rect[2] - f.rect[0]),
            height: Math.max(8, f.rect[3] - f.rect[1]),
            borderWidth: 0,
            backgroundColor: undefined,
            textColor: rgb(0, 0, 0),
            font: helv,
        });
        tf.setFontSize(f.multiline ? 9 : 0);
    }
    for (const name of created) {
        for (const w of form.getTextField(name).acroField.getWidgets()) {
            w.dict.delete(PDFName.of('BS'));
            w.dict.delete(PDFName.of('MK'));
        }
    }

    const outName = spec.sourcePdf.replace('_original.pdf', '_template.pdf');
    await writeFile(path.join(DIR, outName), await doc.save());
    console.log(`${docType}: wrote ${outName} (historia, fields: ${[...created].join(', ')})`);
}

async function main(): Promise<void> {
    for (const [docType, spec] of Object.entries(PATIENT_DOCUMENT_TEMPLATES)) {
        if (!spec) continue;
        if (spec.mode === 'historia') await buildHistoria(docType, spec);
        else await buildOne(docType, spec);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
