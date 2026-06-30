import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';
import Vote from './Vote.js';
import { timestampToDate } from './utils.js';

const VERBALIZATION = []
const TOKEN_FORMAT_REGEX = /^[A-Za-z0-9_-]{43}$/;

function verbalize(message, verbose = false) {
    console.log(message);
    VERBALIZATION.push(message, verbose);
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
    let votes = importVotes(votefile)
    // Sort by timestamp 
    votes = votes.sort((a, b) => {
        return a.timestamp - b.timestamp;
    });
    let validTokens = null;
    if (tokenfile === null) {
        verbalize('Nessun file token specificato. I token validi sono tutti quelli che rispettano il formato');
    } else {
        validTokens = importTokens(tokenfile);
        verbalize(`Aventi diritto al voto (token generati): ${validTokens.size}`);
    }

    verbalize(`Voti ricevuti: ${votes.length}`, true);
    verbalize(
        `Primo voto ricevuto il: ${votes[0] ? timestampToDate(votes[0].timestamp).toISOString() : 'timestamp non disponibile'}`
    );
    verbalize(`Ultimo voto ricevuto il: ${votes[votes.length - 1] ? timestampToDate(votes[votes.length - 1].timestamp).toISOString()
        : 'timestamp non disponibile'}`, true);
    // TODO check that the voting time is in the range of the election time window, if such information is available in the vote data
    
    let valid_votes, invalid_votes;
    if (tokenfile === null) {
        valid_votes = votes.filter((vote) => TOKEN_FORMAT_REGEX.test(vote.token));
        invalid_votes = votes.filter((vote) => !TOKEN_FORMAT_REGEX.test(vote.token));   
        verbalize(`Voti validi (rispettano il formato token): ${valid_votes.length}`);
    } else {
        // Filter votes to only include those with tokens present in the token file
        valid_votes = votes
            .filter((vote) => validTokens.has(vote.token));
        invalid_votes = votes
            .filter((vote) => !validTokens.has(vote.token));
            verbalize(`Voti validi (corrispondenza con token): ${valid_votes.length}`);
    }
    
    if (invalid_votes.length > 0) {
        verbalize(`Token non corrispondenti: ${invalid_votes.map((v) => v.token).join(', ')}`, true);
    }

    // Remove duplicate votes based on token, keeping only the last occurrence
    let unique_votes = {};
    let duplicate_tokens = [];
    for (const vote of valid_votes) {
        if (unique_votes[vote.token]) {
            duplicate_tokens.push(vote.token);
        }
        unique_votes[vote.token] = vote;
    }
    unique_votes = Object.values(unique_votes);
    verbalize(`Voti validi univoci (solo l'ultimo voto espresso verrà considerato): ${unique_votes.length}`);
    if (duplicate_tokens.length > 0) {
        verbalize(`Token duplicati (voti multipli per token): ${duplicate_tokens.join(', ')}`, true);
    }   

    return unique_votes;
}

function countVotesFPTP(votes, question) {
    const voteCounts = {};
    for (const vote of votes) {
        const answer = vote.questions[question];
        if (typeof answer === 'string' && answer) {
            voteCounts[answer] = (voteCounts[answer] || 0) + 1;
        }
    }

    verbalize(`Conteggio dei voti per la domanda "${question}":`);
    for (const [answer, count] of Object.entries(voteCounts)) {
        verbalize(`- ${answer}: ${count} vot${count === 1 ? 'o' : 'i'}`);
    }
}

function processVotes(votes) {
    if (!votes.length) {
        return [];
    }

    // Process the votes to return the verdict
    const questions = Object.keys(votes[0].questions);

    for (const q of questions) {
        if (Array.isArray(votes[0].questions[q])) {
          // Single Transferable Vote (STV) question
         verbalize(`Elaborazione del voto per la domanda STV: ${q}`);
         // TODO: Implement STV vote processing logic here
        } else {
          // First-Past-The-Post (FPTP) question
         verbalize(`Elaborazione del voto per la domanda a maggioranza: ${q}`);
         countVotesFPTP(votes, q);
        }

    } 
    return votes;
}

export { importVotes, selectValidVotes, importTokens, processVotes };