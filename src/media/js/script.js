  'use strict';
  const ROOT_KEY = 'my_knowledge_base_root_v2';
  const PROJECT_KEY = id => `my_knowledge_base_project_${id}`;
  const OLD_KEY = 'my_knowledge_base_v1';
  const BACKUP_KEY = 'my_knowledge_base_migration_v1_backup';

  const THEMES = {
    default: { label: "Default", accent: "#4f46e5" },
    blue: { label: "Blue", accent: "#2563eb" },
    green: { label: "Green", accent: "#16803c" },
    orange: { label: "Orange", accent: "#c2410c" },
    yellow: { label: "Yellow", accent: "#bcb000" },
    rose: { label: "Rose", accent: "#be123c" }
  };

  let state = { root: null, activeProject: null, view: "project" };
  const $ = s => document.querySelector(s);
  function now() { return new Date().toISOString() }
  function id(prefix) { return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2)}` }
  function read(key, fallback = null) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch (e) { console.error(e); return fallback } }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)) }
  function emptyRoot() { return { schemaVersion: 2, activeProjectId: null, projects: [] } }
  function loadRoot() { return read(ROOT_KEY, emptyRoot()) }
  function saveRoot() { write(ROOT_KEY, state.root) }
  function loadProject(projectId) { return read(PROJECT_KEY(projectId), null) }
  function saveProject(project) { project.updatedAt = now(); write(PROJECT_KEY(project.id), project); updateSummary(project) }
  function removeProject(id) { localStorage.removeItem(PROJECT_KEY(id)) }
  function emptyProject(name = 'My Knowledge Base', description = '', themeId = 'default') { const t = now(); return { id: id('project'), name: name.trim(), description: description.trim(), themeId, createdAt: t, updatedAt: t, groups: [] } }
  function summary(project) { return { id: project.id, name: project.name, description: project.description, themeId: project.themeId, createdAt: project.createdAt, updatedAt: project.updatedAt, groupCount: countGroups(project.groups), linkCount: countLinks(project.groups) } }
  function updateSummary(project) { const i = state.root.projects.findIndex(p => p.id === project.id); if (i < 0) state.root.projects.push(summary(project)); else state.root.projects[i] = summary(project); saveRoot() }
  function countGroups(groups = []) { return groups.reduce((n, g) => n + 1 + countGroups(g.groups || []), 0) }
  function countLinks(groups = []) { return groups.reduce((n, g) => n + (g.links || []).length + countLinks(g.groups || []), 0) }
  function findGroup(groups, gid) { for (const g of groups) { if (g.id === gid) return g; const x = findGroup(g.groups || [], gid); if (x) return x } return null }
  function findLink(groups, lid) { for (const g of groups) { const x = (g.links || []).find(l => l.id === lid); if (x) return { link: x, group: g }; const y = findLink(g.groups || [], lid); if (y) return y } return null }
  function normalizeGroup(g) { return { id: g.id || id('group'), title: String(g.title || 'Untitled group'), expanded: g.expanded !== false, groups: (g.groups || g.subgroups || []).map(normalizeGroup), links: Array.isArray(g.links) ? g.links.map(normalizeLink) : [] } }
  function migrate() { if (localStorage.getItem(ROOT_KEY)) return; const old = read(OLD_KEY, null); if (!old) { state.root = emptyRoot(); saveRoot(); return } const p = emptyProject('My Knowledge Base', 'Migrated from the previous version', 'default'); p.groups = (old.groups || []).map(normalizeGroup); write(PROJECT_KEY(p.id), p); state.root = { schemaVersion: 2, activeProjectId: p.id, projects: [summary(p)] }; saveRoot(); localStorage.setItem(BACKUP_KEY, JSON.stringify(old)) }
  function applyTheme() { const p = state.activeProject; document.documentElement.style.setProperty('--accent', THEMES[p?.themeId]?.accent || THEMES.default.accent) }

  function openProject(projectId) {
    const project = loadProject(projectId);

    if (!project) {
      showToast("Project not found.");
      return;
    }

    state.activeProject = project;
    state.view = "project";

    state.root.activeProjectId = projectId;
    saveRoot();

    applyTheme();
    render();
  }

  $("#aboutBtn").addEventListener("click", showAbout);

  function createProject(data) {
    const name = String(data.name || "").trim();

    if (!name) {
      throw new Error("Project name is required");
    }

    state.root = loadRoot();

    if (!state.root || !Array.isArray(state.root.projects)) {
      state.root = emptyRoot();
    }

    const project = emptyProject(
      name,
      String(data.description || ""),
      data.themeId || "default"
    );

    // Store this project independently.
    write(PROJECT_KEY(project.id), project);

    // Append instead of replacing existing projects.
    state.root.projects.push(summary(project));
    state.root.activeProjectId = project.id;

    // Persist the complete project index.
    saveRoot();

    // Update only the active project in memory.
    state.activeProject = project;

    applyTheme();
    closeModal();
    render();
  }

  // function updateProject(data){const p=state.activeProject;if(!p)return;p.name=data.name.trim();p.description=data.description.trim();p.themeId=data.themeId;saveProject(p);applyTheme();render()}

  function updateProject(data) {
    const project = state.activeProject;

    if (!project) return;

    project.name = data.name.trim();
    project.description = data.description.trim();
    project.themeId = data.themeId || "default";

    saveProject(project);

    state.activeProject = project;

    applyTheme();
    render();
  }

  function deleteCurrentProject() { const p = state.activeProject; if (!p) return; if (!confirm(`Delete project “${p.name}” and all its data?`)) return; removeProject(p.id); state.root.projects = state.root.projects.filter(x => x.id !== p.id); state.root.activeProjectId = state.root.projects[0]?.id || null; saveRoot(); state.activeProject = state.root.activeProjectId ? loadProject(state.root.activeProjectId) : null; applyTheme(); render() }
  function addGroup(parentId = null) { const title = prompt('Group name:'); if (!title?.trim()) return; const p = state.activeProject; const g = { id: id('group'), title: title.trim(), expanded: true, groups: [], links: [] }; if (parentId) findGroup(p.groups, parentId).groups.push(g); else p.groups.push(g); saveProject(p); state.activeProject = p; render() }
  function renameGroup(gid) { const p = state.activeProject, g = findGroup(p.groups, gid), title = prompt('Group name:', g.title); if (!title?.trim()) return; g.title = title.trim(); saveProject(p); render() }
  function deleteGroup(gid) { const p = state.activeProject; if (!confirm('Delete this group, nested groups, and links?')) return; function remove(arr) { const i = arr.findIndex(g => g.id === gid); if (i >= 0) { arr.splice(i, 1); return true } return arr.some(g => remove(g.groups || [])) } remove(p.groups); saveProject(p); render() }
  function toggleGroup(gid) { const g = findGroup(state.activeProject.groups, gid); g.expanded = !g.expanded; saveProject(state.activeProject); render() }
  function addLink(gid) { const g = findGroup(state.activeProject.groups, gid); showLinkModal(null, g) }
  function editLink(lid) { const x = findLink(state.activeProject.groups, lid); showLinkModal(x.link, x.group) }
  function deleteLink(lid) { const p = state.activeProject, x = findLink(p.groups, lid); if (!x || !confirm('Delete this link?')) return; x.group.links = x.group.links.filter(l => l.id !== lid); saveProject(p); render() }
  function safeName(s) { return s.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'project' }
  function exportProject() { const p = state.activeProject; const payload = { format: 'my-knowledge-base-project', formatVersion: 1, exportedAt: now(), project: structuredClone(p) }; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); a.download = safeName(p.name) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
  function cloneImported(p) { const copy = structuredClone(p), t = now(); function groups(gs) { return gs.map(g => ({ ...g, id: id('group'), groups: groups(g.groups || []), links: (g.links || []).map(l => ({ ...normalizeLink(l), id: id('link') })) })) } return { ...copy, id: id('project'), createdAt: t, updatedAt: t, groups: groups(copy.groups || []) } }
  function validatePayload(x) { if (!x || x.format !== 'my-knowledge-base-project' || x.formatVersion !== 1 || !x.project || typeof x.project.name !== 'string' || !Array.isArray(x.project.groups)) throw Error('Invalid or unsupported project JSON'); return x.project }
  async function importFile(file) { try { const p = cloneImported(validatePayload(JSON.parse(await file.text()))); p.name = p.name + ' (Imported)'; write(PROJECT_KEY(p.id), p); state.root.projects.push(summary(p)); state.root.activeProjectId = p.id; saveRoot(); openProject(p.id); showToast('Collection imported') } catch (e) { showToast(e.message) } }

  function renderSidebar() {
    const list = $("#projectList");
    list.innerHTML = "";

    $("#aboutBtn").classList.toggle(
      "active",
      state.view === "about"
    );

    if (!state.root.projects.length) {
      list.innerHTML = `
      <div class="hint">
        No projects yet.
      </div>
    `;

      return;
    }

    for (const project of state.root.projects) {
      const theme =
        THEMES[project.themeId] || THEMES.default;

      const item = document.createElement("div");

      item.className =
        "project-item " +
        (
          state.view === "project" &&
            project.id === state.activeProject?.id
            ? "active"
            : ""
        );

      item.style.setProperty(
        "--project-color",
        theme.accent
      );

      item.innerHTML = `
      <div class="project-item-main">
        <div class="project-item-name">
          ${esc(project.name)}
        </div>

        <div class="project-item-meta">
          ${project.groupCount} groups ·
          ${project.linkCount} links
        </div>
      </div>
    `;

      item.onclick = () => openProject(project.id);

      list.appendChild(item);
    }
  }

  function render() {
    renderSidebar();

    const main = $("#main");

    if (state.view === "about") {
      renderAbout(main);
      return;
    }

    const project = state.activeProject;

    if (!project) {
      main.innerHTML = `
      <div class="empty">
        <h1>Your projects</h1>

        <p class="description">
          Create a project to organize links into
          independent, portable knowledge bases.
        </p>

        <button
          class="primary"
          onclick="openProjectModal(null)"
        >
          Create your first project
        </button>
      </div>
    `;

      return;
    }

    main.innerHTML = `
    <div class="workspace">
      <div class="header">
        <div>
          <h1>${esc(project.name)}</h1>

          <div class="description">
            ${esc(project.description || "No description")}
          </div>
        </div>

        <div class="collection-btns">
          <div class="">
          <button
            type="button"
            onclick="openProjectModal(state.activeProject)"
            data-tooltip="Edit collection"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="1.13em" height="1em" viewBox="0 0 576 512">
	<path d="M0 0h576v512H0z" fill="none" />
	<path fill="currentColor" d="m402.3 344.9l32-32c5-5 13.7-1.5 13.7 5.7V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V112c0-26.5 21.5-48 48-48h273.5c7.1 0 10.7 8.6 5.7 13.7l-32 32c-1.5 1.5-3.5 2.3-5.7 2.3H48v352h352V350.5c0-2.1.8-4.1 2.3-5.6m156.6-201.8L296.3 405.7l-90.4 10c-26.2 2.9-48.5-19.2-45.6-45.6l10-90.4L432.9 17.1c22.9-22.9 59.9-22.9 82.7 0l43.2 43.2c22.9 22.9 22.9 60 .1 82.8M460.1 174L402 115.9L216.2 301.8l-7.3 65.3l65.3-7.3zm64.8-79.7l-43.2-43.2c-4.1-4.1-10.8-4.1-14.8 0L436 82l58.1 58.1l30.9-30.9c4-4.2 4-10.8-.1-14.9" />
</svg>

          </button>

          <button
            type="button"
            onclick="exportProject()"
            data-tooltip="Export collection"
          > 
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 20 20">
  <path d="M0 0h20v20H0z" fill="none" />
  <path fill="currentColor" d="M15 15H2V6h2.595s.689-.896 2.17-2H1a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-3.746l-2 1.645zm-1.639-6.95v3.551L20 6.4l-6.639-4.999v3.131C5.3 4.532 5.3 12.5 5.3 12.5c2.282-3.748 3.686-4.45 8.061-4.45" />
</svg>
          </button>

          <button
            type="button"
            class="danger"
            onclick="deleteCurrentProject()"
            data-tooltip="Delete collection"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 32 32">
  <path d="M0 0h32v32H0z" fill="none" />
  <path fill="currentColor" d="M13.5 6.5V7h5v-.5a2.5 2.5 0 0 0-5 0m-2 .5v-.5a4.5 4.5 0 1 1 9 0V7H28a1 1 0 1 1 0 2h-1.508L24.6 25.568A5 5 0 0 1 19.63 30h-7.26a5 5 0 0 1-4.97-4.432L5.508 9H4a1 1 0 0 1 0-2zM9.388 25.34a3 3 0 0 0 2.98 2.66h7.263a3 3 0 0 0 2.98-2.66L24.48 9H7.521zM13 12.5a1 1 0 0 1 1 1v10a1 1 0 1 1-2 0v-10a1 1 0 0 1 1-1m7 1a1 1 0 1 0-2 0v10a1 1 0 1 0 2 0z" />
</svg>
          </button>
           </div>
        </div>
      </div>

            <div class="actions-groups">
  <button type="button" class="primary" onclick="addGroup()">
    ＋ Add group
  </button>

  <!-- This will now act as a vertical divider -->
  <hr>

  <div class="stats">
    <div class="stat">
      <strong>${countGroups(project.groups || [])}</strong> groups
    </div>
    <div class="stat">
      <strong>${countLinks(project.groups || [])}</strong> links
    </div>
  </div>
</div>





        <div id="tree">
          ${renderGroups(project.groups || [])}
        </div>
      </div>
    </div>
  `;
  }

  function renderGroups(groups) { return groups.map(g => `<section class="group"><div class="group-head"><button class="small group-title-btn" onclick="toggleGroup('${g.id}')">${g.expanded ? '▾' : '▸'}</button><div class="group-title">${esc(g.title)}</div><button class="small" onclick="addGroup('${g.id}')">＋ subgroup</button><button class="small" onclick="addLink('${g.id}')">＋ link</button><button class="small" onclick="renameGroup('${g.id}')">Rename</button><button class="small danger" onclick="deleteGroup('${g.id}')">Delete</button></div>${g.expanded ? `<div class="group-children">${renderGroups(g.groups || [])}</div><div class="links">${(g.links || []).map(renderLink).join('')}</div>` : ''}</section>`).join('') || '' }

  function renderGroups(groups) {
    if (!groups.length) {
      return `

    `;
    }

    return groups.map(group => {
      const menuId = `group-menu-${group.id}`;

      const menu = actionMenu({
        id: menuId,
        label: `Actions for group ${group.title}`,
        items: [
          {
            label: "＋ Subgroup",
            onclick: `addGroup('${group.id}'); closeAllTreeMenus();`
          },
          {
            label: "＋ Link",
            onclick: `addLink('${group.id}'); closeAllTreeMenus();`
          },
          {
            label: "Rename",
            onclick: `renameGroup('${group.id}'); closeAllTreeMenus();`
          },
          {
            label: "Delete",
            danger: true,
            onclick: `deleteGroup('${group.id}'); closeAllTreeMenus();`
          }
        ]
      });

      return `
      <section class="group">
        <div
          class="group-head"
          onclick="closeAllTreeMenus()"
        >
          <button
            type="button"
            class="small group-title-btn"
            onclick="event.stopPropagation(); toggleGroup('${group.id}')"
          >
            ${group.expanded ? "▾" : "▸"}
          </button>

          <div class="group-title">
            ${esc(group.title)}
          </div>

          ${menu}
        </div>

        ${group.expanded
          ? `
              <div class="group-children">
                ${renderGroups(group.groups || [])}
              </div>

              <div class="links">
                ${(group.links || [])
            .map(renderLink)
            .join("")}
              </div>
            `
          : ""
        }
      </section>
    `;
    }).join("");
  }

  function renderLink(link) {
    const menuId = `link-menu-${link.id}`;

    const menu = actionMenu({
      id: menuId,
      label: `Actions for link ${link.title || link.url}`,
      items: [
        {
          label: "Edit",
          onclick: `editLink('${link.id}'); closeAllTreeMenus();`
        },
        {
          label: "Delete",
          danger: true,
          onclick: `deleteLink('${link.id}'); closeAllTreeMenus();`
        }
      ]
    });

    const icon = link.siteIco
      ? `
      <img
        class="site-icon"
        src="${escAttr(link.siteIco)}"
        alt=""
        width="20"
        height="20"
        loading="lazy"
        onerror="this.hidden=true"
      >
    `
      : "";

    return `
    <div class="link-row">
      <div class="link-info">
        <div class="link-title">
          ${icon}

          <a
            href="${escAttr(link.url)}"
            target="_blank"
            rel="noopener"
          >
            ${esc(link.title || link.url)}
          </a>
        </div>



<div class="link-meta">
  ${link.reason
    ? `<p class="link-reason">${esc(link.reason)}</p>`
    : ""}

  ${link.state
    ? `<p class="link-state">${esc(link.state)}</p>`
    : ""}

  ${(link.tags || []).length
    ? `
      <div class="tags">
        ${(link.tags || [])
          .map(tag => `
            <button
              type="button"
              class="tag-button"
              data-tag="${esc(tag)}"
              onclick="searchByTag('${escapeJs(tag)}')"
            >
              ${esc(tag)}
            </button>
          `)
          .join("")}
      </div>
    `
    : ""}
</div>
      </div>
      ${menu}
    </div>
  `;
  }

  function openProjectModal(project = state.activeProject) {
    const p = project;

    $('#modal').innerHTML = `
    <h2>${p ? 'Edit project' : 'New project'}</h2>

    <form id="projectForm">
      <div class="field">
        <label>Name</label>
        <input
          name="name"
          required
          maxlength="160"
          value="${escAttr(p?.name || '')}"
        >
      </div>

      <div class="field">
        <label>Description</label>
        <textarea name="description">${esc(p?.description || '')}</textarea>
      </div>

      <div class="field">
        <label>Theme</label>
        <select name="themeId">
          ${Object.entries(THEMES).map(([key, theme]) => `
            <option
              value="${key}"
              ${(p?.themeId || 'default') === key ? 'selected' : ''}
            >
              ${esc(theme.label)}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="modal-actions">
        <button type="button" onclick="closeModal()">Cancel</button>
        <button class="primary" type="submit">
          ${p ? 'Save changes' : 'Create project'}
        </button>
      </div>
    </form>
  `;

    $('#projectForm').onsubmit = event => {
      event.preventDefault();

      const data = Object.fromEntries(new FormData(event.target));

      try {
        if (p) {
          updateProject(data);
        } else {
          createProject(data);
        }

        closeModal();
      } catch (error) {
        showToast(error.message);
      }
    };

    openModal();
  }

  function showLinkModal(link, group) {
    const current = link || {};

    $("#modal").innerHTML = `
    <h2>${link ? "Edit link" : "New link"}</h2>

    <form id="linkForm">
      <div class="field">
        <label>Title</label>
        <input
          name="title"
          required
          value="${escAttr(current.title || "")}"
        >
      </div>

<div class="field">
  <label>URL</label>

  <div class="url-input-row">
    <input
      id="linkUrlInput"
      name="url"
      type="url"
      required
      value="${escAttr(current.url || "")}"
      placeholder="https://example.com"
    >

    <button
      id="pasteUrlBtn"
      type="button"
      class="small"
    >
      Paste
    </button>
  </div>

  <div class="hint" id="clipboardStatus"></div>
  <div class="hint" id="iconStatus"></div>
</div>

      <div class="field">
        <label>Site icon URL</label>
        <input
          id="siteIcoInput"
          name="siteIco"
          type="url"
          value="${escAttr(current.siteIco || "")}"
          placeholder="Detected automatically"
        >
      </div>

      <div class="field">
        <label>Reason</label>
        <input
          name="reason"
          value="${escAttr(current.reason || "")}"
        >
      </div>

      <div class="field">
        <label>State / context</label>
        <input
          name="state"
          value="${escAttr(current.state || "")}"
        >
      </div>

      <div class="field">
        <label>Tags</label>
        <input
          name="tags"
          value="${escAttr((current.tags || []).join(", "))}"
        >
        <div class="hint">Separate tags with commas.</div>
      </div>

      <div class="modal-actions">
        <button type="button" onclick="closeModal()">
          Cancel
        </button>
        <button class="primary" type="submit">
          Save
        </button>
      </div>
    </form>
  `;

    const form = $("#linkForm");
    const urlInput = $("#linkUrlInput");
    const iconInput = $("#siteIcoInput");
    const iconStatus = $("#iconStatus");



    urlInput.addEventListener("change", () => {
      detectIconForUrl(urlInput, iconInput, iconStatus);
    });

    urlInput.addEventListener("blur", () => {
      detectIconForUrl(urlInput, iconInput, iconStatus);
    });

    form.onsubmit = event => {
      event.preventDefault();

      const data = Object.fromEntries(
        new FormData(event.target)
      );

      data.url = parseHttpUrl(data.url);

      if (!data.url) {
        showToast("Please enter a valid HTTP or HTTPS URL.");
        return;
      }

      data.siteIco = parseHttpUrl(data.siteIco) || "";
      data.tags = data.tags
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);

      saveLink(data, link, group);
    };

    openModal();

    // The click that opened this modal provides the required
    // user interaction for attempting clipboard access.
    if (!link) {
      fillUrlFromClipboard(urlInput, iconInput, iconStatus);
    }
  }

  function openModal() { $('#modalBackdrop').classList.add('open') }
  function closeModal() { $('#modalBackdrop').classList.remove('open') }
  function showToast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600) }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }
  function escAttr(v) { return esc(v) }

  $('#newProjectBtn').onclick = () => openProjectModal(null);
  // $('#importBtn').onclick = () => $('#importFile').click();



// const importBtn = $("#importBtn");
const importFileInput = $("#importFile");

// importBtn.addEventListener("click", () => {
//   importFileInput.click();
// });

importFileInput.addEventListener("change", async event => {
  const [file] = event.target.files;

  if (!file) return;

  await importFile(file);

  // Allows importing the same file again later.
  event.target.value = "";
});





  function editCurrentProject() {
    openProjectModal(state.activeProject);
  }

  migrate();

  state.root = loadRoot();

  if (!state.root || !Array.isArray(state.root.projects)) {
    state.root = emptyRoot();
    saveRoot();
  }

  if (state.root.activeProjectId) {
    state.activeProject = loadProject(state.root.activeProjectId);
  }

  applyTheme();
  render();

  let iconDetectionRequest = 0;

  async function detectIconForUrl(
    urlInput,
    iconInput,
    iconStatus
  ) {
    const url = parseHttpUrl(urlInput.value);

    if (!url) {
      iconInput.value = "";
      iconStatus.textContent = "";
      return;
    }

    const requestId = ++iconDetectionRequest;

    iconStatus.textContent = "Looking for site icon…";

    const iconUrl = await discoverSiteIcon(url);

    // Ignore an older request if the user changed the URL.
    if (requestId !== iconDetectionRequest) {
      return;
    }

    if (iconUrl) {
      iconInput.value = iconUrl;
      iconStatus.textContent =
        "Site icon detected. You can edit it.";
    } else {
      iconInput.value = "";
      iconStatus.textContent =
        "Site icon could not be detected.";
    }
  }


  async function fillUrlFromClipboard(
    urlInput,
    iconInput,
    iconStatus
  ) {
    const clipboardUrl = await readClipboardUrl();

    if (!clipboardUrl) {
      return;
    }

    // Do not overwrite anything the user has already entered.
    if (urlInput.value.trim()) {
      return;
    }

    urlInput.value = clipboardUrl;

    await detectIconForUrl(
      urlInput,
      iconInput,
      iconStatus
    );
  }

  async function discoverSiteIcon(pageUrl) {
    const url = parseHttpUrl(pageUrl);

    if (!url) return "";

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/html"
        }
      });

      if (!response.ok) return "";

      const html = await response.text();
      const document = new DOMParser()
        .parseFromString(html, "text/html");

      const iconLink =
        document.querySelector(
          'link[rel~="icon"], link[rel="shortcut icon"]'
        );

      if (iconLink?.href) {
        return new URL(iconLink.href, url).href;
      }

      return new URL("/favicon.ico", url).href;
    } catch (error) {
      console.info("Could not fetch site icon", error);

      // A useful fallback, although the file may not exist.
      try {
        return new URL("/favicon.ico", url).href;
      } catch {
        return "";
      }
    }
  }


  async function readClipboardUrl() {
    if (!window.isSecureContext) {
      return {
        url: null,
        reason: "Clipboard access requires HTTPS or localhost."
      };
    }

    if (!navigator.clipboard?.readText) {
      return {
        url: null,
        reason: "Clipboard API is not available in this browser."
      };
    }

    try {
      const text = await navigator.clipboard.readText();
      const url = parseHttpUrl(text);

      if (!url) {
        return {
          url: null,
          reason: "Clipboard does not contain an HTTP or HTTPS URL."
        };
      }

      return {
        url,
        reason: ""
      };
    } catch (error) {
      return {
        url: null,
        reason: "Clipboard permission was not granted."
      };
    }
  }

  function parseHttpUrl(value) {
    if (!value) return null;

    let text = String(value).trim();

    // Remove common wrapping characters copied with a URL.
    text = text.replace(/^<|>$/g, "");
    text = text.replace(/^["']|["']$/g, "");

    try {
      const parsed = new URL(text);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        return null;
      }

      return parsed.href;
    } catch {
      return null;
    }
  }

  function saveLink(data, link, group) {
    const project = state.activeProject;
    const timestamp = now();

    if (link) {
      Object.assign(link, data, {
        updatedAt: timestamp
      });
    } else {
      group.links.push({
        id: id("link"),
        ...data,
        siteIco: data.siteIco || "",
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }

    saveProject(project);
    closeModal();
    render();
  }


  function normalizeLink(link) {
    return {
      id: link.id || id("link"),
      title: String(link.title || ""),
      url: String(link.url || ""),
      siteIco: String(link.siteIco || ""),
      reason: String(link.reason || ""),
      state: String(link.state || ""),
      tags: Array.isArray(link.tags) ? link.tags : [],
      createdAt: link.createdAt || now(),
      updatedAt: link.updatedAt || now()
    };
  }


  function actionMenu({
    id,
    label,
    items
  }) {
    return `
    <div class="tree-menu">
      <button
        type="button"
        class="tree-dots"
        aria-label="${escAttr(label)}"
        aria-haspopup="menu"
        aria-expanded="false"
        aria-controls="${escAttr(id)}"
        onclick="toggleTreeMenu(event, '${escAttr(id)}')"
      ></button>

      <div
        id="${escAttr(id)}"
        class="tree-popup"
        role="menu"
        hidden
      >
        ${items.map(item => `
          <button
            type="button"
            role="menuitem"
            class="${item.danger ? "danger" : ""}"
            onclick="${item.onclick}"
          >
            ${esc(item.label)}
          </button>
        `).join("")}
      </div>
    </div>
  `;
  }

  function toggleTreeMenu(event, menuId) {
    event.stopPropagation();

    const button = event.currentTarget;
    const menu = document.getElementById(menuId);

    if (!menu) return;

    const shouldOpen = menu.hidden;

    closeAllTreeMenus();

    menu.hidden = !shouldOpen;
    button.setAttribute(
      "aria-expanded",
      String(shouldOpen)
    );

    if (shouldOpen) {
      const firstItem = menu.querySelector(
        '[role="menuitem"]'
      );

      firstItem?.focus();
    }
  }

  function closeAllTreeMenus() {
    document
      .querySelectorAll(".tree-popup:not([hidden])")
      .forEach(menu => {
        menu.hidden = true;

        const button = document.querySelector(
          `[aria-controls="${CSS.escape(menu.id)}"]`
        );

        button?.setAttribute("aria-expanded", "false");
      });
  }

  document.addEventListener("click", event => {
    if (!event.target.closest(".tree-menu")) {
      closeAllTreeMenus();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeAllTreeMenus();
    }
  });


  function showAbout() {
    state.view = "about";
    closeAllTreeMenus?.();
    closeModal?.();
    render();
  }

  function renderAbout(main) {
    main.innerHTML = `
    <div class="workspace about-page">
      <div class="header">
        <div>
          <h1>About</h1>
          <div class="description">
            Information about this application
          </div>
        </div>

        <div class="actions">
          <button
            type="button"
            onclick="returnToProject()"
          >
            Back to project
          </button>
        </div>
      </div>

      <section class="about-card">
          <header class="hero parenth">
            <div class="hcenter">
            <div class="brandh">
              <svg  class="brand-logo" height="8%" stroke-miterlimit="10" style="fill-rule:nonzero;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;" version="1.1" viewBox="0 0 7.10239 7.12561" width="100%" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:vectornator="http://vectornator.io" xmlns:xlink="http://www.w3.org/1999/xlink">
                <defs/>
                <g id="Layer-1" vectornator:layerName="Layer 1">
                <path d="M0.27956 5.59695C0.27956 5.11204 0.672664 4.71893 1.15758 4.71893L5.72309 4.71893C6.208 4.71893 6.60111 5.11204 6.60111 5.59695L6.60111 5.59695C6.60111 6.08187 6.208 6.47498 5.72309 6.47498L1.15758 6.47498C0.672664 6.47498 0.27956 6.08187 0.27956 5.59695L0.27956 5.59695Z" fill="#bf113c" fill-rule="nonzero" opacity="1" stroke="none" vectornator:layerName="Rectangle 1"/>
                <path d="M2.37678 3.30615C2.37678 2.82123 2.76989 2.42813 3.2548 2.42813L5.72309 2.42813C6.208 2.42813 6.60111 2.82123 6.60111 3.30615L6.60111 3.30615C6.60111 3.79107 6.208 4.18417 5.72309 4.18417L3.2548 4.18417C2.76989 4.18417 2.37678 3.79107 2.37678 3.30615L2.37678 3.30615Z" fill="#bf113c" fill-rule="nonzero" opacity="1" stroke="none" vectornator:layerName="Rectangle 2"/>
                <path d="M4.82287 1.20757C4.82287 0.722651 5.21597 0.329547 5.70089 0.329547L5.72309 0.329547C6.208 0.329547 6.60111 0.722651 6.60111 1.20757L6.60111 1.20757C6.60111 1.69249 6.208 2.08559 5.72309 2.08559L5.70089 2.08559C5.21597 2.08559 4.82287 1.69249 4.82287 1.20757L4.82287 1.20757Z" fill="#bf113c" fill-rule="nonzero" opacity="1" stroke="none" vectornator:layerName="Rectangle 3"/>
                </g>
              </svg> 
              <h1>Link Nest</h1>
            </div>
           </div>
        <p>Your command center for organizing your digital assets.</p>
        <div class="subtitle">Curate, contextualize, and connect your links collections easy.</div>
    </header>

    <section class="features">
        <h3>Features</h3>
        <ul>
            <li><strong>Infinite Workspaces:</strong> Create unlimited independent collections to organize distinct areas of interest.</li>
            <li><strong>Hierarchical Architecture:</strong> Nest collections into groups and subgroups for deep, scalable organization.</li>
            <li><strong>Rich Metadata:</strong> Attach reasons, states, tags, and site icons to every link you save for maximum context.</li>
            <li><strong>Fully Portable Data:</strong> Export or import entire collections seamlessly via JSON files. Your work belongs to you, wherever it lives.</li>
        </ul>
    </section>

    <section class="data-storage features-sorage">
        <h3>Data & Storage Philosophy</h3>
        <p><b>Link Nest</b> operates entirely client-side within this browser environment. Whether for routine browsing or archival purposes,<strong>Your collections and created content are stored locally on your device.</strong></p>
        <ul>
            <li><em>Backup:</em> Export a project as JSON to save it securely offline.</li>
            <li><em>Migrate:</em> Move data instantly between devices or browsers by importing that same file.</li>
        </ul>
    </section>

    <section class="contribute">
        <h2>We Invite You to Contribute</h2>
        <p>Link Nest is open-source. Like any great library, this application thrives on community curation and collective wisdom. We believe software should be a tool you can truly trust—not one where your data extracts value from you.</p>
        <p>For a comprehensive look at our features and mission, we invite you to read our dedicated article: <a href="https://dev.to/sergio-ottovini/link-nest-how-i-tame-tab-hell-and-organize-thousands-of-links-without-bloat-391h">Link Nest: How I Tame Tab Hell and Organize Thousands of Links Without Bloat </a></p>
        <br>
        <p>If you would like to help improve the application, fix a bug, or suggest a new feature that aligns with our values of privacy and utility,<br><strong>please join us at:</strong></p>
        <a href="https://github.com/sergio-ottovini/link-nest">Link Nest Open-source Project</a>
        <br><small>Your contribution helps keep this tool useful for everyone.</small>
    </section>

    <footer>
        <div style="text-align: center; margin-top: 2rem;">Version: 0.1.0</div>
    </footer>

      </section>
    </div>
  `;
  }


  function returnToProject() {
    state.view = "project";

    if (
      !state.activeProject &&
      state.root.activeProjectId
    ) {
      state.activeProject =
        loadProject(state.root.activeProjectId);
    }

    applyTheme();
    render();
  }

  window.addEventListener("popstate", event => {
    if (event.state?.view === "about") {
      state.view = "about";
    } else {
      state.view = "project";
    }

    render();
  });


const bulkImportBtn = document.getElementById('bulkImportBtn');
  const bulkImportInput = document.getElementById('bulkImportInput');

  bulkImportBtn.addEventListener('click', () => {
    bulkImportInput.click();
  });

  bulkImportInput.addEventListener('change', async event => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      await importFile(file, file.name);
    }
    event.target.value = '';
  });


  function escapeJs(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("click", event => {
  const button = event.target.closest(".tag-button");
  if (!button) return;

  const tag = button.dataset.tag;
  searchByTag(tag);
});

function searchByTag(tag) {
  console.log("Search by tag:", tag);

  // Later, filter or re-render links here.
}

document.addEventListener('DOMContentLoaded', () => {
    // Example: Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
});
