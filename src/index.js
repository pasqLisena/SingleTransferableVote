import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';
import Vote from './Vote.js';
import STVote from './STVote.js';
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

function processVotesSTV(votes, question, num_seats = 1) {
    verbalize(`Posti da assegnare : ${num_seats}`);

    // compute quota for STV election
    const totalVotes = votes.length;
    const quota = (totalVotes / (num_seats + 1)); // Droop quota for single-winner STV
    verbalize(`Quota da raggiungere : ${quota}`);
    // init candidates 
    let candidates = {};
    votes[0].questions[question].getCandidates().forEach((candidate) => {
        candidates[candidate] = [];
    });
    verbalize(`Candidati iniziali : ${Object.keys(candidates).join(', ')}`);
    
    let electedCandidates = [];
    let preferences = votes.map((vote) => vote.questions[question]);
    for (let round = 1; round <= num_seats; round++) {
        verbalize(`\n--- Round ${round} ---`);
        //reset candidate votes for this round
        Object.keys(candidates).forEach((candidate) => {
            candidates[candidate] = [];
        });

        let roundCounts = {};
        for (const candidate of Object.keys(candidates)) {
            roundCounts[candidate] = 0;
        }

        console.log(`Length of preferences: ${preferences.length}`);
        console.log(`Sum of weights: ${preferences.map(c => c.weight).reduce((sum, w) => sum + w, 0)}`);
        // Assign vote to the candidates
        for (const preference of preferences) {
            const [weight, choice] = preference.get();
            // console.log(`Voto con peso ${weight} per la scelta: ${choice}`);
            candidates[choice].push(preference);
        }

        // check votes
        for (const [candidate, candidatePreferences] of Object.entries(candidates)) {
            const totalWeight = candidatePreferences.reduce((sum, pref) => sum + pref.weight, 0);
            roundCounts[candidate] = totalWeight;
            verbalize(`Candidato: ${candidate}, Voti: ${(Math.round(totalWeight * 100) / 100).toFixed(2)}`);
        }

        // Check if any candidate has reached the quota
        let currentElectedCandidates = Object.entries(roundCounts)
            .filter(([_, count]) => count >= quota)
            .map(([candidate, _]) => candidate);

        electedCandidates = electedCandidates.concat(currentElectedCandidates);

        if (currentElectedCandidates.length > 0) {
            verbalize(`Candidati eletti in questo round:`);
            // Remove elected candidates from the pool for the next round
            for (const elected of currentElectedCandidates) {
                let overflow = roundCounts[elected] - quota;
                verbalize(`- ${elected} con ${roundCounts[elected]} voti (+${(Math.round(overflow * 100) / 100).toFixed(2)} sulla quota)`, true);
                
                // Redistribute the overflow votes to the next preferences
                let redistributed = candidates[elected].forEach((preference) => {preference.redistribute(overflow/candidates[elected].length, electedCandidates)});
                verbalize(`Ridstribuiti ${candidates[elected].length} voti di ${elected} con peso totale ${candidates[elected].reduce((sum, pref) => sum + pref.weight, 0)}`, true);

                delete candidates[elected];
            }
        } else {
            verbalize('Nessun candidato ha raggiunto la quota in questo round.');
            // Eliminate the candidate with the fewest votes
            let minVotes = Math.min(...Object.values(roundCounts));
            let candidatesWithMinVotes = Object.entries(roundCounts)
                .filter(([_, count]) => count === minVotes)
                .map(([candidate, _]) => candidate);

            // If there's a tie for the fewest votes, eliminate one randomly
            // TODO fix this randomly
            let eliminatedCandidate = candidatesWithMinVotes[Math.floor(Math.random() * candidatesWithMinVotes.length)];
            verbalize(`Candidato eliminato: ${eliminatedCandidate} con ${roundCounts[eliminatedCandidate]} voti`, true);
            
            // Redistribute the votes of the eliminated candidate
            candidates[eliminatedCandidate].forEach((preference) => {preference.redistribute(1, electedCandidates)});

            delete candidates[eliminatedCandidate];
        }
        if (electedCandidates.length >= num_seats) {
            verbalize(`Tutti i posti sono stati assegnati. Candidati eletti: ${electedCandidates.join(', ')}`);
            break;
        }

    }
}

function processVotes(votes) {
    if (!votes.length) {
        return [];
    }

    // Process the votes to return the verdict
    const questions = Object.keys(votes[0].questions);

    for (const q of questions) {
        if (votes[0].questions[q] instanceof STVote) {
            // Single Transferable Vote (STV) question
            verbalize(`\n\n** Elaborazione del voto per la domanda STV: ${q} **`);
            // TODO num_seats should be determined from the config
            let num_seats = q.toLowerCase().includes('consiglier') ? 3 : 1;
            processVotesSTV(votes, q, num_seats);
        } else {
            // First-Past-The-Post (FPTP) question
            verbalize(`\n\n** Elaborazione del voto per la domanda a maggioranza: ${q} **`);
            countVotesFPTP(votes, q);
        }

    }
    return votes;
}

export { importVotes, selectValidVotes, importTokens, processVotes };