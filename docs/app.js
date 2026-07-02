import * as xlsx from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';
import { selectValidVotesFromVotes, processVotes as processVotesShared } from '../src/processing.js';
import { guessSeatCount, proposeConfig, parseVotes } from '../src/webAppHelpers.js';

const state = {
  rows: [],
  config: null,
  tokenSet: null,
  verbalization: [],
};

const elements = {
  votesFile: document.querySelector('#votesFile'),
  tokensFile: document.querySelector('#tokensFile'),
  inputSummary: document.querySelector('#inputSummary'),
  configEditor: document.querySelector('#configEditor'),
  processButton: document.querySelector('#processButton'),
  hideVerbose: document.querySelector('#hideVerbose'),
  output: document.querySelector('#output'),
};

function verbalize(message, verbose = false) {
  state.verbalization.push({ message, verbose });
}

function resetVerbalization() {
  state.verbalization = [];
}

function formatVerbalizationOutput(includeVerbose = true) {
  return state.verbalization
    .filter((entry) => includeVerbose || !entry.verbose)
    .map((entry) => entry.message)
    .join('\n');
}

function renderOutput() {
  const includeVerbose = !elements.hideVerbose.checked;
  const text = formatVerbalizationOutput(includeVerbose);
  elements.output.textContent = text || 'No messages';
}

function renderConfigEditor() {
  if (!state.config) {
    elements.configEditor.className = 'config-editor empty';
    elements.configEditor.textContent = 'Upload a votes file to generate config.';
    elements.processButton.disabled = true;
    return;
  }

  const wrapper = document.createElement('div');
  const meta = document.createElement('p');
  meta.className = 'hint';
  meta.textContent = `Token column: ${state.config.token} | Timestamp column: ${state.config.timestamp}`;
  wrapper.append(meta);

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Question</th>
        <th>Type</th>
        <th>Seats</th>
        <th>Columns used</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  state.config.questions.forEach((question) => {
    const tr = document.createElement('tr');

    const questionCell = document.createElement('td');
    questionCell.textContent = question.text;

    const typeCell = document.createElement('td');
    const typeSelect = document.createElement('select');
    typeSelect.innerHTML = `
      <option value="FPTP">FPTP</option>
      <option value="STV">STV</option>
    `;
    typeSelect.value = question.type;
    typeSelect.addEventListener('change', () => {
      question.type = typeSelect.value;
      seatsInput.disabled = question.type !== 'STV';
    });
    typeCell.append(typeSelect);

    const seatsCell = document.createElement('td');
    const seatsInput = document.createElement('input');
    seatsInput.type = 'number';
    seatsInput.min = '1';
    seatsInput.value = String(question.seats || 1);
    seatsInput.disabled = question.type !== 'STV';
    seatsInput.addEventListener('input', () => {
      const parsed = Number.parseInt(seatsInput.value, 10);
      question.seats = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
    });
    seatsCell.append(seatsInput);

    const columnsCell = document.createElement('td');
    columnsCell.className = 'code';
    columnsCell.textContent = question.columns.map((entry) => entry.key).join(' | ');

    tr.append(questionCell, typeCell, seatsCell, columnsCell);
    tbody.append(tr);
  });

  wrapper.append(table);

  elements.configEditor.className = 'config-editor';
  elements.configEditor.innerHTML = '';
  elements.configEditor.append(wrapper);
  elements.processButton.disabled = !state.rows.length;
}

async function parseVotesFile(file) {
  const extension = `.${file.name.split('.').pop().toLowerCase()}`;
  let workbook;

  if (extension === '.csv') {
    const text = await file.text();
    workbook = xlsx.read(text, { type: 'string' });
  } else if (extension === '.xlsx') {
    const buffer = await file.arrayBuffer();
    workbook = xlsx.read(buffer, { type: 'array' });
  } else {
    throw new Error('Unsupported vote file format. Use .csv or .xlsx');
  }

  const [firstSheetName] = workbook.SheetNames;
  if (!firstSheetName) {
    return [];
  }

  return xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '' });
}

async function parseTokenFile(file) {
  if (!file) {
    return null;
  }

  const text = await file.text();
  const tokens = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return new Set(tokens);
}

function setSummary(message, isError = false) {
  elements.inputSummary.textContent = message;
  elements.inputSummary.className = isError ? 'hint error' : 'hint';
}

async function onVotesFileChange() {
  const file = elements.votesFile.files[0];
  if (!file) {
    state.rows = [];
    state.config = null;
    renderConfigEditor();
    return;
  }

  try {
    const rows = await parseVotesFile(file);
    if (!rows.length) {
      throw new Error('The votes file does not contain rows.');
    }

    state.rows = rows;
    state.config = proposeConfig(rows);

    setSummary(`Loaded ${rows.length} vote rows from ${file.name}.`);
    renderConfigEditor();
  } catch (error) {
    state.rows = [];
    state.config = null;
    renderConfigEditor();
    setSummary(error.message, true);
  }
}

async function onProcess() {
  if (!state.rows.length || !state.config) {
    return;
  }

  try {
    resetVerbalization();

    const tokenFile = elements.tokensFile.files[0] || null;
    state.tokenSet = await parseTokenFile(tokenFile);

    const votes = parseVotes(state.rows, state.config);
    const validVotes = selectValidVotesFromVotes(votes, {
      tokenSet: state.tokenSet,
      verbalize,
      receivedVotesVerbose: true,
    });

    const seatsByQuestion = Object.fromEntries(
      state.config.questions
        .filter((question) => question.type === 'STV')
        .map((question) => [question.text, question.seats || 1])
    );

    processVotesShared(validVotes, {
      seatsByQuestion,
      verbalize,
      guessSeatCount,
    });
    renderOutput();
  } catch (error) {
    elements.output.textContent = `Error: ${error.message}`;
  }
}

function init() {
  elements.votesFile.addEventListener('change', onVotesFileChange);
  elements.processButton.addEventListener('click', onProcess);
  elements.hideVerbose.addEventListener('change', renderOutput);
}

init();
