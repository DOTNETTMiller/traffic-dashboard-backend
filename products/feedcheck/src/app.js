(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const sampleOnly = document.body.dataset.edition === 'demo';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let mode = 'file', selectedFile = null, report = null, baseline = null, demo = false, visibleLimit = 100;
  let running = false, allForPrint = false;
  function message(value, error = false) {
    $('message').textContent = value;
    $('message').className = error ? 'error' : '';
    $('message').hidden = !value;
  }
  function switchView(view) {
    for (const button of document.querySelectorAll('[data-view]')) {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    for (const section of document.querySelectorAll('.view')) section.hidden = section.id !== 'view-' + view;
  }
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => switchView(button.dataset.view));
  const inputTabs = Array.from(document.querySelectorAll('[data-input]'));
  function setInput(next) {
    mode = next;
    for (const button of inputTabs) {
      const selected = button.dataset.input === mode;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      $('input-' + button.dataset.input).hidden = !selected;
    }
  }
  inputTabs.forEach((button, index) => {
    button.addEventListener('click', () => setInput(button.dataset.input));
    button.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
      if (next !== null) { event.preventDefault(); setInput(inputTabs[next].dataset.input); inputTabs[next].focus(); }
    });
  });
  function chooseFile(file) {
    if (!file) return;
    if (file.size > FeedCheck.MAX_BYTES) { message('Choose a JSON file under 20 MB.', true); return; }
    selectedFile = file;
    $('file-label').textContent = file.name + ' · ' + (file.size / 1024).toFixed(0) + ' KB';
    setInput('file');
    message('File selected. Run the assessment when you’re ready.');
  }
  $('feed-file').addEventListener('change', event => chooseFile(event.target.files[0]));
  for (const name of ['dragover', 'dragleave', 'drop']) $('dropzone').addEventListener(name, event => {
    event.preventDefault();
    $('dropzone').classList.toggle('dragging', name === 'dragover');
    if (name === 'drop') chooseFile(event.dataTransfer.files[0]);
  });
  function settings() {
    return { feedMinutes: $('feed-minutes').value, eventHours: $('event-hours').value, expiredHours: $('expired-hours').value, organization: $('organization').value };
  }
  function metric(label, value, detail, cls = '') {
    return '<div class="metric ' + cls + '"><span class="metric-label">' + escape(label) + '</span><strong>' + escape(value) + '</strong><small>' + escape(detail) + '</small></div>';
  }
  const labels = {
    ID_MISSING: 'Missing IDs', ID_DUPLICATE: 'Duplicate IDs', GEOMETRY_INVALID: 'Geometry problems', TIME_INVALID: 'Invalid event timestamps', TIME_ORDER: 'Reversed event dates',
    UPDATE_MISSING: 'Missing event updates', EVENT_STALE: 'Stale event confirmations', EVENT_ENDED: 'Ended events to review', ROAD_MISSING: 'Missing road names',
    EVENT_TYPE_MISSING: 'Missing event types', START_MISSING: 'Missing event starts', UPDATE_FUTURE: 'Future event updates', FEATURE_TYPE: 'Invalid feature types', PROPERTIES_INVALID: 'Invalid properties', RECORD_INVALID: 'Malformed records',
    EMPTY_FEED: 'Empty feed', FEED_TIME_MISSING: 'Missing feed timestamp', FEED_TIME_INVALID: 'Invalid feed timestamp', FEED_TIME_FUTURE: 'Future feed timestamp', FEED_STALE: 'Stale feed publication'
  };
  function renderOverview() {
    if (!report) return;
    const s = report.summary;
    const groups = new Map();
    for (const issue of report.issues) {
      const group = groups.get(issue.code) || { count: 0, severity: issue.severity };
      group.count++; groups.set(issue.code, group);
    }
    const top = Array.from(groups).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
    const max = Math.max(1, ...top.map(g => g[1].count));
    const groupHtml = top.map(([code, g]) => '<div class="rule-row"><span>' + escape(labels[code] || code) + '</span><strong>' + g.count + '</strong></div><div class="rule-track"><div class="rule-fill ' + g.severity + '" style="width:' + Math.round(g.count / max * 100) + '%"></div></div>').join('');
    const status = s.records === 0 ? 'No event quality conclusion: the feed is empty.' : s.errors + s.warnings === 0 ? 'No findings from the checks in this edition. Confirm source coverage and field accuracy separately.' : s.flagged === 0 ? 'Event-level checks found no issues. Review the feed-level findings below.' : s.flagged + ' of ' + s.records + ' records need review. Some records have more than one finding.';
    $('overview-report').innerHTML = (demo ? '<div class="demo-banner"><strong>Sample assessment</strong> · Synthetic records with intentional issues. This is not a live agency feed or a complete WZDx schema example.</div>' : '') +
      '<div class="metrics">' + metric('Records checked', s.records, report.format) + metric('Without findings', s.clear, s.records ? 'Event-level checks only' : 'No records to assess', 'clear') + metric('Errors', s.errors, 'Structural or consistency issues', 'error') + metric('Warnings', s.warnings, 'Conditions to review', 'warning') + '</div>' +
      '<p class="assessment-note">' + escape(status) + ' Feed-level findings: <strong>' + s.feedFindings + '</strong>.</p>' +
      '<div class="overview-grid"><article class="panel"><h2>' + (top.length ? 'Where to focus' : 'Review complete') + '</h2><p class="panel-intro">' + (top.length ? 'Most frequent findings in this assessment.' : 'No configured rules fired. This does not certify conformance or real-world accuracy.') + '</p>' + groupHtml + (top.length ? '<button class="button secondary" id="review-findings">Review all findings →</button>' : '') + '</article>' +
      '<article class="panel"><h2>Assessment details</h2><dl class="details-list"><div><dt>Detected structure</dt><dd>' + escape(report.format) + '</dd></div><div><dt>Declared version</dt><dd>' + escape(report.declaredVersion) + '</dd></div><div><dt>Feed age threshold</dt><dd>' + report.settings.feedMinutes + ' minutes</dd></div><div><dt>Event age threshold</dt><dd>' + report.settings.eventHours + ' hours</dd></div><div><dt>Ended-event grace</dt><dd>' + report.settings.expiredHours + ' hours</dd></div>' + (report.organization ? '<div><dt>Prepared for</dt><dd>' + escape(report.organization) + '</dd></div>' : '') + '</dl></article></div>' +
      '<p class="scope-note">Operational review, not full schema certification. Geometry checks establish structure and coordinate ranges; they do not establish whether an event is on the correct road. FeedCheck does not modify the source feed.</p>';
    $('review-findings')?.addEventListener('click', () => switchView('findings'));
  }
  function renderFindings() {
    if (!report) return;
    const search = $('search').value.trim().toLowerCase();
    const severity = $('severity').value;
    const filtered = report.issues.filter(i => (allForPrint || severity === 'all' || i.severity === severity) && (allForPrint || !search || [i.recordId, i.code, i.path, i.message, i.action].some(v => v.toLowerCase().includes(search))));
    const shown = allForPrint ? filtered : filtered.slice(0, visibleLimit);
    $('findings-list').innerHTML = filtered.length ? '<p class="field-help">Showing ' + shown.length + ' of ' + filtered.length + ' matching findings' + (allForPrint ? '' : ' · Exports always include all findings') + '</p>' + shown.map(i =>
      '<article class="finding"><span class="severity ' + i.severity + '">' + i.severity + '</span><div><h3>' + escape(i.message) + '</h3><div class="finding-meta"><span>' + (i.index === null ? 'Feed-level finding' : 'Record ' + (i.index + 1) + ' / ID: ' + escape(i.recordId)) + '</span><code>' + escape(i.code) + '</code></div><code class="path">' + escape(i.path) + '</code><p><strong>Next step</strong> · ' + escape(i.action) + '</p></div></article>'
    ).join('') : '<p class="empty">' + (report.issues.length ? 'No findings match these filters.' : report.summary.records ? 'No findings from this edition’s checks. See the scope notes before sharing a conclusion.' : 'No event records to review. See the empty-feed finding.') + '</p>';
    $('more-findings').hidden = allForPrint || shown.length >= filtered.length;
  }
  function renderComparison() {
    if (!report || !baseline) { $('comparison-results').innerHTML = '<p class="empty">' + (!report ? 'Run a current assessment, then choose a baseline snapshot.' : 'Choose a baseline snapshot to compare with this assessment.') + '</p>'; return; }
    try {
      const c = FeedCheck.compare(report, baseline);
      const ids = (list, label) => '<p class="change-list"><strong>' + label + ':</strong> ' + (list.length ? escape(list.slice(0, 100).join(', ')) + (list.length > 100 ? ' … (' + list.length + ' total)' : '') : 'None') + '</p>';
      const thresholdsDiffer = JSON.stringify(report.settings) !== JSON.stringify(baseline.settings);
      $('comparison-results').innerHTML = '<p class="field-help">Compared with ' + escape(new Date(c.previousAt).toLocaleString()) + ' · ' + escape(baseline.source) + '</p>' +
        '<div class="metrics">' + metric('Added IDs', c.added.length, 'Not present in baseline') + metric('Removed IDs', c.removed.length, 'Confirm expected lifecycle activity') + metric('Changed records', c.changed.length, 'Same ID, different content') + metric('Unchanged', c.unchanged, 'Same ID and content fingerprint') + '</div>' + ids(c.added, 'Added') + ids(c.removed, 'Removed') + ids(c.changed, 'Changed') + (thresholdsDiffer ? '<p class="scope-note">Review thresholds differ between assessments. The ID and content comparison is still available; do not compare finding totals as equivalent tests.</p>' : '');
    } catch (error) { $('comparison-results').innerHTML = '<p class="empty">' + escape(error.message) + '</p>'; }
  }
  function display(nextReport, isDemo) {
    report = nextReport; demo = isDemo; visibleLimit = 100;
    $('search').value = ''; $('severity').value = 'all';
    $('report-toolbar').hidden = false;
    $('overview-report').hidden = false;
    $('welcome').hidden = true;
    $('save-snapshot').disabled = false;
    $('report-label').textContent = report.source;
    $('report-date').textContent = (report.organization ? report.organization + ' · ' : '') + 'Assessed ' + new Date(report.assessedAt).toLocaleString();
    $('nav-count').textContent = report.issues.length;
    $('page-title').textContent = 'The evidence, at a glance.';
    renderOverview(); renderFindings(); renderComparison(); switchView('overview');
  }
  async function readLimited(response) {
    if (!response.ok) throw new Error('The feed returned HTTP ' + response.status + '. Check the URL and publisher status.');
    if (Number(response.headers.get('Content-Length')) > FeedCheck.MAX_BYTES) throw new Error('The feed exceeds the 20 MB limit.');
    if (!response.body) throw new Error('The response contained no readable data.');
    const reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > FeedCheck.MAX_BYTES) { await reader.cancel(); throw new Error('The feed exceeds the 20 MB limit.'); }
      chunks.push(value);
    }
    const buffer = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
    return new TextDecoder().decode(buffer);
  }
  $('run').addEventListener('click', async () => {
    if (sampleOnly) { message('This is the sample demo. The Local Edition opens your own feeds.', true); return; }
    if (running) return;
    running = true; $('run').disabled = true; $('sample').disabled = true; $('sample-welcome').disabled = true;
    $('run').textContent = 'Checking…'; message('Reading the feed. Previous results remain visible until this assessment succeeds.');
    try {
      let raw, source;
      if (mode === 'file') {
        if (!selectedFile) throw new Error('Choose a JSON file first, or use the Paste JSON tab.');
        raw = await selectedFile.text(); source = selectedFile.name;
      } else if (mode === 'paste') { raw = $('json-input').value; source = 'Pasted feed'; }
      else {
        let url;
        try { url = new URL($('feed-url').value); } catch (_) { throw new Error('Enter a complete public feed URL, starting with https://.'); }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use a public HTTP(S) URL without credentials, query parameters, or a fragment. For feeds requiring keys, download the JSON and use the file tab.');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try { raw = await readLimited(await fetch(url.href, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' })); }
        catch (error) {
          if (error.name === 'AbortError') throw new Error('The feed took longer than 20 seconds. Download its JSON and use the file tab.');
          if (error instanceof TypeError) throw new Error('The browser could not read this URL. The publisher may block cross-origin requests (CORS), be unavailable, or require authentication. Download the JSON from the source and use the file tab.');
          throw error;
        } finally { clearTimeout(timeout); }
        source = url.href;
      }
      // Let the loading state paint before processing a large file.
      await new Promise(resolve => setTimeout(resolve, 20));
      display(FeedCheck.analyze(FeedCheck.parse(raw), { ...settings(), source: $('feed-label').value.trim() || source }), false);
      message('Assessment complete. Your source data was not modified. Exports include all findings, regardless of the active filter.');
    } catch (error) { message(error.message + (report ? ' The previous assessment is still shown below.' : ''), true); }
    finally {
      running = false; $('run').disabled = false; $('sample').disabled = false; $('sample-welcome').disabled = false;
      $('run').innerHTML = 'Run assessment <span aria-hidden="true">→</span>';
    }
  });
  function loadSample() {
    if (running) return;
    try {
      display(FeedCheck.analyze(FeedCheck.sample(), { ...settings(), source: 'Sample / illustrative road events' }), true);
      message('Sample loaded: six synthetic events with intentional issues. ' + (sampleOnly ? 'The Local Edition lets you assess your own feeds.' : 'Load your own feed above to run a real assessment.'));
    } catch (error) { message(error.message, true); }
  }
  $('sample').addEventListener('click', loadSample);
  $('sample-welcome').addEventListener('click', loadSample);
  $('search').addEventListener('input', () => { visibleLimit = 100; renderFindings(); });
  $('severity').addEventListener('change', () => { visibleLimit = 100; renderFindings(); });
  $('more-findings').addEventListener('click', () => { visibleLimit += 100; renderFindings(); });
  function download(content, type, suffix) {
    if (!report) return;
    const blob = new Blob([content], { type });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href; link.download = 'purposebuilt-feedcheck-' + report.assessedAt.slice(0, 10) + '-' + suffix;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  $('export-csv').addEventListener('click', () => download(FeedCheck.csv(report), 'text/csv;charset=utf-8', 'findings.csv'));
  $('export-json').addEventListener('click', () => {
    const { entries, ...publicReport } = report;
    download(JSON.stringify({ ...publicReport, sampleData: demo }, null, 2), 'application/json', 'report.json');
  });
  $('save-snapshot').addEventListener('click', () => download(JSON.stringify(FeedCheck.snapshot(report), null, 2), 'application/json', 'snapshot.json'));
  $('baseline-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > FeedCheck.MAX_BYTES) throw new Error('Baseline exceeds the 20 MB limit.');
      baseline = FeedCheck.validateSnapshot(FeedCheck.parse(await file.text()));
      $('baseline-name').textContent = file.name;
      renderComparison(); message('Baseline loaded. Comparison requires the same feed label and unique IDs in both assessments.');
    } catch (error) { message(error.message + (baseline ? ' The previous baseline remains selected.' : ''), true); }
    finally { event.target.value = ''; }
  });
  $('print').addEventListener('click', () => window.print());
  window.addEventListener('beforeprint', () => { allForPrint = true; renderFindings(); });
  window.addEventListener('afterprint', () => { allForPrint = false; renderFindings(); });
  renderComparison();
  if (sampleOnly) loadSample();
})();
