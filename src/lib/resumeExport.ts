import { marked } from 'marked'
import type { Paragraph as DocxParagraph } from 'docx'

/**
 * ATS-safe single-column print template. Opens the browser's print dialog —
 * "Save as PDF" gives a clean, submittable file with zero heavy dependencies.
 */
export function printResumePdf(markdown: string, title: string): void {
  const body = marked.parse(markdown, { async: false })
  const win = window.open('', '_blank', 'width=800,height=1000')
  if (!win) throw new Error('Popup blocked — allow popups for this site to export PDF.')
  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #111; margin: 0; font-size: 10.5pt; line-height: 1.45;
  }
  h1 { font-size: 20pt; margin: 0 0 2pt; letter-spacing: 0.5px; }
  h2 {
    font-size: 11pt; text-transform: uppercase; letter-spacing: 1.2px;
    border-bottom: 1px solid #444; padding-bottom: 2pt; margin: 14pt 0 6pt;
  }
  h3 { font-size: 10.5pt; margin: 8pt 0 2pt; }
  p { margin: 0 0 4pt; }
  ul { margin: 2pt 0 6pt; padding-left: 16pt; }
  li { margin-bottom: 2pt; }
  a { color: #111; text-decoration: none; }
  strong { font-weight: 700; }
</style>
</head>
<body>${body}</body>
</html>`)
  win.document.close()
  win.focus()
  // Let the document render before opening the dialog.
  setTimeout(() => win.print(), 300)
}

export async function downloadResumeDocx(markdown: string, filename: string): Promise<void> {
  // docx is ~350KB — load it only when someone actually exports.
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx')

  /** Minimal markdown → docx mapping: headings, bullets, bold runs, paragraphs. */
  const mdLineToRuns = (line: string) =>
    line
      .split(/(\*\*[^*]+\*\*)/)
      .filter(Boolean)
      .map((part) =>
        part.startsWith('**') && part.endsWith('**')
          ? new TextRun({ text: part.slice(2, -2), bold: true })
          : new TextRun({ text: part.replace(/\*/g, '') }),
      )

  const paragraphs: DocxParagraph[] = []
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('# ')) {
      paragraphs.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }))
    } else if (line.startsWith('## ')) {
      paragraphs.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }))
    } else if (line.startsWith('### ')) {
      paragraphs.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }))
    } else if (/^[-*•]\s/.test(line)) {
      paragraphs.push(new Paragraph({ children: mdLineToRuns(line.replace(/^[-*•]\s+/, '')), bullet: { level: 0 } }))
    } else if (/^---+$/.test(line)) {
      continue
    } else {
      paragraphs.push(new Paragraph({ children: mdLineToRuns(line) }))
    }
  }
  const doc = new Document({ sections: [{ children: paragraphs }] })
  const blob = await Packer.toBlob(doc)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
