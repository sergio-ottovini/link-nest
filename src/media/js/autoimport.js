

  const IMPORT_REGISTRY_KEY = 'my_knowledge_base_import_registry_v1';

function loadImportRegistry() {
  return read(IMPORT_REGISTRY_KEY, {});
}

function saveImportRegistry(registry) {
  write(IMPORT_REGISTRY_KEY, registry);
}

function markFileImported(filename, projectId) {
  const registry = loadImportRegistry();
  registry[filename] = {
    importedAt: now(),
    projectId
  };
  saveImportRegistry(registry);
}

function isFileImported(filename) {
  const registry = loadImportRegistry();
  return !!registry[filename];
}


async function importFile(file, filename) {
  const name = filename ?? file.name;

  // Skip if already imported
  if (isFileImported(name)) {
    console.log('[import] Skipping already imported file:', name);
    return { skipped: true, filename: name };
  }

  try {
    const payload = JSON.parse(await file.text());
    const p = cloneImported(validatePayload(payload));
    p.name = p.name + ' (Imported)';
    write(PROJECT_KEY(p.id), p);
    state.root.projects.push(summary(p));
    state.root.activeProjectId = p.id;
    saveRoot();
    openProject(p.id);
    showToast('Project imported: ' + name);

    markFileImported(name, p.id);

    return { skipped: false, filename: name, projectId: p.id };
  } catch (e) {
    showToast('Import failed: ' + name + ' — ' + e.message);
    console.error('[import] Error importing', name, e);
    return { skipped: false, filename: name, error: e.message };
  }
}

async function autoImportFromCollection(fileEntries) {
  // fileEntries: array of { name: string, url: string }
  const results = [];

  for (const entry of fileEntries) {
    if (isFileImported(entry.name)) {
      console.log('[autoImport] Skipping already imported:', entry.name);
      results.push({ skipped: true, filename: entry.name });
      continue;
    }

    try {
      const res = await fetch(entry.url);
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      const blob = await res.blob();
      const file = new File([blob], entry.name, { type: 'application/json' });

      const result = await importFile(file, entry.name);
      results.push(result);
    } catch (e) {
      console.error('[autoImport] Failed to fetch', entry.name, e);
      results.push({ skipped: false, filename: entry.name, error: e.message });
    }
  }

  const importedCount = results.filter(r => !r.skipped && !r.error).length;
  const skippedCount = results.filter(r => r.skipped).length;
  const errorCount = results.filter(r => r.error).length;

  console.log('[autoImport] Done:', {
    total: fileEntries.length,
    imported: importedCount,
    skipped: skippedCount,
    errors: errorCount
  });

  return results;
}

async function runAutoImport() {
  try {
    const res = await fetch('/collection/manifest.json');
    if (!res.ok) {
      console.warn('[autoImport] No manifest found at /collection/manifest.json');
      return;
    }
    const fileEntries = await res.json();
    await autoImportFromCollection(fileEntries);
  } catch (e) {
    console.error('[autoImport] Failed to load manifest', e);
  }
}

// Call once on startup, after migrate() and initial render
runAutoImport();
