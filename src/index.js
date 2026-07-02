import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';
import Vote from './Vote.js';
import { timestampToDate } from './utils.js';
import { selectValidVotesFromVotes, processVotes as processVotesShared } from './processing.js';

const VERBALIZATION = [];
function verbalize(message, verbose = false) {
    console.log(message);
    VERBALIZATION.push({ message, verbose });
}

function clearVerbalization() {
    VERBALIZATION.length = 0;
}

function getVerbalization(includeVerbose = true) {
    return VERBALIZATION.filter((entry) => includeVerbose || !entry.verbose).map((entry) => entry.message);
}

function formatVerbalizationOutput(includeVerbose = true) {
    return getVerbalization(includeVerbose)
    .map((message) => message)
        .join('\n');
}

function importVotes(votefile) {
    const extension = path.extname(votefile).toLowerCase();

    if (extension !== '.csv' && extension !== '.xlsx') {
        throw new Error('Unsupported file format');
    }

    const workbook =
        extension === '.csv'
            ? xlsx.read(fs.readFileSync(votefile, 'utf8'), { type: 'string' })
            : xlsx.readFile(votefile);
    const [firstSheetName] = workbook.SheetNames;

    if (!firstSheetName) {
        return [];
    }

    const data = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
        defval: '',
    });

    const votes = Vote.fromRows(data);
    return votes;
}

function importTokens(tokenfile) {
    return new Set(
        fs
            .readFileSync(tokenfile, 'utf8')
            .split(/\r?\n/)
            .map((token) => token.trim())
            .filter(Boolean)
    );
}

function selectValidVotes(votefile, tokenfile = null) {
    const votes = importVotes(votefile);
    const sortedVotes = [...votes].sort((a, b) => a.timestamp - b.timestamp);

    verbalize(
        `Primo voto ricevuto il: ${sortedVotes[0] ? timestampToDate(sortedVotes[0].timestamp).toISOString() : 'timestamp non disponibile'}`
    );
    verbalize(`Ultimo voto ricevuto il: ${sortedVotes[sortedVotes.length - 1] ? timestampToDate(sortedVotes[sortedVotes.length - 1].timestamp).toISOString()
        : 'timestamp non disponibile'}`, true);
    const validTokens = tokenfile === null ? null : importTokens(tokenfile);
    return selectValidVotesFromVotes(votes, {
        tokenSet: validTokens,
        verbalize,
        receivedVotesVerbose: false,
    });
}

function processVotes(votes, seatsByQuestion = {}) {
    return processVotesShared(votes, {
        seatsByQuestion,
        verbalize,
    });
}

export {
    importVotes,
    selectValidVotes,
    importTokens,
    processVotes,
    clearVerbalization,
    getVerbalization,
    formatVerbalizationOutput,
};