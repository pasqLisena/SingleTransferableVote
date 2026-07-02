import STVote from './STVote.js';

const TOKEN_FORMAT_REGEX = /^[A-Za-z0-9_-]{43}$/;

function selectValidVotesFromVotes(votes, options = {}) {
    const {
        tokenSet = null,
        verbalize = () => {},
        receivedVotesVerbose = true,
    } = options;

    const sortedVotes = [...votes].sort((a, b) => a.timestamp - b.timestamp);

    if (tokenSet) {
        verbalize(`Aventi diritto al voto (token generati): ${tokenSet.size}`);
    } else {
        verbalize('Nessun file token specificato. I token validi sono tutti quelli che rispettano il formato');
    }

    verbalize(`Voti ricevuti: ${sortedVotes.length}`, receivedVotesVerbose);

    let validVotes;
    let invalidVotes;

    if (tokenSet) {
        validVotes = sortedVotes.filter((vote) => tokenSet.has(vote.token));
        invalidVotes = sortedVotes.filter((vote) => !tokenSet.has(vote.token));
        verbalize(`Voti validi (corrispondenza con token): ${validVotes.length}`);
    } else {
        validVotes = sortedVotes.filter((vote) => TOKEN_FORMAT_REGEX.test(vote.token));
        invalidVotes = sortedVotes.filter((vote) => !TOKEN_FORMAT_REGEX.test(vote.token));
        verbalize(`Voti validi (rispettano il formato token): ${validVotes.length}`);
    }

    if (invalidVotes.length > 0) {
        verbalize(`Token non corrispondenti: ${invalidVotes.map((vote) => vote.token).join(', ')}`, true);
    }

    const uniqueVotesByToken = new Map();
    const duplicateTokens = [];

    for (const vote of validVotes) {
        if (uniqueVotesByToken.has(vote.token)) {
            duplicateTokens.push(vote.token);
        }

        uniqueVotesByToken.set(vote.token, vote);
    }

    const uniqueVotes = Array.from(uniqueVotesByToken.values());
    verbalize(`Voti validi univoci (solo l'ultimo voto espresso verrà considerato): ${uniqueVotes.length}`);

    if (duplicateTokens.length > 0) {
        verbalize(`Token duplicati (voti multipli per token): ${duplicateTokens.join(', ')}`, true);
    }

    return uniqueVotes;
}

function countVotesFPTP(votes, question, verbalize) {
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

function processVotesSTV(votes, question, numSeats, verbalize) {
    verbalize(`Posti da assegnare : ${numSeats}`);

    const totalVotes = votes.length;
    const quota = totalVotes / (numSeats + 1);
    verbalize(`Quota da raggiungere : ${quota}`);

    const candidates = {};
    votes[0].questions[question].getCandidates().forEach((candidate) => {
        candidates[candidate] = [];
    });

    verbalize(`Candidati iniziali : ${Object.keys(candidates).join(', ')}`);

    let electedCandidates = [];
    const preferences = votes.map((vote) => vote.questions[question]);

    for (let round = 1; round <= numSeats; round += 1) {
        verbalize(`\n--- Round ${round} ---`);

        Object.keys(candidates).forEach((candidate) => {
            candidates[candidate] = [];
        });

        const roundCounts = {};
        for (const candidate of Object.keys(candidates)) {
            roundCounts[candidate] = 0;
        }

        for (const preference of preferences) {
            const [, choice] = preference.get();
            if (!choice || !Object.prototype.hasOwnProperty.call(candidates, choice)) {
                continue;
            }
            candidates[choice].push(preference);
        }

        for (const [candidate, candidatePreferences] of Object.entries(candidates)) {
            const totalWeight = candidatePreferences.reduce((sum, pref) => sum + pref.weight, 0);
            roundCounts[candidate] = totalWeight;
            verbalize(`Candidato: ${candidate}, Voti: ${(Math.round(totalWeight * 100) / 100).toFixed(2)}`);
        }

        const currentElectedCandidates = Object.entries(roundCounts)
            .filter(([, count]) => count >= quota)
            .map(([candidate]) => candidate);

        electedCandidates = electedCandidates.concat(currentElectedCandidates);

        if (currentElectedCandidates.length > 0) {
            verbalize('Candidati eletti in questo round:');

            for (const elected of currentElectedCandidates) {
                const overflow = roundCounts[elected] - quota;
                verbalize(`- ${elected} con ${roundCounts[elected]} voti (+${(Math.round(overflow * 100) / 100).toFixed(2)} sulla quota)`, true);

                candidates[elected].forEach((preference) => {
                    preference.redistribute(overflow / Math.max(candidates[elected].length, 1), electedCandidates);
                });

                verbalize(
                    `Ridstribuiti ${candidates[elected].length} voti di ${elected} con peso totale ${candidates[elected].reduce((sum, pref) => sum + pref.weight, 0)}`,
                    true
                );

                delete candidates[elected];
            }
        } else {
            verbalize('Nessun candidato ha raggiunto la quota in questo round.');

            const minVotes = Math.min(...Object.values(roundCounts));
            const candidatesWithMinVotes = Object.entries(roundCounts)
                .filter(([, count]) => count === minVotes)
                .map(([candidate]) => candidate);

            const eliminatedCandidate = candidatesWithMinVotes[Math.floor(Math.random() * candidatesWithMinVotes.length)];
            verbalize(`Candidato eliminato: ${eliminatedCandidate} con ${roundCounts[eliminatedCandidate]} voti`, true);

            candidates[eliminatedCandidate].forEach((preference) => {
                preference.redistribute(1, electedCandidates);
            });

            delete candidates[eliminatedCandidate];
        }

        if (electedCandidates.length >= numSeats) {
            verbalize(`Tutti i posti sono stati assegnati. Candidati eletti: ${electedCandidates.join(', ')}`);
            break;
        }
    }
}

function processVotes(votes, options = {}) {
    if (!votes.length) {
        return [];
    }

    const {
        seatsByQuestion = {},
        verbalize = () => {},
        guessSeatCount = (question) => (question.toLowerCase().includes('consiglier') ? 3 : 1),
    } = options;

    const questions = Object.keys(votes[0].questions);

    for (const question of questions) {
        if (votes[0].questions[question] instanceof STVote) {
            verbalize(`\n\n** Elaborazione del voto per la domanda STV: ${question} **`);
            const numSeats = seatsByQuestion[question] || guessSeatCount(question);
            processVotesSTV(votes, question, numSeats, verbalize);
        } else {
            verbalize(`\n\n** Elaborazione del voto per la domanda a maggioranza: ${question} **`);
            countVotesFPTP(votes, question, verbalize);
        }
    }

    return votes;
}

export {
    selectValidVotesFromVotes,
    processVotes,
};
