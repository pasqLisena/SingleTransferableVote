import test from 'node:test';
import assert from 'node:assert/strict';
import { importVotes, selectValidVotes, processVotes } from '../src/index.js';

const TOKEN_FILE = 'data/Milano/MilanoToken.csv';
const VOTE_FILE = 'data/Milano/Elezioni City Lead Milano (Responses).xlsx';

// test('importVotes parses CSV vote files into Vote objects', () => {
//   const result = importVotes('data/Lazio/Elezioni Regional Lead Lazio (Responses) - Form Responses 1.csv');

//   assert.equal(result.length, 23);
//   assert.ok(result[0].token);
// });

// test('importVotes parses XLSX vote files into row objects', () => {
//   const result = importVotes('data/Roma/Elezioni City Lead Roma (Responses).xlsx');

//   assert.ok(result.length > 0);
// });

// test('importVotes rejects unsupported file formats', () => {
//   assert.throws(() => importVotes('data/Lazio/LazioToken.txt'), /Unsupported file format/);
// });

// test('selectValidVotes returns votes with tokens present in the token file', () => {
//   const result = selectValidVotes(
//     'data/Lazio/Elezioni Regional Lead Lazio (Responses) - Form Responses 1.csv',
//     'data/Lazio/LazioToken.csv'
//   );

//   assert.equal(result.length, 23);
// });

// test('process votes to return the verdict', () => {
//     const votes = selectValidVotes(VOTE_FILE, TOKEN_FILE);

//     const result = processVotes(votes);
//     assert.equal(result.length, 16);
// });

// test('importVotes normalizes FPTP and STV questions in Vote objects', () => {
//         const votes = importVotes('data/CD2021/Voti Elezione Direttivo 29 Novembre 2021 PUBBLICO - Form Responses 1.csv');
//         const firstVote = votes[0];

//         assert.equal(
//             firstVote.questions['Candidato alla Tesoreria | Paolo Manetta'],
//             'Favorevole'
//         );
//         assert.deepEqual(
//             firstVote.questions['Candidati alla Presidenza | Genere maschile - Ordina i candidati in base alla tua preferenza: la 1a scelta come preferita e la 2a scelta come ultima.'],
//             ['Stefan De Jonghe', 'Gianluca Guerra']
//         );
//         assert.deepEqual(
//             firstVote.questions['Candidate alla Presidenza | Genere femminile - Ordina le candidate in base alla tua preferenza: la 1a scelta come preferita e la 3a scelta come ultima.'],
//             ['Giulia Romana Mele', 'Eliana Canavesio', 'Giulia Pretini']
//         );
// });

test('processVotes processes STV questions', () => {
        const votes = selectValidVotes('data/CD2021/Voti Elezione Direttivo 29 Novembre 2021 PUBBLICO - Form Responses 1.csv');

        let vt = processVotes(votes);

        assert.equal(vt.length, 341);
});

