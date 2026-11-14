const PDF_WIDTH = 792;
const PDF_HEIGHT = 612;
const PAGE_MARGIN = 38;
const FONT_SIZE = 8;
const ROW_PADDING = 7;

function pdfText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*[·•]\s*/g, ' - ')
    .replace(/[–—−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(value, maxCharacters) {
  const words = String(value ?? '').split(/\s+/);
  const lines = [];
  let line = '';

  words.forEach((word) => {
    if (word.length > maxCharacters) {
      if (line) lines.push(line);
      line = '';
      for (let index = 0; index < word.length; index += maxCharacters) {
        lines.push(word.slice(index, index + maxCharacters));
      }
    } else if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= maxCharacters) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  });

  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function findJpegDimensions(bytes) {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    if (segmentLength < 2) break;
    offset += segmentLength + 2;
  }
  throw new Error('The church logo image could not be read for the PDF report.');
}

function encode(value) {
  return new TextEncoder().encode(value);
}

function concatenateBytes(chunks) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}

function buildColumnWidths(headers, rows, tableWidth) {
  const weights = headers.map((header, columnIndex) => {
    const sampleLength = Math.max(
      String(header ?? '').length,
      ...rows.slice(0, 30).map((row) => String(row[columnIndex] ?? '').length)
    );
    return Math.max(8, Math.min(34, sampleLength));
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => (tableWidth * weight) / totalWeight);
}

function buildPageContent({
  pageRows,
  pageIndex,
  pageCount,
  title,
  generatedAt,
  preparedBy,
  summary,
  headers,
  columnWidths,
  tableWidth,
}) {
  const commands = [];
  const logoSize = 48;
  const logoX = PAGE_MARGIN;
  const logoY = PDF_HEIGHT - PAGE_MARGIN - logoSize;
  commands.push(`q ${logoSize} 0 0 ${logoSize} ${logoX} ${logoY} cm /Logo Do Q`);

  const text = (value, x, y, size, font = 'F1', color = '0.12 0.17 0.24') => {
    commands.push(`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`);
  };

  const textX = logoX + logoSize + 12;
  text('THE LIFE BUILDER CHURCH', textX, PDF_HEIGHT - 42, 15, 'F2');
  text(title, textX, PDF_HEIGHT - 62, 10, 'F1', '0.30 0.36 0.43');
  text(`Prepared by: ${preparedBy || 'Administrator'}`, textX, PDF_HEIGHT - 78, 8, 'F1', '0.33 0.38 0.44');
  text(`Generated: ${generatedAt}`, textX, PDF_HEIGHT - 94, 8, 'F1', '0.33 0.38 0.44');

  if (pageIndex === 0 && summary.length) {
    let summaryX = logoX;
    const summaryY = PDF_HEIGHT - 126;
    summary.forEach((item) => {
      const label = String(item.label ?? '');
      const value = String(item.value ?? '');
      const boxWidth = Math.max(90, Math.min(185, (label.length + value.length + 8) * 4.2));
      commands.push(`0.94 0.96 0.98 rg ${summaryX} ${summaryY - 7} ${boxWidth} 30 re f`);
      text(label.toUpperCase(), summaryX + 8, summaryY + 10, 6, 'F2', '0.38 0.43 0.49');
      text(value, summaryX + 8, summaryY - 1, 9, 'F2', '0.12 0.17 0.24');
      summaryX += boxWidth + 8;
    });
  }

  const tableTop = pageIndex === 0 && summary.length
    ? PDF_HEIGHT - 153
    : PDF_HEIGHT - 112;
  const headerHeight = 24;
  let y = tableTop;
  commands.push(`0.10 0.24 0.31 rg ${PAGE_MARGIN} ${y - headerHeight} ${tableWidth} ${headerHeight} re f`);
  let x = PAGE_MARGIN;
  headers.forEach((header, index) => {
    const cellLines = wrapText(header, Math.max(8, Math.floor((columnWidths[index] - 12) / 4.3)));
    text(cellLines[0], x + 6, y - 15, FONT_SIZE, 'F2', '1 1 1');
    x += columnWidths[index];
  });
  y -= headerHeight;

  pageRows.forEach((row, rowIndex) => {
    const cellLines = headers.map((_, columnIndex) =>
      wrapText(row[columnIndex], Math.max(7, Math.floor((columnWidths[columnIndex] - 12) / (FONT_SIZE * 0.52))))
    );
    const lineCount = Math.max(1, ...cellLines.map((lines) => lines.length));
    const rowHeight = lineCount * 10 + ROW_PADDING;
    const bottom = y - rowHeight;
    if (rowIndex % 2 === 0) {
      commands.push(`0.96 0.97 0.98 rg ${PAGE_MARGIN} ${bottom} ${tableWidth} ${rowHeight} re f`);
    }
    commands.push(`0.82 0.85 0.88 RG 0.45 w ${PAGE_MARGIN} ${bottom} m ${PAGE_MARGIN + tableWidth} ${bottom} l S`);
    let cellX = PAGE_MARGIN;
    cellLines.forEach((lines, columnIndex) => {
      lines.forEach((line, lineIndex) => {
        text(line, cellX + 6, y - ROW_PADDING - 8 - (lineIndex * 10), FONT_SIZE);
      });
      cellX += columnWidths[columnIndex];
    });
    y = bottom;
  });

  commands.push(`0.78 0.81 0.84 RG 0.5 w ${PAGE_MARGIN} ${PAGE_MARGIN} m ${PDF_WIDTH - PAGE_MARGIN} ${PAGE_MARGIN} l S`);
  text('Official attendance report · The Life Builder Church', PAGE_MARGIN, PAGE_MARGIN - 14, 7, 'F1', '0.40 0.45 0.51');
  const pageLabel = `Page ${pageIndex + 1} of ${pageCount}`;
  const pageLabelX = PDF_WIDTH - PAGE_MARGIN - (pageLabel.length * 4);
  text(pageLabel, pageLabelX, PAGE_MARGIN - 14, 7, 'F1', '0.40 0.45 0.51');

  return commands.join('\n');
}

export async function createReportPdf(title, rows, metadata = {}) {
  const logoResponse = await fetch('/images/logo/Logo.jpg');
  if (!logoResponse.ok) {
    throw new Error(`Unable to load the local church logo for the PDF (${logoResponse.status}).`);
  }
  const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
  const { width: logoWidth, height: logoHeight } = findJpegDimensions(logoBytes);
  const tableRows = rows.length > 1 ? rows.slice(1) : [];
  const headers = rows[0] || [];
  const tableWidth = PDF_WIDTH - (PAGE_MARGIN * 2);
  const columnWidths = buildColumnWidths(headers, tableRows, tableWidth);
  const generatedAt = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const summary = metadata.summary || [
    { label: 'Records', value: tableRows.length },
  ];
  const preparedBy = metadata.preparedBy || 'Administrator';
  const firstPageTop = PDF_HEIGHT - (summary.length ? 153 : 112);
  const firstPageAvailable = firstPageTop - PAGE_MARGIN - 24;
  const otherPageAvailable = PDF_HEIGHT - 112 - PAGE_MARGIN - 24;
  const estimatedRowHeights = tableRows.map((row) => {
    const lineCount = Math.max(
      1,
      ...headers.map((_, columnIndex) =>
        wrapText(row[columnIndex], Math.max(7, Math.floor((columnWidths[columnIndex] - 12) / (FONT_SIZE * 0.52)))).length
      )
    );
    return lineCount * 10 + ROW_PADDING;
  });

  const pageRowGroups = [[]];
  let remainingHeight = firstPageAvailable;
  tableRows.forEach((row, index) => {
    const rowHeight = estimatedRowHeights[index];
    if (pageRowGroups[pageRowGroups.length - 1].length && rowHeight > remainingHeight) {
      pageRowGroups.push([]);
      remainingHeight = otherPageAvailable;
    }
    pageRowGroups[pageRowGroups.length - 1].push(row);
    remainingHeight -= rowHeight;
  });
  const pageCount = pageRowGroups.length;

  const pageIds = pageRowGroups.map((_, index) => 6 + (index * 2));
  const objects = new Array(6 + (pageCount * 2));
  objects[1] = encode('<< /Type /Catalog /Pages 2 0 R >>');
  objects[2] = encode(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`);
  objects[3] = encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects[4] = encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  objects[5] = concatenateBytes([
    encode(`<< /Type /XObject /Subtype /Image /Width ${logoWidth} /Height ${logoHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n`),
    logoBytes,
    encode('\nendstream'),
  ]);
  objects[6] = encode('<< /Type /Dummy >>');

  pageRowGroups.forEach((pageRows, pageIndex) => {
    const pageId = pageIds[pageIndex];
    const contentId = pageId + 1;
    const content = buildPageContent({
      pageRows,
      pageIndex,
      pageCount,
      title,
      generatedAt,
      preparedBy,
      summary,
      headers,
      columnWidths,
      tableWidth,
    });
    objects[pageId] = encode(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    const contentBytes = encode(content);
    objects[contentId] = concatenateBytes([
      encode(`<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      encode('\nendstream'),
    ]);
  });

  let offset = 0;
  const chunks = [];
  const offsets = [0];
  const add = (chunk) => {
    chunks.push(chunk);
    offset += chunk.length;
  };

  add(encode('%PDF-1.4\n'));
  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) throw new Error(`PDF generation failed: object ${id} is missing.`);
    offsets[id] = offset;
    add(encode(`${id} 0 obj\n`));
    add(objects[id]);
    add(encode('\nendobj\n'));
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  add(encode(xref));

  return new Blob(chunks, { type: 'application/pdf' });
}
