const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { config } = require('../config');
const { getDb } = require('../db');

const queue = [];
let running = false;

function toFileUrl(absolutePath) {
  const normalized = path.resolve(absolutePath).replace(/\\/g, '/');
  // LibreOffice UserInstallation expects a file:// URL.
  if (normalized.startsWith('/')) return `file://${normalized}`;
  return `file:///${normalized}`;
}

function runLibreOffice(inputPath, outDir) {
  return new Promise((resolve, reject) => {
    const bin = config.libreOfficeBin;
    // macOS/headless LO often fails with "source file could not be loaded" when the
    // default user profile is locked (GUI open, stale lock, concurrent converts).
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-profile-'));
    const args = [
      '--headless',
      '--nologo',
      '--nolockcheck',
      '--nodefault',
      '--nofirststartwizard',
      `-env:UserInstallation=${toFileUrl(profileDir)}`,
      '--convert-to',
      'pdf',
      '--outdir',
      outDir,
      path.resolve(inputPath),
    ];
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOME: process.env.HOME || os.homedir(),
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      try {
        fs.rmSync(profileDir, { recursive: true, force: true });
      } catch (_e) {
        /* ignore */
      }
      reject(new Error(`LibreOffice failed to start (${bin}): ${err.message}`));
    });
    child.on('close', (code) => {
      try {
        fs.rmSync(profileDir, { recursive: true, force: true });
      } catch (_e) {
        /* ignore */
      }
      // Fontconfig warnings are common and harmless; only fail on non-zero exit.
      if (code !== 0) {
        const detail = (stderr || stdout || 'unknown error').trim();
        reject(new Error(`LibreOffice exited with code ${code}: ${detail}`));
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

  // Drop the temporary work copy of the Office file (and any LO sidecar junk).
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch (_e) {
    /* ignore */
  }

  return {
    id,
    filename: `${path.basename(originalName || 'presentation', ext)}.pdf`,
    filePath: finalPath,
    publicUrl: `/converted/${storedName}`,
    size: fs.statSync(finalPath).size,
  };
}

function removeSourceOfficeFile(sourceId, { promotePdfId = null } = {}) {
  if (!sourceId) return;
  const db = getDb();
  const source = db.prepare(`SELECT * FROM uploaded_files WHERE id = ?`).get(sourceId);
  if (source) {
    const ext = String(source.file_type || path.extname(source.filename || '') || '')
      .toLowerCase()
      .replace('.', '');
    if (ext === 'ppt' || ext === 'pptx') {
      if (source.file_path && fs.existsSync(source.file_path)) {
        try {
          fs.unlinkSync(source.file_path);
        } catch (err) {
          console.warn('Could not delete source Office file:', err.message);
        }
      }
      db.prepare(`DELETE FROM uploaded_files WHERE id = ?`).run(sourceId);
    }
  }
  if (promotePdfId) {
    // Keep the PDF as a first-class library file (list filters converted_from_id IS NULL).
    db.prepare(`UPDATE uploaded_files SET converted_from_id = NULL WHERE id = ?`).run(promotePdfId);
  }
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
    // After a successful convert, drop the original PPT/PPTX (disk + DB row).
    if (sourceId) {
      removeSourceOfficeFile(sourceId, { promotePdfId: converted.id });
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

module.exports = { convertPresentation, convertFileToPdf, removeSourceOfficeFile };
