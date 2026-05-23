/**
 * Dumps every AcroForm field in each patient document template:
 * field name, page, widget rect, multiline flag, font size.
 *
 *   node_modules/.bin/tsx scripts/dev/inspect-template-fields.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, PDFTextField } from 'pdf-lib';

const FILES = [
    'historia_clinica_fisioterapeutica_template.pdf',
    'consentimiento_lopd_template.pdf',
    'consentimiento_intervencion_template.pdf',
];

async function dumpOne(file: string): Promise<void> {
    const full = path.join(process.cwd(), 'public', 'consentimientos', file);
    const doc = await PDFDocument.load(await readFile(full));
    const form = doc.getForm();
    process.stdout.write(`\n=== ${file} ===\n`);
    for (const field of form.getFields()) {
        if (!(field instanceof PDFTextField)) continue;
        const name = field.getName();
        const multi = field.isMultiline();
        const widgets = field.acroField.getWidgets();
        for (let i = 0; i < widgets.length; i++) {
            const { x, y, width, height } = widgets[i].getRectangle();
            process.stdout.write(
                `  ${name}${widgets.length > 1 ? `[${i}]` : ''} multi=${multi} ` +
                `rect=(${x.toFixed(1)},${y.toFixed(1)},w=${width.toFixed(1)},h=${height.toFixed(1)})\n`
            );
        }
    }
}

async function main(): Promise<void> {
    for (const f of FILES) await dumpOne(f);
}

main().catch((err: unknown) => {
    process.stderr.write(`[error] ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
});
