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
    const {
        maxQuartersPerGame,
        minQuartersPerGame,
        numGoalies,
        numDefenders,
        numMidfielders,
        numForwards,
    } = settings;

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

        assignRole("goalieCount", "Goalie", numGoalies);
        assignRole("defenderCount", "Defender", numDefenders);
        assignRole("midfielderCount", "Midfielder", numMidfielders);
        assignRole("forwardCount", "Forward", numForwards);

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
        const result = createLineup(players, settings);
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
                                className="border p-1 text-center"
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

            <div className="space-y-2">
                <h2 className="font-semibold">Players</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border border-gray-300">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="p-2 text-sm sm:text-base">
                                    Name
                                </th>
                                <th className="p-2 text-sm sm:text-base">
                                    Goalie
                                </th>
                                <th className="p-2 text-sm sm:text-base">
                                    Defender
                                </th>
                                <th className="p-2 text-sm sm:text-base">
                                    Midfielder
                                </th>
                                <th className="p-2 text-sm sm:text-base">
                                    Forward
                                </th>
                                <th className="p-2 text-sm sm:text-base">
                                    Total
                                </th>
                                <th className="p-2 text-sm sm:text-base">
                                    This Game
                                </th>
                                <th className="p-2 text-sm sm:text-base">
                                    Remove
                                </th>
                                <th className="p-2 text-sm sm:text-base">
                                    Active
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {players.map((p, idx) => (
                                <tr
                                    key={idx}
                                    className={
                                        p.active
                                            ? ""
                                            : "bg-gray-100 text-gray-400"
                                    }
                                >
                                    <td className="p-2 text-center text-sm sm:text-base">
                                        <input
                                            className="border p-1 w-12 sm:w-16 text-center"
                                            value={p.name}
                                            onChange={(e) => {
                                                const updated = [...players];
                                                updated[idx].name =
                                                    e.target.value;
                                                setPlayers(updated);
                                            }}
                                        />
                                    </td>
                                    <td className="p-2 text-center text-sm sm:text-base">
                                        <input
                                            type="number"
                                            className="border p-1 w-12 sm:w-16 text-center"
                                            value={p.goalieCount}
                                            onChange={(e) => {
                                                const val = Math.max(
                                                    0,
                                                    parseInt(e.target.value) ||
                                                        0
                                                );
                                                const updated = [...players];
                                                updated[idx].goalieCount = val;
                                                setPlayers(updated);
                                            }}
                                        />
                                    </td>
                                    <td className="p-2 text-center text-sm sm:text-base">
                                        <input
                                            type="number"
                                            className="border p-1 w-12 sm:w-16 text-center"
                                            value={p.defenderCount}
                                            onChange={(e) => {
                                                const val = Math.max(
                                                    0,
                                                    parseInt(e.target.value) ||
                                                        0
                                                );
                                                const updated = [...players];
                                                updated[idx].defenderCount =
                                                    val;
                                                setPlayers(updated);
                                            }}
                                        />
                                    </td>
                                    <td className="p-2 text-center text-sm sm:text-base">
                                        <input
                                            type="number"
                                            className="border p-1 w-12 sm:w-16 text-center"
                                            value={p.midfielderCount}
                                            onChange={(e) => {
                                                const val = Math.max(
                                                    0,
                                                    parseInt(e.target.value) ||
                                                        0
                                                );
                                                const updated = [...players];
                                                updated[idx].midfielderCount =
                                                    val;
                                                setPlayers(updated);
                                            }}
                                        />
                                    </td>
                                    <td className="p-2 text-center text-sm sm:text-base">
                                        <input
                                            type="number"
                                            className="border p-1 w-12 sm:w-16 text-center"
                                            value={p.forwardCount}
                                            onChange={(e) => {
                                                const val = Math.max(
                                                    0,
                                                    parseInt(e.target.value) ||
                                                        0
                                                );
                                                const updated = [...players];
                                                updated[idx].forwardCount = val;
                                                setPlayers(updated);
                                            }}
                                        />
                                    </td>
                                    <td className="p-2 text-center text-sm sm:text-base">
                                        {p.goalieCount +
                                            p.defenderCount +
                                            p.midfielderCount +
                                            p.forwardCount}
                                    </td>
                                    <td
                                        className={`p-2 text-center text-sm sm:text-base ${
                                            (p.quartersThisGame || 0) <
                                            settings.minQuartersPerGame
                                                ? "bg-yellow-100 text-yellow-700 font-semibold"
                                                : ""
                                        }`}
                                    >
                                        {p.quartersThisGame ?? 0}
                                    </td>

                                    <td className="p-2 text-center text-sm sm:text-base">
                                        <button
                                            className="text-red-600"
                                            onClick={() =>
                                                handleRemovePlayer(idx)
                                            }
                                        >
                                            ✕
                                        </button>
                                    </td>
                                    <td className="p-2 text-center text-sm sm:text-base">
                                        <input
                                            type="checkbox"
                                            checked={p.active ?? true}
                                            onChange={(e) => {
                                                const updated = [...players];
                                                updated[idx].active =
                                                    e.target.checked;
                                                setPlayers(updated);
                                            }}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button
                    className="bg-blue-500 text-white px-3 py-1 rounded"
                    onClick={handleAddPlayer}
                >
                    + Add Player
                </button>
            </div>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <button className="bg-green-500 text-white px-3 py-1 rounded w-full sm:w-auto">
                    Generate Lineup
                </button>
                <button className="bg-red-500 text-white px-3 py-1 rounded w-full sm:w-auto">
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
                                    {quarter.map((p, i) => (
                                        <li key={i}>
                                            {p.name} - {p.role}
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
