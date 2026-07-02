import Vote from './Vote.js';
import STVote from './STVote.js';

const STV_COLUMN_REGEX = /^(.*)\s\[([^\]]+)\]$/;
const ITALIAN_RANK_ORDER = new Map([
    ['prima scelta', 1],
    ['seconda scelta', 2],
    ['terza scelta', 3],
    ['quarta scelta', 4],
    ['quinta scelta', 5],
]);

function parsePreferenceRank(answer) {
    if (!answer) {
        return null;
    }

    const normalizedAnswer = String(answer).trim().toLowerCase();
    if (!normalizedAnswer) {
        return null;
    }

    if (ITALIAN_RANK_ORDER.has(normalizedAnswer)) {
        return ITALIAN_RANK_ORDER.get(normalizedAnswer);
    }

    const numericRank = Number.parseInt(normalizedAnswer, 10);
    return Number.isNaN(numericRank) ? null : numericRank;
}

function parseQuestionColumn(columnName) {
    const match = columnName.match(STV_COLUMN_REGEX);
    if (!match) {
        return {
            text: columnName,
            option: null,
            isBracketStyle: false,
        };
    }

    return {
        text: match[1],
        option: match[2],
        isBracketStyle: true,
    };
}

function guessSeatCount(text) {
    return text.toLowerCase().includes('consiglier') ? 3 : 1;
}

function proposeConfig(rows) {
    if (!rows.length) {
        return null;
    }

    const headers = Object.keys(rows[0]);
    const token = headers.find((key) => key.toLowerCase().includes('token')) || 'Token';
    const timestamp = headers.find((key) => key.toLowerCase().includes('timestamp')) || 'timestamp';

    const questionHeaders = headers.filter((key) => key !== token && key !== timestamp);
    const grouped = new Map();

    for (const header of questionHeaders) {
        const parsed = parseQuestionColumn(header);
        if (!grouped.has(parsed.text)) {
            grouped.set(parsed.text, []);
        }

        grouped.get(parsed.text).push({
            key: header,
            option: parsed.option || header,
            fromBracket: parsed.isBracketStyle,
        });
    }

    const questions = Array.from(grouped.entries()).map(([text, columns], index) => {
        const isLikelyStv = columns.some((entry) => entry.fromBracket) && columns.length > 1;
        return {
            id: `q${index + 1}`,
            text,
            type: isLikelyStv ? 'STV' : 'FPTP',
            seats: guessSeatCount(text),
            columns,
        };
    });

    return { token, timestamp, questions };
}

function parseVotes(rows, config) {
    return rows.map((row) => {
        const token = String(row[config.token] || '').trim();
        const timestamp = row[config.timestamp] || '';
        const vote = new Vote(token, timestamp);

        for (const question of config.questions) {
            if (question.type === 'DISABLED') {
                continue;
            }

            if (question.type === 'FPTP') {
                const firstAnswer = question.columns
                    .map((column) => String(row[column.key] || '').trim())
                    .find(Boolean) || '';
                vote.addQuestionAnswer(question.text, firstAnswer);
                continue;
            }

            const rankedOptions = question.columns
                .map((column) => ({
                    option: column.option,
                    rank: parsePreferenceRank(row[column.key]),
                }))
                .filter((entry) => entry.rank !== null)
                .sort((a, b) => a.rank - b.rank)
                .map((entry) => entry.option);

            vote.addQuestionAnswer(question.text, STVote.fromPreferences(rankedOptions));
        }

        return vote;
    });
}

export {
    guessSeatCount,
    proposeConfig,
    parseVotes,
};
