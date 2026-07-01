import STVote from './STVote.js';

const DEFAULT = {
    TOKEN: 'Token',
    TIMESTAMP: 'timestamp',
};

const STV_QUESTION_REGEX = /^(.*)\s\[([^\]]+)\]$/;
const ITALIAN_RANK_ORDER = new Map([
    ['prima scelta', 1],
    ['seconda scelta', 2],
    ['terza scelta', 3],
    ['quarta scelta', 4],
    ['quinta scelta', 5],
]);

export default class Vote {
    constructor(token, timestamp) {
        this.token = token;
        this.timestamp = timestamp;
        this.questions = {};
    }

    addQuestionAnswer(question, answer) {
        this.questions[question] = answer;
    }

    static fromRows(rows, config = null) {
        if (!rows.length) {
            return [];
        }

        const resolvedConfig = completeConfig(config, Object.keys(rows[0]));
        return rows.map((row) => Vote.fromRow(row, resolvedConfig));
    }

    static fromRow(row, config) {
        if (!config) {
            throw new Error('Configuration is required to parse a row into a Vote object');
        }

        const token = String(row[config.token] || '').trim();
        const timestamp = row[config.timestamp] || '';
        const vote = new Vote(token, timestamp);
        const stvGroups = new Map();

        for (const question of config.qlist) {
            const parsedQuestion = parseQuestion(question);
            const answer = String(row[question] || '').trim();
            
            if (parsedQuestion.type === 'FPTP') {
                vote.addQuestionAnswer(parsedQuestion.text, answer);
                continue;
            }

            if (!stvGroups.has(parsedQuestion.text)) {
                stvGroups.set(parsedQuestion.text, []);
            }

            stvGroups.get(parsedQuestion.text).push({
                option: parsedQuestion.option,
                rank: parsePreferenceRank(answer),
            });
        }

        for (const [questionText, rankedOptions] of stvGroups.entries()) {
            const orderedPreferences = rankedOptions
                .filter((entry) => entry.rank !== null)
                .sort((left, right) => left.rank - right.rank)
                .map((entry) => entry.option);

            vote.addQuestionAnswer(questionText, STVote.fromPreferences(orderedPreferences));
        }

        return vote;
    }
}


function parseQuestion(question) {
    const stvMatch = question.match(STV_QUESTION_REGEX);

    if (!stvMatch) {
        return {
            text: question,
            option: null,
            type: 'FPTP',
        };
    }

    return {
        text: stvMatch[1],
        option: stvMatch[2],
        type: 'STV',
    };
}

function parsePreferenceRank(answer) {
    if (!answer) {
        return null;
    }

    const normalizedAnswer = answer.toLowerCase();
    if (ITALIAN_RANK_ORDER.has(normalizedAnswer)) {
        return ITALIAN_RANK_ORDER.get(normalizedAnswer);
    }

    const numericRank = Number.parseInt(normalizedAnswer, 10);
    return Number.isNaN(numericRank) ? null : numericRank;
}

function completeConfig(config, keys) {
    const resolvedConfig = config ? { ...config } : {};

    if (!resolvedConfig.token) {
        resolvedConfig.token =
            keys.find((key) => key.toLowerCase().includes('token')) || DEFAULT.TOKEN;
    }

    if (!resolvedConfig.timestamp) {
        resolvedConfig.timestamp =
            keys.find((key) => key.toLowerCase().includes('timestamp')) || DEFAULT.TIMESTAMP;
    }

    resolvedConfig.qlist = keys.filter(
        (key) => ![resolvedConfig.token, resolvedConfig.timestamp].includes(key)
    );

    return resolvedConfig;
}