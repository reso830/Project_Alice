const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TXT_MIME = 'text/plain';
const GENERIC_MIME = 'application/octet-stream';

export class UnsupportedFileTypeError extends Error {
  constructor() {
    super('Unsupported file type');
    this.name = 'UnsupportedFileTypeError';
  }
}

function getExtension(originalname = '') {
  const dotIndex = originalname.lastIndexOf('.');
  return dotIndex === -1 ? '' : originalname.slice(dotIndex).toLowerCase();
}

function resolveMimetype(mimetype, originalname) {
  if (mimetype && mimetype !== GENERIC_MIME) {
    return mimetype;
  }

  switch (getExtension(originalname)) {
    case '.pdf':
      return PDF_MIME;
    case '.docx':
      return DOCX_MIME;
    case '.txt':
      return TXT_MIME;
    default:
      return mimetype;
  }
}

async function extractPdfText(buffer) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer) {
  const { default: mammoth } = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractText(buffer, mimetype, originalname = '') {
  const resolvedMimetype = resolveMimetype(mimetype, originalname);

  if (resolvedMimetype === PDF_MIME) {
    return extractPdfText(buffer);
  }

  if (resolvedMimetype === DOCX_MIME) {
    return extractDocxText(buffer);
  }

  if (resolvedMimetype === TXT_MIME) {
    return buffer.toString('utf8');
  }

  throw new UnsupportedFileTypeError();
}
