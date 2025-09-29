// Soccer lineup generator ensuring fair playtime distribution

// Player data structure:
// [Name, GoalieCount, DefenderCount, MidfielderCount, ForwardCount, TotalQuarters]
// Initial counts are based on prior games; 

let players = [
    ["Abel", 4, 5, 4, 2, 15],
    ["Taj", 2, 7, 6, 1, 16],
    ["Talon", 2, 8, 4, 2, 16],
    ["Xander", 2, 7, 3, 2, 14],
    ["James", 2, 5, 6, 3, 16],
    ["Zeke", 2, 8, 4, 2, 16],
    ["Asher", 2, 6, 4, 1, 13],
    ["Ryder", 2, 6, 5, 2, 15],
    ["Grayson", 2, 7, 4, 3, 16],
    ["Bronx", 2, 7, 4, 3, 16],
    ["Tadhg", 2, 6, 4, 3, 15]
];

const MAX_PER_GAME = 3;
const MIN_PER_GAME = 2;
const NUM_GOALIES = 1;
const NUM_DEFENDERS = 3;
const NUM_MIDFIELDERS = 2;
const NUM_FORWARDS = 1;


function pickPlayer(players, index, alreadyChosen) {
    let pool = players.filter(p => !alreadyChosen.includes(p[0]));
    // prefer players with lower count for the requested index, then lower total quarters, then lower per-game count
    pool.sort((a, b) => {
        let d = a[index] - b[index];
        if (d !== 0) return d;
        d = a[5] - b[5];
        if (d !== 0) return d;
        return (a[6] || 0) - (b[6] || 0);
    });

    let notMaxed = pool.filter(p => p[6] < MAX_PER_GAME);
    pool = notMaxed.length > 0 ? notMaxed : players.filter(p => !alreadyChosen.includes(p[0]));

    if (pool.length === 0) return null; // no available players

    let player = pool[0];
    // If index is 5 (substitute), do not change any counters — substitutes are only for display
    if (index >= 1 && index <= 4) {
        player[index]++;
        player[5]++;     // total season quarters
        player[6]++;     // per-game counter
    }
    alreadyChosen.push(player[0]);
    return player;
}

function createLineup(players) {
    // add per-game counter at [6]
    let playersCopy = players.map(p => [...p, 0]);

    let plan = [];

    for (let q = 1; q <= 4; q++) {
        let quarterLineup = [];
        let chosenNames = [];

        function addSpot(index, role, count) {
            for (let i = 0; i < count; i++) {
                let p = pickPlayer(playersCopy, index, chosenNames);
                if (p) quarterLineup.push([p[0], role]);
            }
        }

        addSpot(1, "Goalie", NUM_GOALIES);
        addSpot(2, "Defender", NUM_DEFENDERS);
        addSpot(3, "Midfielder", NUM_MIDFIELDERS);
        addSpot(4, "Forward", NUM_FORWARDS);

        // fill with subs (ensures 11 players listed per quarter)
        while (quarterLineup.length < playersCopy.length) {
            let p = pickPlayer(playersCopy, 5, chosenNames);
            if (!p) break;
            quarterLineup.push([p[0], "Substitute"]);
        }

        plan.push(quarterLineup);
    }

    // Ensure all players get MIN_PER_GAME
    let underplayed = playersCopy.filter(p => p[6] < MIN_PER_GAME);
    // helper to map role to the index in player arrays
    function roleToIndex(role) {
        switch (role) {
            case "Goalie": return 1;
            case "Defender": return 2;
            case "Midfielder": return 3;
            case "Forward": return 4;
            case "Substitute": return 5; // treat substitute as affecting total only
            default: return 5;
        }
    }

    // Try to swap underplayed players into quarters until they reach MIN_PER_GAME
    for (let u of underplayed) {
        // keep trying across all quarters until this player reaches MIN_PER_GAME
        for (let quarter of plan) {
            if (u[6] >= MIN_PER_GAME) break;

            // find a player in this quarter (non-Substitute) who currently has more than MIN_PER_GAME quarters
            let overplayedIndex = quarter.findIndex(([name, role]) => {
                if (role === 'Substitute') return false; // don't swap substitute display slots
                let p = playersCopy.find(x => x[0] === name);
                return p && p[6] > MIN_PER_GAME;
            });

            if (overplayedIndex === -1) continue;

            let [overName, role] = quarter[overplayedIndex];
            let overP = playersCopy.find(x => x[0] === overName);

            // calculate index to adjust (position counts or total for subs)
            let idx = roleToIndex(role);

            // ensure we won't create negative counts
            if (overP[idx] <= 0 || overP[5] <= 0) continue;

            // perform the swap: update counts for both players
            overP[idx]--;
            overP[5]--;
            overP[6]--;

            u[idx]++;
            u[5]++;
            u[6]++;

            // replace the name in the quarter roster
            quarter[overplayedIndex][0] = u[0];
        }
    }

    // include per-game counter at index 6 so we can verify minutes/quarters played this game
    let updatedPlayers = playersCopy.map(p => p.slice(0, 7));

    return { plan, updatedPlayers };
}

// Example usage:
let result = createLineup(players);

console.log("Game Plan:");
result.plan.forEach((quarter, i) => {
    console.log(`Quarter ${i + 1}:`);
    quarter.forEach(([name, pos]) => console.log(` - ${name}: ${pos}`));
});

console.log("\nUpdated Players Array:");
console.table(result.updatedPlayers);

// Print updated players in the original array literal style (first 6 fields)
console.log('\nUpdated Players (array format):');
{
    const rows = result.updatedPlayers.map(p => p.slice(0, 6));
    // build lines like:   ["Abel", 4, 5, 4, 2, 15],
    const lines = rows.map((r, i) => {
        const json = JSON.stringify(r);
        // omit trailing comma on last line
        return '  ' + json + (i === rows.length - 1 ? '' : ',');
    });
    console.log(lines.join('\n'));
}
