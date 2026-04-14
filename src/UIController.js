import confetti from 'canvas-confetti';

export class UIController {
    constructor() {
        this.namesInput = document.getElementById('names');
        this.mapSelect = document.getElementById('map-select');
        this.winnerCountInput = document.getElementById('winner-count');
        this.winnerType = document.getElementById('winner-type');
        this.leaderboardList = document.getElementById('leaderboard');
        this.winnerOverlay = document.getElementById('winner-overlay');
        this.winnerListEl = document.getElementById('winnerList');
        this.startBtn = document.getElementById('start-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.shuffleBtn = document.getElementById('shuffle-btn');
        this.saveResultsBtn = document.getElementById('saveResultsBtn');
        this.closeOverlayBtn = document.getElementById('closeOverlayBtn');

        this.lastWinners = [];
        this.initEventListeners();
    }

    initEventListeners() {
        this.shuffleBtn.addEventListener('click', () => this.shuffleNames());
        this.saveResultsBtn.addEventListener('click', () => this.exportResults());
        this.closeOverlayBtn.addEventListener('click', () => this.hideWinner());
    }

    shuffleNames() {
        const names = this.getNames();
        if (names.length === 0) return;

        for (let i = names.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [names[i], names[j]] = [names[j], names[i]];
        }

        this.namesInput.value = names.join(', ');
    }

    getNames() {
        const value = this.namesInput.value.trim();
        if (!value) return [];
        return value.split(/,|\n/).map(n => n.trim()).filter(n => n !== '');
    }

    getSettings() {
        return {
            mapType: this.mapSelect.value,
            winnerType: this.winnerType.value,
            winnerCount: parseInt(this.winnerCountInput.value, 10) || 1
        };
    }

    updateLeaderboard(ranks) {
        this.leaderboardList.innerHTML = ranks.map((m, i) => `
            <li class="leaderboard-item">
                <span>${i + 1}위: ${m.name}</span>
                <span style="color: ${m.color}">●</span>
            </li>
        `).join('');
    }

    showWinners(winners) {
        this.lastWinners = winners;
        const winnerListHtml = winners.map((w, i) => `
            <div class="winner-item" style="color: ${w.color}; border-left: 4px solid ${w.color};">
                <span class="rank">${i + 1}등</span>
                <span class="name">${w.name}</span>
            </div>
        `).join('');

        this.winnerListEl.innerHTML = winnerListHtml;
        this.winnerOverlay.classList.remove('hidden');

        // Premium effect: Confetti
        const duration = 4 * 1000;
        const end = Date.now() + duration;
        const colors = winners.map(w => w.color);

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    }

    exportResults() {
        if (this.lastWinners.length === 0) return;

        const date = new Date().toLocaleString();
        let content = `--- Marble Roulette 추첨 결과 ---\n`;
        content += `일시: ${date}\n`;
        content += `총 당첨자 수: ${this.lastWinners.length}명\n`;
        content += `------------------------------\n\n`;

        this.lastWinners.forEach((w, i) => {
            content += `${i + 1}위: ${w.name}\n`;
        });

        content += `\n축하합니다!`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marble_roulette_results_${new Date().getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    hideWinner() {
        this.winnerOverlay.classList.add('hidden');
    }

    setStartEnabled(enabled) {
        this.startBtn.disabled = !enabled;
        this.startBtn.style.opacity = enabled ? '1' : '0.5';
    }
}
