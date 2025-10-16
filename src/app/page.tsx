"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface Player {
    name: string;
    goalieCount: number;
    defenderCount: number;
    midfielderCount: number;
    forwardCount: number;
    totalQuarters: number;
    quartersThisGame?: number;
    active?: boolean;
}

interface LineupResult {
    plan: { name: string; role: string }[][];
    updatedPlayers: Player[];
}

interface LineupSettings {
    maxQuartersPerGame: number;
    minQuartersPerGame: number;
    numGoalies: number;
    numDefenders: number;
    numMidfielders: number;
    numForwards: number;
}

const defaultPlayers: Player[] = [
    {
        name: "Player Name",
        goalieCount: 0,
        defenderCount: 0,
        midfielderCount: 0,
        forwardCount: 0,
        totalQuarters: 0,
        active: true,
    },
];

function choosePlayer(
    players: Player[],
    positionKey: keyof Player,
    chosenNames: string[],
    maxQuartersPerGame: number,
    minQuartersPerGame: number
): Player | null {
    let availablePlayers = players.filter(
        (p) => !chosenNames.includes(p.name) && p.active !== false
    );

    // Prioritize players below their minimum quarters
    const underMin = availablePlayers.filter(
        (p) => (p.quartersThisGame || 0) < minQuartersPerGame
    );

    // Sort by fewest total games in this position, then fewest total quarters
    const sortPlayers = (a: Player, b: Player) => {
        let diff = (a[positionKey] as number) - (b[positionKey] as number);
        if (diff !== 0) return diff;
        diff = a.totalQuarters - b.totalQuarters;
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
    };

    if (underMin.length > 0) availablePlayers = underMin;
    availablePlayers.sort(sortPlayers);

    const eligible = availablePlayers.filter(
        (p) => (p.quartersThisGame || 0) < maxQuartersPerGame
    );

    const pool = eligible.length > 0 ? eligible : availablePlayers;
    if (pool.length === 0) return null;

    const chosen = pool[0];
    if (
        [
            "goalieCount",
            "defenderCount",
            "midfielderCount",
            "forwardCount",
        ].includes(positionKey as string)
    ) {
        (chosen[positionKey] as number)++;
        chosen.totalQuarters++;
        chosen.quartersThisGame = (chosen.quartersThisGame || 0) + 1;
    }
    chosenNames.push(chosen.name);
    return chosen;
}

function createLineup(
    players: Player[],
    settings: LineupSettings
): LineupResult {
    const { maxQuartersPerGame, minQuartersPerGame } = settings;

    const playersCopy = players.map((p) => ({ ...p, quartersThisGame: 0 }));
    const gamePlan: { name: string; role: string }[][] = [];

    for (let quarter = 1; quarter <= 4; quarter++) {
        const quarterLineup: { name: string; role: string }[] = [];
        const chosenNames: string[] = [];

        const assignRole = (
            roleKey: keyof Player,
            roleName: string,
            count: number
        ) => {
            for (let i = 0; i < count; i++) {
                const player = choosePlayer(
                    playersCopy,
                    roleKey,
                    chosenNames,
                    maxQuartersPerGame,
                    minQuartersPerGame
                );
                if (player)
                    quarterLineup.push({ name: player.name, role: roleName });
            }
        };

        assignRole("goalieCount", "Goalie", settings.numGoalies);
        assignRole("defenderCount", "Defender", settings.numDefenders);
        assignRole("midfielderCount", "Midfielder", settings.numMidfielders);
        assignRole("forwardCount", "Forward", settings.numForwards);

        while (quarterLineup.length < playersCopy.length) {
            const sub = choosePlayer(
                playersCopy,
                "totalQuarters",
                chosenNames,
                maxQuartersPerGame,
                minQuartersPerGame
            );
            if (!sub) break;
            quarterLineup.push({ name: sub.name, role: "Substitute" });
        }

        gamePlan.push(quarterLineup);
    }

    return { plan: gamePlan, updatedPlayers: playersCopy };
}

export default function SoccerLineupGenerator() {
    const [players, setPlayers] = useState<Player[]>(defaultPlayers);
    const [lineup, setLineup] = useState<{ name: string; role: string }[][]>(
        []
    );
    const [settings, setSettings] = useState({
        maxQuartersPerGame: 3,
        minQuartersPerGame: 2,
        numGoalies: 1,
        numDefenders: 3,
        numMidfielders: 2,
        numForwards: 1,
    });
    const [showInstructions, setShowInstructions] = useState(true);

    useEffect(() => {
        const savedPlayers = localStorage.getItem("playersData");
        const savedLineup = localStorage.getItem("lastLineup");
        const savedSettings = localStorage.getItem("lineupSettings");

        if (savedPlayers) setPlayers(JSON.parse(savedPlayers));
        if (savedLineup) setLineup(JSON.parse(savedLineup));
        if (savedSettings) setSettings(JSON.parse(savedSettings));
    }, []);

    useEffect(() => {
        localStorage.setItem("playersData", JSON.stringify(players));
        localStorage.setItem("lastLineup", JSON.stringify(lineup));
        localStorage.setItem("lineupSettings", JSON.stringify(settings));
    }, [players, lineup, settings]);

    function handleGenerate() {
        const activePlayers = players.filter((p) => p.active !== false); // only include active players
        const totalRequired =
            settings.numGoalies +
            settings.numDefenders +
            settings.numMidfielders +
            settings.numForwards;

        if (activePlayers.length < totalRequired) {
            alert(
                `Not enough players to generate a lineup! You need at least ${totalRequired} active players.`
            );
            return;
        }

        const result = createLineup(activePlayers, {
            maxQuartersPerGame: settings.maxQuartersPerGame,
            minQuartersPerGame: settings.minQuartersPerGame,
            numGoalies: settings.numGoalies,
            numDefenders: settings.numDefenders,
            numMidfielders: settings.numMidfielders,
            numForwards: settings.numForwards,
        });

        setPlayers(result.updatedPlayers);
        setLineup(result.plan);

        const history = JSON.parse(
            localStorage.getItem("gamePlanHistory") || "[]"
        );
        history.push({ date: new Date().toISOString(), plan: result.plan });
        localStorage.setItem("gamePlanHistory", JSON.stringify(history));
    }

    function handleClear() {
        const confirmed = window.confirm(
            "Are you sure you want to clear all saved data? This cannot be undone."
        );
        if (!confirmed) return;

        localStorage.clear();
        setPlayers(defaultPlayers);
        setLineup([]);
    }

    function handleAddPlayer() {
        const newPlayer: Player = {
            name: `Player ${players.length + 1}`,
            goalieCount: 0,
            defenderCount: 0,
            midfielderCount: 0,
            forwardCount: 0,
            totalQuarters: 0,
            quartersThisGame: 0,
            active: true,
        };
        setPlayers([...players, newPlayer]);
    }

    function handleRemovePlayer(index: number) {
        const updated = [...players];
        updated.splice(index, 1);
        setPlayers(updated);
    }

    return (
        <div className="p-6 space-y-4">
            <nav className="flex justify-between mb-4">
                <Link href="/" className="text-blue-600 font-semibold">
                    Home
                </Link>
                <Link href="/history" className="text-blue-600 font-semibold">
                    View Game History
                </Link>
            </nav>

            <h1 className="text-2xl font-bold">Soccer Lineup Generator</h1>
            <div className="space-y-2">
                <h2 className="font-semibold">Game Settings</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(settings).map(([key, value]) => (
                        <label key={key} className="flex flex-col">
                            <span className="capitalize">
                                {key.replace(/([A-Z])/g, " $1")}
                            </span>
                            <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="border p-2 w-20 sm:w-16 text-center rounded"
                                value={value}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        [key]: Math.max(
                                            0,
                                            parseInt(e.target.value) || 0
                                        ),
                                    })
                                }
                            />
                        </label>
                    ))}
                </div>
            </div>
            <div className="p-4 border rounded mb-4">
                <button
                    className="font-semibold text-left w-full"
                    onClick={() => setShowInstructions(!showInstructions)}
                >
                    {showInstructions
                        ? "Hide Instructions ▲"
                        : "Show Instructions ▼"}
                </button>
                {showInstructions && (
                    <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
                        <li>
                            Enter each player&apos;s name in the text input.
                        </li>
                        <li>
                            Set the number of quarters the player has played in
                            each position (Goalie, Defender, Midfielder,
                            Forward).
                        </li>
                        <li>
                            Use the <strong>Active</strong> checkbox to include
                            or exclude players from this game&apos;s lineup.
                        </li>
                        <li>
                            Click <strong>+ Add Player</strong> to add more
                            players.
                        </li>
                        <li>
                            Once all players and positions are set, click{" "}
                            <strong>Generate Lineup</strong> to create the game
                            plan.
                        </li>
                        <li>
                            The lineup will display by quarter. Substitutes are
                            automatically added if there are extra players.
                        </li>
                        <li>
                            Click <strong>Clear Saved Data</strong> to reset all
                            players and lineups (you will be asked for
                            confirmation).
                        </li>
                        <li>
                            You can view previous game plans by clicking{" "}
                            <strong>View Game History</strong>.
                        </li>
                    </ol>
                )}
            </div>

            <div className="space-y-4">
                <h2 className="font-semibold text-lg">Players</h2>
                {players.map((player, idx) => (
                    <div
                        key={idx}
                        className={`border p-4 rounded space-y-3 ${
                            player.active === false
                                ? "bg-gray-100 text-gray-400"
                                : ""
                        }`}
                    >
                        {/* Player Name */}
                        <input
                            type="text"
                            value={player.name}
                            placeholder="Player Name"
                            className="border p-2 w-full rounded"
                            onChange={(e) => {
                                const updated = [...players];
                                updated[idx].name = e.target.value;
                                setPlayers(updated);
                            }}
                        />

                        {/* Position Counts */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {/* Goalie */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                                <label className="text-sm font-medium">
                                    Goalie
                                </label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    min={0}
                                    step={1}
                                    value={player.goalieCount}
                                    className="border p-2 text-center rounded w-full sm:w-16"
                                    onChange={(e) => {
                                        const val = Math.max(
                                            0,
                                            parseInt(e.target.value) || 0
                                        );
                                        const updated = [...players];
                                        updated[idx].goalieCount = isNaN(val)
                                            ? 0
                                            : val;
                                        setPlayers(updated);
                                    }}
                                />
                            </div>

                            {/* Defender */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                                <label className="text-sm font-medium">
                                    Defender
                                </label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    min={0}
                                    step={1}
                                    value={player.defenderCount}
                                    className="border p-2 text-center rounded w-full sm:w-16"
                                    onChange={(e) => {
                                        const val = Math.max(
                                            0,
                                            parseInt(e.target.value) || 0
                                        );
                                        const updated = [...players];
                                        updated[idx].defenderCount = isNaN(val)
                                            ? 0
                                            : val;
                                        setPlayers(updated);
                                    }}
                                />
                            </div>

                            {/* Midfielder */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                                <label className="text-sm font-medium">
                                    Midfielder
                                </label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    min={0}
                                    step={1}
                                    value={player.midfielderCount}
                                    className="border p-2 text-center rounded w-full sm:w-16"
                                    onChange={(e) => {
                                        const val = Math.max(
                                            0,
                                            parseInt(e.target.value) || 0
                                        );
                                        const updated = [...players];
                                        updated[idx].midfielderCount = isNaN(
                                            val
                                        )
                                            ? 0
                                            : val;
                                        setPlayers(updated);
                                    }}
                                />
                            </div>

                            {/* Forward */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                                <label className="text-sm font-medium">
                                    Forward
                                </label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    min={0}
                                    step={1}
                                    value={player.forwardCount}
                                    className="border p-2 text-center rounded w-full sm:w-16"
                                    onChange={(e) => {
                                        const val = Math.max(
                                            0,
                                            parseInt(e.target.value) || 0
                                        );
                                        const updated = [...players];
                                        updated[idx].forwardCount = isNaN(val)
                                            ? 0
                                            : val;
                                        setPlayers(updated);
                                    }}
                                />
                            </div>
                        </div>

                        {/* Active Toggle & Total */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={player.active ?? true}
                                    onChange={(e) => {
                                        const updated = [...players];
                                        updated[idx].active = e.target.checked;
                                        setPlayers(updated);
                                    }}
                                />
                                <label className="text-sm font-medium">
                                    Active
                                </label>
                            </div>

                            <div className="text-sm font-medium">
                                Total:{" "}
                                {player.goalieCount +
                                    player.defenderCount +
                                    player.midfielderCount +
                                    player.forwardCount}
                            </div>

                            {/* Remove Player */}
                            <button
                                className="text-red-600 font-bold text-lg"
                                onClick={() => handleRemovePlayer(idx)}
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add Player Button */}
                <button
                    className="bg-blue-500 text-white px-4 py-2 rounded w-full sm:w-auto"
                    onClick={handleAddPlayer}
                >
                    + Add Player
                </button>
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <button
                    className="bg-green-500 text-white px-3 py-1 rounded w-full sm:w-auto"
                    onClick={handleGenerate}
                >
                    Generate Lineup
                </button>
                <button
                    className="bg-red-500 text-white px-3 py-1 rounded w-full sm:w-auto"
                    onClick={handleClear}
                >
                    Clear Saved Data
                </button>
            </div>

            {lineup.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold mt-4">
                        Generated Game Plan
                    </h2>
                    {lineup.map((quarter, qIdx) => (
                        <div key={qIdx} className="border rounded p-3 mt-2">
                            <h3 className="font-semibold">
                                Quarter {qIdx + 1}
                            </h3>
                            <ul>
                                {Object.entries(
                                    quarter.reduce(
                                        (
                                            acc: Record<string, string[]>,
                                            player
                                        ) => {
                                            if (!acc[player.role])
                                                acc[player.role] = [];
                                            acc[player.role].push(player.name);
                                            return acc;
                                        },
                                        {}
                                    )
                                ).map(([role, names]) => (
                                    <li key={role}>
                                        <span className="font-semibold">
                                            {role}:
                                        </span>{" "}
                                        {names.join(", ")}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function GamePlanHistory() {
    const [history, setHistory] = useState<
        { date: string; plan: { name: string; role: string }[][] }[]
    >([]);

    useEffect(() => {
        const savedHistory = localStorage.getItem("gamePlanHistory");
        if (savedHistory) setHistory(JSON.parse(savedHistory));
    }, []);

    return (
        <div className="p-6">
            <nav className="flex justify-between mb-4">
                <Link href="/" className="text-blue-600 font-semibold">
                    Home
                </Link>
                <Link href="/history" className="text-blue-600 font-semibold">
                    View Game History
                </Link>
            </nav>

            <h1 className="text-2xl font-bold mb-4">Previous Game Plans</h1>
            {history.length === 0 ? (
                <p>No previous plans found.</p>
            ) : (
                history.map((entry, idx) => (
                    <div key={idx} className="border rounded p-4 mb-4">
                        <h2 className="font-semibold">
                            Game on {new Date(entry.date).toLocaleString()}
                        </h2>
                        {entry.plan.map((quarter, qIdx) => (
                            <div key={qIdx} className="mt-2">
                                <h3 className="font-semibold">
                                    Quarter {qIdx + 1}
                                </h3>
                                <ul>
                                    {Object.entries(
                                        quarter.reduce(
                                            (
                                                acc: Record<string, string[]>,
                                                player
                                            ) => {
                                                if (!acc[player.role])
                                                    acc[player.role] = [];
                                                acc[player.role].push(
                                                    player.name
                                                );
                                                return acc;
                                            },
                                            {}
                                        )
                                    ).map(([role, names]) => (
                                        <li key={role}>
                                            <span className="font-semibold">
                                                {role}:
                                            </span>{" "}
                                            {names.join(", ")}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ))
            )}
        </div>
    );
}
