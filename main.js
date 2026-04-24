import { PhysicsEngine } from './src/PhysicsEngine';
import { UIController } from './src/UIController';

const ui = new UIController();
const physics = new PhysicsEngine('canvas-wrapper', {
    onFinish: (marble) => handleFinish(marble),
    onLeaderboardUpdate: (activeRanks) => updateLeaderboard(activeRanks)
});

let finishedMarbles = [];
let allMarblesFinished = false;

// Hybrid Leaderboard: Finished Marbles (in order) + Active Marbles (by distance)
function updateLeaderboard(activeRanks) {
    const fullRanks = [...finishedMarbles, ...activeRanks];
    ui.updateLeaderboard(fullRanks);
}

function handleFinish(marble) {
    if (allMarblesFinished) return;

    finishedMarbles.push(marble);

    const settings = ui.getSettings();
    const totalMarbles = physics.marbles.length;
    const targetWinnerCount = Math.min(settings.winnerCount, totalMarbles);

    if (finishedMarbles.length === targetWinnerCount) {
        allMarblesFinished = true;

        let winners = [];
        if (settings.winnerType === 'first') {
            winners = finishedMarbles.slice(0, targetWinnerCount);
        } else {
            // For 'last', we still wait for everyone or just take the latest few
            winners = [...finishedMarbles].reverse().slice(0, targetWinnerCount);
        }

        ui.showWinners(winners);
    }
}

ui.startBtn.addEventListener('click', () => {
    const names = ui.getNames();
    if (names.length < 2) {
        alert('최소 2명 이상의 참가자를 입력해주세요.');
        return;
    }

    finishedMarbles = [];
    allMarblesFinished = false;
    const settings = ui.getSettings();

    ui.setStartEnabled(false);
    physics.reset();
    physics.generateTrack(settings.mapType);
    physics.startRace(names);

    // Scroll to canvas on mobile devices
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            document.querySelector('.game-container').scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
});

ui.resetBtn.addEventListener('click', () => {
    physics.reset();
    ui.setStartEnabled(true);
    ui.leaderboardList.innerHTML = '';
    ui.hideWinner();
});

// Initialize
physics.generateTrack('classic');
