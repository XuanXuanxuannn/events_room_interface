const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { config } = require('../config');
const { getDb } = require('../db');

const queue = [];
let running = false;

function runLibreOffice(inputPath, outDir) {
  return new Promise((resolve, reject) => {
    const bin = config.libreOfficeBin;
    const args = [
      '--headless',
      '--nologo',
      '--nolockcheck',
      '--nodefault',
      '--nofirststartwizard',
      '--convert-to',
      'pdf',
      '--outdir',
      outDir,
      inputPath,
    ];
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      reject(new Error(`LibreOffice failed to start (${bin}): ${err.message}`));
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`LibreOffice exited with code ${code}: ${stderr || 'unknown error'}`));
        return;
      }
      resolve();
    });
  });
}

async function convertFileToPdf(sourcePath, originalName) {
  const id = `${Date.now().toString(36)}-${uuidv4().slice(0, 8)}`;
  const workDir = path.join(config.convertedDir, id);
  fs.mkdirSync(workDir, { recursive: true });

  const ext = path.extname(originalName || sourcePath).toLowerCase();
  const inputCopy = path.join(workDir, `source${ext || '.pptx'}`);
  fs.copyFileSync(sourcePath, inputCopy);

  await runLibreOffice(inputCopy, workDir);

  const base = path.basename(inputCopy, path.extname(inputCopy));
  const pdfPath = path.join(workDir, `${base}.pdf`);
  if (!fs.existsSync(pdfPath)) {
    const pdfs = fs.readdirSync(workDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) throw new Error('Conversion produced no PDF output.');
    fs.renameSync(path.join(workDir, pdfs[0]), pdfPath);
  }

  const storedName = `${id}.pdf`;
  const finalPath = path.join(config.convertedDir, storedName);
  fs.copyFileSync(pdfPath, finalPath);

  return {
    id,
    filename: `${path.basename(originalName || 'presentation', ext)}.pdf`,
    filePath: finalPath,
    publicUrl: `/converted/${storedName}`,
    size: fs.statSync(finalPath).size,
  };
}

function enqueue(job) {
  return new Promise((resolve, reject) => {
    queue.push({ job, resolve, reject });
    pump();
  });
}

async function pump() {
  if (running) return;
  const next = queue.shift();
  if (!next) return;
  running = true;
  try {
    const result = await next.job();
    next.resolve(result);
  } catch (err) {
    next.reject(err);
  } finally {
    running = false;
    if (queue.length) pump();
  }
}

async function convertPresentation({ sourcePath, originalName, sourceId, uploadedBy }) {
  const db = getDb();
  if (sourceId) {
    db.prepare(`UPDATE uploaded_files SET status = 'converting' WHERE id = ?`).run(sourceId);
  }

  try {
    const converted = await enqueue(() => convertFileToPdf(sourcePath, originalName));
    db.prepare(
      `INSERT INTO uploaded_files
         (id, filename, file_type, file_path, public_url, size, status, converted_from_id, uploaded_by, uploaded_at)
       VALUES (?, ?, 'pdf', ?, ?, ?, 'ready', ?, ?, datetime('now'))`
    ).run(
      converted.id,
      converted.filename,
      converted.filePath,
      converted.publicUrl,
      converted.size,
      sourceId || null,
      uploadedBy || null
    );
    if (sourceId) {
      db.prepare(`UPDATE uploaded_files SET status = 'converted' WHERE id = ?`).run(sourceId);
    }
    return {
      id: converted.id,
      source_name: originalName,
      converted_type: 'pdf',
      url: converted.publicUrl,
      name: converted.filename,
      type: 'pdf',
      size: converted.size,
      status: 'ready',
    };
  } catch (err) {
    if (sourceId) {
      db.prepare(`UPDATE uploaded_files SET status = 'failed' WHERE id = ?`).run(sourceId);
    }
    throw err;
  }
}

module.exports = { convertPresentation, convertFileToPdf };
