export default class STVote {
    constructor() {
        this.preferences = [];
        this.currentPreferenceIndex = 0;
        this.weight = 1; // Default weight for the vote
    }

    static fromPreferences(preferences) {
        const stv = new STVote();
        preferences.forEach((pref) => stv.push(pref));
        return stv;
    }

    push(preference) {
        this.preferences.push(preference);
    }

    get() {
        return [this.weight, this.preferences[this.currentPreferenceIndex]];
    }
    getCandidates() {
        return this.preferences;
    }

    redistribute(overflowWeight, avoidCandidates = []) {
        this.weight *= overflowWeight;
        this.currentPreferenceIndex++;
        while (this.currentPreferenceIndex < this.preferences.length && avoidCandidates.includes(this.preferences[this.currentPreferenceIndex])) {
            this.currentPreferenceIndex++;
        }
        // console.log(`Voto redistribuito alla scelta: ${this.preferences[this.currentPreferenceIndex]} `);
        return this;
    }
}