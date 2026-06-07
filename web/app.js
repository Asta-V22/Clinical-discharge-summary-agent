// ================================================================
// Clinical Discharge Summary Agent — Frontend Application Logic
// ================================================================

// Dynamically resolve API URL to support local development (e.g. Live Server or opening files directly)
// When served by FastAPI (locally or on Render/etc.), use same-origin (empty string).
// Only use localhost:8000 when opening the HTML file directly from disk.
const API = window.location.protocol === 'file:' 
    ? 'http://localhost:8000' 
    : '';

// ── Global State ────────────────────────────────────────────────────
const state = {
    patients: {},          // patient_name -> { preview, full_length }
    patientTexts: {},      // patient_name -> raw_text (full)
    pipelineResults: {},   // patient_name -> full pipeline result
    savedDrafts: [],       // from /api/drafts
    savedTraces: [],       // from /api/traces
    currentSummaryPatient: null,
    currentTracePatient: null,
    currentLearningPatient: null,
    learningChart: null,
};

// ── Tab Navigation ──────────────────────────────────────────────────
function switchTab(tabId) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    const section = document.getElementById(`page-${tabId}`);
    const tab = document.querySelector(`[data-tab="${tabId}"]`);
    if (section) section.classList.add('active');
    if (tab) tab.classList.add('active');

    // Lazy-load data when switching tabs
    if (tabId === 'summary') loadSavedDrafts();
    if (tabId === 'trace') loadSavedTraces();
    if (tabId === 'learning') loadLearningData();
    if (tabId === 'dashboard') refreshDashboard();
}

document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ── Summary Sub-tabs ────────────────────────────────────────────────
function switchSummaryTab(subTab) {
    document.querySelectorAll('#summary-tabs .inner-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-subtab="${subTab}"]`).classList.add('active');
    document.getElementById('summary-document-view').style.display = subTab === 'document' ? 'block' : 'none';
    document.getElementById('summary-diff-view').style.display = subTab === 'diff' ? 'block' : 'none';
}

// ── Toast Notifications ─────────────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ── API Helpers ─────────────────────────────────────────────────────
async function apiGet(url) {
    const res = await fetch(`${API}${url}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'API request failed');
    }
    return res.json();
}

async function apiPost(url, body, isFormData = false) {
    const opts = { method: 'POST' };
    if (isFormData) {
        opts.body = body;
    } else {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API}${url}`, opts);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'API request failed');
    }
    return res.json();
}

// ── Dashboard ───────────────────────────────────────────────────────
async function refreshDashboard() {
    try {
        const [draftsRes, tracesRes, learningRes] = await Promise.all([
            apiGet('/api/drafts'),
            apiGet('/api/traces'),
            apiGet('/api/learning-curve'),
        ]);

        const numPatients = draftsRes.drafts.length;
        let totalSteps = 0;
        let totalFlags = 0;

        draftsRes.drafts.forEach(d => {
            totalFlags += (d.data.clinical_safety_flags || []).length;
        });
        tracesRes.traces.forEach(t => {
            totalSteps += (t.data || []).length;
        });

        let bestScore = '—';
        const ld = learningRes.learning_data;
        if (ld && Object.keys(ld).length > 0) {
            let minLast = Infinity;
            Object.values(ld).forEach(arr => {
                if (arr.length > 0) {
                    const last = arr[arr.length - 1];
                    if (last < minLast) minLast = last;
                }
            });
            bestScore = minLast === 0 ? '0.0000' : minLast.toFixed(4);
        }

        animateStatValue('stat-patients-val', numPatients);
        animateStatValue('stat-steps-val', totalSteps);
        animateStatValue('stat-flags-val', totalFlags);
        document.getElementById('stat-learning-val').textContent = bestScore;

    } catch (e) {
        console.warn('Dashboard refresh error:', e);
    }
}

function animateStatValue(elementId, targetValue) {
    const el = document.getElementById(elementId);
    let current = 0;
    const step = Math.ceil(targetValue / 20);
    const interval = setInterval(() => {
        current += step;
        if (current >= targetValue) {
            current = targetValue;
            clearInterval(interval);
        }
        el.textContent = current;
    }, 30);
}

// ── PDF Upload ──────────────────────────────────────────────────────
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFileUpload(fileInput.files[0]);
});

async function handleFileUpload(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Please upload a PDF file.', 'error');
        return;
    }

    uploadZone.innerHTML = `
        <div class="upload-zone-icon"><div class="spinner" style="width:40px;height:40px;border:3px solid var(--border-glass);border-top-color:var(--teal);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto;"></div></div>
        <div class="upload-zone-text" style="position:relative;">Parsing clinical records...</div>
        <div class="upload-zone-hint" style="position:relative;">Extracting patient data from ${file.name}</div>
    `;

    try {
        const formData = new FormData();
        formData.append('file', file);
        const result = await apiPost('/api/upload-pdf', formData, true);

        state.patients = result.patients;
        // Store the full text from preview (will be fetched fully via pipeline)
        Object.keys(result.patients).forEach(name => {
            state.patientTexts[name] = result.patients[name].preview;
        });

        renderPatientCards();
        showToast(`Extracted ${Object.keys(result.patients).length} patient(s) successfully.`, 'success');
    } catch (e) {
        showToast(`Upload failed: ${e.message}`, 'error');
        resetUploadZone();
    }
}

function resetUploadZone() {
    uploadZone.innerHTML = `
        <div class="upload-zone-icon">📁</div>
        <div class="upload-zone-text">Drag & drop a clinical PDF here, or click to browse</div>
        <div class="upload-zone-hint">Supports multi-patient PDF documents</div>
    `;
}

function renderPatientCards() {
    const container = document.getElementById('patients-container');
    const grid = document.getElementById('patients-grid');
    container.style.display = 'block';
    grid.innerHTML = '';

    resetUploadZone();

    Object.entries(state.patients).forEach(([name, info], idx) => {
        const card = document.createElement('div');
        card.className = 'glass-card patient-card';
        card.style.animationDelay = `${idx * 0.15}s`;
        card.classList.add('animate-in');
        card.innerHTML = `
            <div class="patient-card-header">
                <span class="patient-name">🧑‍⚕️ ${name}</span>
                <span class="patient-badge">${(info.full_length / 1000).toFixed(1)}K chars</span>
            </div>
            <div class="patient-text-preview">${escapeHtml(info.preview)}</div>
            <div class="patient-actions">
                <button class="btn btn-primary btn-sm" id="run-btn-${idx}" onclick="runFullPipeline('${name}', ${idx})">
                    🚀 Run Full Pipeline
                </button>
                <button class="btn btn-secondary btn-sm" onclick="switchTab('agent')">
                    🔍 Monitor
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ── Full Pipeline Execution ─────────────────────────────────────────
async function runFullPipeline(patientName, btnIdx) {
    const btn = document.getElementById(`run-btn-${btnIdx}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Processing...';
    }

    showToast(`Starting 3-iteration pipeline for ${patientName}...`, 'info');

    // Switch to agent monitor
    switchTab('agent');
    showAgentMonitor(patientName);

    try {
        const result = await apiGet(`/api/run-full-pipeline?patient_name=${encodeURIComponent(patientName)}`);
        state.pipelineResults[patientName] = result;

        // Animate the agent timeline with the final iteration's trace
        const finalIteration = result.iterations[result.iterations.length - 1];
        await animateAgentTimeline(patientName, finalIteration.trace, result.iterations.length);

        showToast(`Pipeline completed for ${patientName}! Edit distance: ${finalIteration.edit_distance.toFixed(4)}`, 'success');

        // Update selectors in other tabs
        updatePatientSelectors();

        // Auto-load this patient's data in summary/learning/trace tabs
        state.currentSummaryPatient = patientName;
        state.currentLearningPatient = patientName;
        state.currentTracePatient = patientName;

    } catch (e) {
        showToast(`Pipeline failed: ${e.message}`, 'error');
        updateAgentStatus('Error', 'status-executing');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🚀 Run Full Pipeline';
        }
    }
}

// ── Agent Monitor ───────────────────────────────────────────────────
function showAgentMonitor(patientName) {
    document.getElementById('agent-empty').style.display = 'none';
    document.getElementById('agent-live').style.display = 'block';
    document.getElementById('agent-patient-name').textContent = `Processing: ${patientName}`;
    document.getElementById('agent-iteration-label').textContent = 'Running 3-iteration pipeline...';
    document.getElementById('agent-timeline').innerHTML = '';
    updateAgentProgress(0, 10);
    updateAgentStatus('Initializing', 'status-observing');
}

function updateAgentProgress(current, max) {
    const pct = Math.round((current / max) * 100);
    document.getElementById('agent-progress').style.width = `${pct}%`;
    document.getElementById('agent-step-label').textContent = `Step ${current} / ${max}`;
    document.getElementById('agent-percent-label').textContent = `${pct}%`;
}

function updateAgentStatus(label, className) {
    const badge = document.getElementById('agent-status-badge');
    badge.className = `status-badge ${className}`;
    badge.textContent = `● ${label}`;
}

async function animateAgentTimeline(patientName, trace, iteration) {
    const timeline = document.getElementById('agent-timeline');
    timeline.innerHTML = '';
    document.getElementById('agent-iteration-label').textContent = `Iteration ${iteration} — Final Aligned Run`;

    const totalSteps = trace.length;

    for (let i = 0; i < totalSteps; i++) {
        const step = trace[i];
        const toolName = extractToolName(step.action_chosen);

        // Update status badges with animation
        if (i < totalSteps - 1) {
            if (step.action_chosen.includes('CALL_TOOL')) {
                updateAgentStatus('Executing Tool', 'status-executing');
            } else {
                updateAgentStatus('Reasoning', 'status-reasoning');
            }
        } else {
            updateAgentStatus('Finalizing', 'status-finalizing');
        }

        updateAgentProgress(i + 1, totalSteps);

        const stepEl = document.createElement('div');
        stepEl.className = 'timeline-step';
        stepEl.style.animationDelay = `${i * 0.1}s`;

        stepEl.innerHTML = `
            <div class="step-dot"></div>
            <div class="glass-card-static step-card">
                <div class="step-header">
                    <span class="step-number">${step.step_number}</span>
                    <span class="tool-pill ${getToolClass(toolName)}">${getToolIcon(toolName)} ${toolName}</span>
                </div>
                <div class="step-reasoning">${escapeHtml(step.reasoning)}</div>
                <div class="step-result">${escapeHtml(step.result)}</div>
                <div class="step-next">→ Next: ${escapeHtml(step.next_decision)}</div>
            </div>
        `;
        timeline.appendChild(stepEl);

        // Stagger animation — wait between steps
        await sleep(350);
    }

    updateAgentStatus('Complete', 'status-complete');
    updateAgentProgress(totalSteps, totalSteps);
}

function extractToolName(action) {
    if (action.includes('MedicationReconciliation')) return 'MedicationReconciliation';
    if (action.includes('PendingResultsCheck')) return 'PendingResultsCheck';
    if (action.includes('DiagnosticCheck')) return 'DiagnosticCheck';
    if (action.includes('FlagContradiction')) return 'FlagContradiction';
    if (action.includes('FINAL_DRAFT')) return 'FINAL_DRAFT';
    return action;
}

function getToolClass(tool) {
    if (tool.includes('Medication')) return 'tool-medication';
    if (tool.includes('Pending') || tool.includes('Results')) return 'tool-labs';
    if (tool.includes('Diagnostic')) return 'tool-diagnostic';
    if (tool.includes('Flag') || tool.includes('Contradiction')) return 'tool-conflict';
    if (tool.includes('FINAL')) return 'tool-finalize';
    return 'tool-medication';
}

function getToolIcon(tool) {
    if (tool.includes('Medication')) return '💊';
    if (tool.includes('Pending') || tool.includes('Results')) return '🧪';
    if (tool.includes('Diagnostic')) return '📊';
    if (tool.includes('Flag') || tool.includes('Contradiction')) return '🚩';
    if (tool.includes('FINAL')) return '✅';
    return '🔧';
}

// ── Patient Selectors ───────────────────────────────────────────────
function updatePatientSelectors() {
    const names = Object.keys(state.pipelineResults);

    // Also include saved drafts
    state.savedDrafts.forEach(d => {
        const name = d.data.patient_name;
        if (name && !names.includes(name)) names.push(name);
    });

    renderPatientSelector('summary-patient-selector', names, (name) => {
        state.currentSummaryPatient = name;
        renderSummaryForPatient(name);
    });

    renderPatientSelector('learning-patient-selector', Object.keys(state.pipelineResults), (name) => {
        state.currentLearningPatient = name;
        renderLearningForPatient(name);
    });

    renderPatientSelector('trace-patient-selector', names, (name) => {
        state.currentTracePatient = name;
        renderTraceForPatient(name);
    });
}

function renderPatientSelector(containerId, names, onClick) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    names.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'patient-select-btn';
        btn.textContent = `🧑‍⚕️ ${name}`;
        btn.onclick = () => {
            container.querySelectorAll('.patient-select-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onClick(name);
        };
        container.appendChild(btn);
    });
}

// ── Discharge Summary Viewer ────────────────────────────────────────
async function loadSavedDrafts() {
    try {
        const res = await apiGet('/api/drafts');
        state.savedDrafts = res.drafts;
        updatePatientSelectors();

        // Auto-select first patient if none selected
        if (!state.currentSummaryPatient && res.drafts.length > 0) {
            const firstName = res.drafts[0].data.patient_name;
            state.currentSummaryPatient = firstName;
            renderSummaryForPatient(firstName);
            // Highlight the button
            const btns = document.querySelectorAll('#summary-patient-selector .patient-select-btn');
            if (btns.length > 0) btns[0].classList.add('active');
        } else if (state.currentSummaryPatient) {
            renderSummaryForPatient(state.currentSummaryPatient);
            highlightPatientBtn('summary-patient-selector', state.currentSummaryPatient);
        }
    } catch (e) {
        console.warn('Failed to load drafts:', e);
    }
}

function renderSummaryForPatient(patientName) {
    // Try pipeline results first, then saved drafts
    let draft = null;
    let edited = null;

    const pipelineResult = state.pipelineResults[patientName];
    if (pipelineResult) {
        const lastIter = pipelineResult.iterations[pipelineResult.iterations.length - 1];
        draft = lastIter.draft;
        edited = lastIter.edited;
    } else {
        const saved = state.savedDrafts.find(d => d.data.patient_name === patientName);
        if (saved) draft = saved.data;
    }

    if (!draft) {
        document.getElementById('summary-empty').style.display = 'block';
        document.getElementById('summary-content').style.display = 'none';
        return;
    }

    document.getElementById('summary-empty').style.display = 'none';
    document.getElementById('summary-content').style.display = 'block';
    renderDischargeSummary(draft);

    if (edited) {
        renderDiffView(draft, edited);
    }
}

function renderDischargeSummary(draft) {
    const el = document.getElementById('summary-content');
    const flags = draft.clinical_safety_flags || [];
    const meds = draft.discharge_medications || [];
    const pending = draft.pending_results || [];
    const procedures = draft.procedures_performed || [];
    const secondary = draft.secondary_diagnoses || [];
    const allergies = draft.allergies || [];

    el.innerHTML = `
        <div class="glass-card-static summary-section" style="margin-bottom:24px;">
            <div class="summary-section-title">Patient Demographics</div>
            <div class="summary-field"><span class="summary-field-label">Patient Name</span><span class="summary-field-value">${escapeHtml(draft.patient_name)}</span></div>
            <div class="summary-field"><span class="summary-field-label">MRN</span><span class="summary-field-value">${escapeHtml(draft.medical_record_number)}</span></div>
            <div class="summary-field"><span class="summary-field-label">Age / Gender</span><span class="summary-field-value">${escapeHtml(draft.age_and_gender)}</span></div>
            <div class="summary-field"><span class="summary-field-label">Admission Date</span><span class="summary-field-value">${escapeHtml(draft.admission_date)}</span></div>
            <div class="summary-field"><span class="summary-field-label">Discharge Date</span><span class="summary-field-value">${escapeHtml(draft.discharge_date)}</span></div>
        </div>

        <div class="glass-card-static summary-section" style="margin-bottom:24px;">
            <div class="summary-section-title">Diagnoses</div>
            <div class="summary-field"><span class="summary-field-label">Principal Diagnosis</span><span class="summary-field-value" style="font-weight:600;">${escapeHtml(draft.principal_diagnosis)}</span></div>
            ${secondary.length > 0 ? `
                <div class="summary-field" style="align-items:flex-start;"><span class="summary-field-label">Secondary Diagnoses</span>
                <span class="summary-field-value">${secondary.map(d => `• ${escapeHtml(d)}`).join('<br>')}</span></div>
            ` : ''}
        </div>

        <div class="glass-card-static summary-section" style="margin-bottom:24px;">
            <div class="summary-section-title">Hospital Course</div>
            <p style="font-size:0.88rem; color:var(--text-secondary); line-height:1.8;">${escapeHtml(draft.hospital_course)}</p>
        </div>

        ${procedures.length > 0 ? `
        <div class="glass-card-static summary-section" style="margin-bottom:24px;">
            <div class="summary-section-title">Procedures Performed</div>
            ${procedures.map(p => `<div style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:4px;">• ${escapeHtml(p)}</div>`).join('')}
        </div>
        ` : ''}

        <div class="glass-card-static summary-section" style="margin-bottom:24px;">
            <div class="summary-section-title">Discharge Medications</div>
            <div style="overflow-x:auto;">
                <table class="meds-table">
                    <thead>
                        <tr>
                            <th>Medication</th>
                            <th>Dosage</th>
                            <th>Frequency</th>
                            <th>Status</th>
                            <th>Reconciliation Note</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${meds.map(m => `
                            <tr>
                                <td style="font-weight:600; color:var(--text-primary);">${escapeHtml(m.name)}</td>
                                <td>${escapeHtml(m.dosage)}</td>
                                <td>${escapeHtml(m.frequency)}</td>
                                <td><span class="status-pill status-${m.status}">${m.status}</span></td>
                                <td style="font-size:0.8rem;">${escapeHtml(m.reconciliation_note)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="glass-card-static summary-section" style="margin-bottom:24px;">
            <div class="summary-section-title">Allergies</div>
            <p style="font-size:0.88rem; color:var(--text-secondary);">${allergies.map(a => escapeHtml(a)).join(', ') || 'None documented'}</p>
        </div>

        ${pending.length > 0 ? `
        <div class="summary-section" style="margin-bottom:24px;">
            <div class="summary-section-title" style="color:var(--amber); border-bottom-color:rgba(255,165,2,0.2);">⚠ Pending Results</div>
            ${pending.map(p => `<div class="pending-box">⏳ ${escapeHtml(p)}</div>`).join('')}
        </div>
        ` : ''}

        <div class="glass-card-static summary-section" style="margin-bottom:24px;">
            <div class="summary-section-title">Follow-up Instructions</div>
            <p style="font-size:0.88rem; color:var(--text-secondary); line-height:1.8;">${escapeHtml(draft.follow_up_instructions)}</p>
        </div>

        <div class="glass-card-static summary-section" style="margin-bottom:24px;">
            <div class="summary-section-title">Discharge Condition</div>
            <p style="font-size:0.95rem; color:var(--text-primary); font-weight:600;">${escapeHtml(draft.discharge_condition)}</p>
        </div>

        ${flags.length > 0 ? `
        <div class="summary-section" style="margin-bottom:24px;">
            <div class="summary-section-title" style="color:var(--red); border-bottom-color:rgba(255,71,87,0.2);">🚩 Clinical Safety Flags</div>
            <div class="flags-grid">
                ${flags.map(f => `
                    <div class="flag-card flag-${f.category}">
                        <div class="flag-category">${formatFlagCategory(f.category)}</div>
                        <div class="flag-item">${escapeHtml(f.item_involved)}</div>
                        <div class="flag-desc">${escapeHtml(f.description)}</div>
                        <div class="flag-action">Action: ${escapeHtml(f.action_taken)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    `;
}

function formatFlagCategory(cat) {
    const map = {
        'MISSING_DATA': '⚠️ Missing Data',
        'MEDICATION_MISMATCH': '💊 Medication Mismatch',
        'CONFLICTING_DIAGNOSES': '⚡ Conflicting Diagnoses',
        'PENDING_RESULT_WARNING': '⏳ Pending Result Warning',
    };
    return map[cat] || cat;
}

// ── Diff View ───────────────────────────────────────────────────────
function renderDiffView(draft, edited) {
    document.getElementById('diff-empty').style.display = 'none';
    document.getElementById('diff-content').style.display = 'grid';

    const diffEl = document.getElementById('diff-content');

    const fields = [
        { label: 'Principal Diagnosis', key: 'principal_diagnosis' },
        { label: 'Follow-up Instructions', key: 'follow_up_instructions' },
        { label: 'Discharge Condition', key: 'discharge_condition' },
    ];

    let leftHtml = '<div class="diff-panel glass-card-static diff-ai"><div class="diff-panel-title">🤖 AI Agent Draft</div><div class="diff-content">';
    let rightHtml = '<div class="diff-panel glass-card-static diff-doctor"><div class="diff-panel-title">👨‍⚕️ Doctor-Edited Version</div><div class="diff-content">';

    fields.forEach(f => {
        const orig = draft[f.key] || '';
        const edit = edited[f.key] || '';

        leftHtml += `<div style="margin-bottom:16px;"><strong style="color:var(--text-primary);font-size:0.82rem;">${f.label}</strong><br>`;
        rightHtml += `<div style="margin-bottom:16px;"><strong style="color:var(--text-primary);font-size:0.82rem;">${f.label}</strong><br>`;

        if (orig === edit) {
            leftHtml += `<span>${escapeHtml(orig)}</span>`;
            rightHtml += `<span>${escapeHtml(edit)}</span>`;
        } else {
            // Highlight differences
            leftHtml += `<span>${escapeHtml(orig)}</span>`;
            // Find what was added in the edited version
            const added = findAddedText(orig, edit);
            if (added.prefix) {
                rightHtml += `<span class="diff-highlight">${escapeHtml(added.prefix)}</span>`;
            }
            rightHtml += `<span>${escapeHtml(added.shared)}</span>`;
            if (added.suffix) {
                rightHtml += `<span class="diff-highlight">${escapeHtml(added.suffix)}</span>`;
            }
        }

        leftHtml += '</div>';
        rightHtml += '</div>';
    });

    leftHtml += '</div></div>';
    rightHtml += '</div></div>';

    diffEl.innerHTML = leftHtml + rightHtml;
}

function findAddedText(original, edited) {
    // Simple diff: find prefix and suffix that were added
    let prefix = '';
    let suffix = '';
    let shared = original;

    if (edited.startsWith(original)) {
        suffix = edited.slice(original.length);
        shared = original;
        prefix = '';
    } else if (edited.endsWith(original)) {
        prefix = edited.slice(0, edited.length - original.length);
        shared = original;
        suffix = '';
    } else if (edited.includes(original)) {
        const idx = edited.indexOf(original);
        prefix = edited.slice(0, idx);
        shared = original;
        suffix = edited.slice(idx + original.length);
    } else {
        // Fallback: just show both
        shared = edited;
    }
    return { prefix, shared, suffix };
}

// ── Learning Panel ──────────────────────────────────────────────────
async function loadLearningData() {
    updatePatientSelectors();

    if (state.currentLearningPatient) {
        renderLearningForPatient(state.currentLearningPatient);
        highlightPatientBtn('learning-patient-selector', state.currentLearningPatient);
    } else if (Object.keys(state.pipelineResults).length > 0) {
        const first = Object.keys(state.pipelineResults)[0];
        state.currentLearningPatient = first;
        renderLearningForPatient(first);
        highlightPatientBtn('learning-patient-selector', first);
    } else {
        // Try to load from API fallback data
        try {
            const res = await apiGet('/api/learning-curve');
            if (res.learning_data && Object.keys(res.learning_data).length > 0) {
                renderLearningChartFromData(res.learning_data);
                document.getElementById('learning-empty').style.display = 'none';
                document.getElementById('learning-content').style.display = 'block';
            }
        } catch (e) {
            // keep empty state
        }
    }
}

function renderLearningForPatient(patientName) {
    const result = state.pipelineResults[patientName];
    if (!result) return;

    document.getElementById('learning-empty').style.display = 'none';
    document.getElementById('learning-content').style.display = 'block';

    // Render iteration cards
    const grid = document.getElementById('iterations-grid');
    grid.innerHTML = '';

    const labels = ['Baseline Generation', 'Feedback-Injected', 'Fully Aligned'];
    result.iterations.forEach((iter, idx) => {
        const isZero = iter.edit_distance === 0;
        const card = document.createElement('div');
        card.className = 'glass-card iteration-card animate-in';
        card.style.animationDelay = `${idx * 0.15}s`;
        card.innerHTML = `
            <div class="iteration-number">Iteration ${iter.iteration}</div>
            <div class="iteration-label">${labels[idx]}</div>
            <div class="iteration-score ${isZero ? 'score-zero' : 'score-high'}">${iter.edit_distance.toFixed(4)}</div>
            <div class="iteration-status" style="color: ${isZero ? 'var(--teal)' : 'var(--amber)'}">
                ${isZero ? '✅ Perfect Alignment' : '⚡ Corrections Needed'}
            </div>
        `;
        grid.appendChild(card);
    });

    // Show perfect badge if final distance is 0
    const finalDist = result.iterations[result.iterations.length - 1].edit_distance;
    document.getElementById('perfect-alignment').style.display = finalDist === 0 ? 'block' : 'none';

    // Render chart
    const allData = {};
    Object.entries(state.pipelineResults).forEach(([name, res]) => {
        allData[name] = res.iterations.map(i => i.edit_distance);
    });
    renderLearningChartFromData(allData);

    // Render rules
    const rulesList = document.getElementById('rules-list');
    rulesList.innerHTML = '';
    const rules = result.final_correction_memory || [];
    if (rules.length === 0) {
        rulesList.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-state-text">No correction rules extracted yet.</div></div>';
    } else {
        rules.forEach(rule => {
            const card = document.createElement('div');
            card.className = 'glass-card-static rule-card';
            card.innerHTML = `<div class="rule-icon">📏</div><div class="rule-text">${escapeHtml(rule)}</div>`;
            rulesList.appendChild(card);
        });
    }
}

function renderLearningChartFromData(data) {
    const ctx = document.getElementById('learning-chart');
    if (!ctx) return;

    if (state.learningChart) {
        state.learningChart.destroy();
    }

    const datasets = [];
    const colors = ['#00d4aa', '#3b82f6', '#ffa502', '#ff4757'];
    let maxLen = 0;

    Object.entries(data).forEach(([name, distances], idx) => {
        if (distances.length > maxLen) maxLen = distances.length;
        datasets.push({
            label: `Patient: ${name}`,
            data: distances,
            borderColor: colors[idx % colors.length],
            backgroundColor: colors[idx % colors.length] + '20',
            borderWidth: 3,
            pointRadius: 6,
            pointBackgroundColor: colors[idx % colors.length],
            pointBorderColor: '#0a0f1e',
            pointBorderWidth: 2,
            tension: 0.3,
            fill: true,
        });
    });

    const labels = Array.from({ length: maxLen }, (_, i) => `Run ${i + 1}`);

    state.learningChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1500, easing: 'easeInOutQuart' },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Inter' } },
                    title: { display: true, text: 'Optimization Iterations', color: '#94a3b8', font: { family: 'Inter', size: 12 } }
                },
                y: {
                    min: -0.05, max: 1.05,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Inter' } },
                    title: { display: true, text: 'Normalized Edit Distance', color: '#94a3b8', font: { family: 'Inter', size: 12 } }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#f1f5f9', font: { family: 'Inter', size: 12 }, usePointStyle: true }
                },
                tooltip: {
                    backgroundColor: 'rgba(10,15,30,0.9)',
                    titleFont: { family: 'Inter' },
                    bodyFont: { family: 'Inter' },
                    borderColor: 'rgba(0,212,170,0.3)',
                    borderWidth: 1,
                }
            }
        }
    });
}

// ── Trace Explorer ──────────────────────────────────────────────────
async function loadSavedTraces() {
    try {
        const res = await apiGet('/api/traces');
        state.savedTraces = res.traces;
        updatePatientSelectors();

        if (!state.currentTracePatient && res.traces.length > 0) {
            // Derive patient name from filename
            const firstName = res.traces[0].filename.replace('_trace.json', '').replace(/_/g, ' ');
            state.currentTracePatient = firstName;
            renderTraceFromSaved(firstName);
            highlightPatientBtn('trace-patient-selector', firstName);
        } else if (state.currentTracePatient) {
            renderTraceForPatient(state.currentTracePatient);
            highlightPatientBtn('trace-patient-selector', state.currentTracePatient);
        }
    } catch (e) {
        console.warn('Failed to load traces:', e);
    }
}

function renderTraceForPatient(patientName) {
    // Try pipeline results first
    const pipelineResult = state.pipelineResults[patientName];
    if (pipelineResult) {
        const lastIter = pipelineResult.iterations[pipelineResult.iterations.length - 1];
        renderTraceAccordion(lastIter.trace);
        return;
    }
    // Fallback to saved
    renderTraceFromSaved(patientName);
}

function renderTraceFromSaved(patientName) {
    const slug = patientName.replace(/ /g, '_');
    const saved = state.savedTraces.find(t => t.filename.includes(slug));
    if (saved) {
        renderTraceAccordion(saved.data);
    }
}

function renderTraceAccordion(traceData) {
    const accordion = document.getElementById('trace-accordion');
    const emptyEl = document.getElementById('trace-empty');

    if (!traceData || traceData.length === 0) {
        emptyEl.style.display = 'block';
        accordion.innerHTML = '';
        return;
    }

    emptyEl.style.display = 'none';
    accordion.innerHTML = '';

    traceData.forEach(step => {
        const item = document.createElement('div');
        item.className = 'trace-item';
        item.dataset.tool = extractToolName(step.action_chosen);
        item.dataset.content = JSON.stringify(step).toLowerCase();

        const toolName = extractToolName(step.action_chosen);
        item.innerHTML = `
            <div class="trace-item-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="chevron">▶</span>
                <span class="step-number">${step.step_number}</span>
                <span class="tool-pill ${getToolClass(toolName)}">${getToolIcon(toolName)} ${toolName}</span>
                <span style="flex:1; font-size:0.82rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${escapeHtml(step.reasoning.substring(0, 80))}${step.reasoning.length > 80 ? '...' : ''}
                </span>
            </div>
            <div class="trace-item-body">
                <div class="trace-json">${syntaxHighlightJson(JSON.stringify(step, null, 2))}</div>
            </div>
        `;
        accordion.appendChild(item);
    });
}

// Trace search & filter
document.getElementById('trace-search').addEventListener('input', filterTraces);
document.getElementById('trace-filter').addEventListener('change', filterTraces);

function filterTraces() {
    const searchTerm = document.getElementById('trace-search').value.toLowerCase();
    const filterTool = document.getElementById('trace-filter').value;

    document.querySelectorAll('#trace-accordion .trace-item').forEach(item => {
        const matchSearch = !searchTerm || item.dataset.content.includes(searchTerm);
        const matchTool = filterTool === 'all' || item.dataset.tool === filterTool;
        item.style.display = matchSearch && matchTool ? 'block' : 'none';
    });
}

// ── Utility Functions ───────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function syntaxHighlightJson(json) {
    return json
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
        .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
        .replace(/: (\d+\.?\d*)/g, ': <span class="json-number">$1</span>');
}

function highlightPatientBtn(containerId, patientName) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.patient-select-btn').forEach(btn => {
        if (btn.textContent.includes(patientName)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ── Initialize ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    refreshDashboard();
});
