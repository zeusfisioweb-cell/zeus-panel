/**
 * Splits each rendered test PDF into per-page single-page PDFs so sips can
 * convert each page to PNG for visual inspection.
 *
 *   node_modules/.bin/tsx scripts/dev/pdf-pages-to-png.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

const IN_DIR = '/tmp/zeus-pdf-test';
const FILES = [
    'data_consent_filled.pdf',
    'intervention_consent_filled.pdf',
    'clinical_history_filled.pdf',
];

async function splitOne(file: string): Promise<void> {
    const stem = file.replace(/\.pdf$/, '');
    const src = await PDFDocument.load(await readFile(path.join(IN_DIR, file)));
    const pageCount = src.getPageCount();
    for (let i = 0; i < pageCount; i++) {
        const dst = await PDFDocument.create();
        const [page] = await dst.copyPages(src, [i]);
        dst.addPage(page);
        const outPdf = path.join(IN_DIR, `${stem}_p${i + 1}.pdf`);
        await writeFile(outPdf, await dst.save());
        const outPng = path.join(IN_DIR, `${stem}_p${i + 1}.png`);
        const r = spawnSync('sips', ['-s', 'format', 'png', outPdf, '--out', outPng], {
            stdio: 'pipe',
        });
        if (r.status !== 0) {
            process.stderr.write(`sips failed for ${outPdf}: ${r.stderr.toString()}\n`);
        }
    }
    process.stdout.write(`[ok] ${file} (${pageCount} pages)\n`);
}

async function main(): Promise<void> {
    for (const f of FILES) await splitOne(f);
}

main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    process.stderr.write(`[error] ${msg}\n`);
    process.exit(1);
});
