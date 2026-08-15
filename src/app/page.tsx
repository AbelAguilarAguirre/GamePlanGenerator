"use client";

import { useEffect, useMemo, useState } from "react";

type Position = "Goalie" | "Defender" | "Midfielder" | "Forward";

type PlayerAssignment = {
  name: string;
  position: Position;
};

type QuarterLineup = {
  quarter: number;
  goalie: string;
  players: PlayerAssignment[];
};

type PositionTotals = Record<Position, number>;
type PlayerPositionSummary = PositionTotals & {
  totalQuarters: number;
};

type SavedGame = {
  id: number;
  generatedAt: string;
  gameNumber: number;
  lineup: QuarterLineup[];
  seasonSummary: Record<string, PlayerPositionSummary>;
};

const STORAGE_KEY = "soccer-lineup-generator-v1";
const DEFAULT_PLAYERS = Array.from({ length: 10 }, (_, index) => `Player ${index + 1}`);
const POSITION_ORDER: Position[] = ["Goalie", "Defender", "Midfielder", "Forward"];
const QUARTER_NAMES = ["Q1", "Q2", "Q3", "Q4"];
const PITCH_LAYOUT: Array<{ position: Position; left: string; top: string }> = [
  { position: "Goalie", left: "50%", top: "86%" },
  { position: "Defender", left: "25%", top: "62%" },
  { position: "Defender", left: "50%", top: "62%" },
  { position: "Defender", left: "75%", top: "62%" },
  { position: "Midfielder", left: "35%", top: "38%" },
  { position: "Midfielder", left: "65%", top: "38%" },
  { position: "Forward", left: "50%", top: "14%" },
];

function createEmptyPositionSummary(): PositionTotals {
  return {
    Goalie: 0,
    Defender: 0,
    Midfielder: 0,
    Forward: 0,
  };
}

function buildSeasonSummary(players: string[]) {
  return players.reduce<Record<string, PlayerPositionSummary>>((acc, player) => {
    acc[player] = {
      ...createEmptyPositionSummary(),
      totalQuarters: 0,
    };
    return acc;
  }, {});
}

function summarizeLineup(lineup: QuarterLineup[], players: string[]) {
  const summary = buildSeasonSummary(players);

  for (const quarter of lineup) {
    for (const assignment of quarter.players) {
      const playerStats = summary[assignment.name];
      playerStats[assignment.position] += 1;
      playerStats.totalQuarters += 1;
    }
  }

  return summary;
}

function mergeSeasonSummary(
  current: Record<string, PlayerPositionSummary>,
  additions: Record<string, PlayerPositionSummary>,
  players: string[],
) {
  const merged = { ...current };

  for (const player of players) {
    merged[player] = {
      ...createEmptyPositionSummary(),
      ...merged[player],
      totalQuarters: merged[player]?.totalQuarters ?? 0,
    };
  }

  for (const player of players) {
    const previousStats = merged[player] ?? {
      ...createEmptyPositionSummary(),
      totalQuarters: 0,
    };
    const newStats = additions[player] ?? {
      ...createEmptyPositionSummary(),
      totalQuarters: 0,
    };

    merged[player] = {
      Goalie: previousStats.Goalie + newStats.Goalie,
      Defender: previousStats.Defender + newStats.Defender,
      Midfielder: previousStats.Midfielder + newStats.Midfielder,
      Forward: previousStats.Forward + newStats.Forward,
      totalQuarters: previousStats.totalQuarters + newStats.totalQuarters,
    };
  }

  return merged;
}

export function GamePlanHistory() {
  const [players, setPlayers] = useState<string[]>(DEFAULT_PLAYERS);
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [generatedLineup, setGeneratedLineup] = useState<QuarterLineup[]>([]);
  const [seasonSummary, setSeasonSummary] = useState<Record<string, PlayerPositionSummary>>(
    buildSeasonSummary(DEFAULT_PLAYERS),
  );
  const [gameNumber, setGameNumber] = useState(1);
  const [playerInput, setPlayerInput] = useState(DEFAULT_PLAYERS.join("\n"));

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        players?: string[];
        gameNumber?: number;
        savedGames?: SavedGame[];
        seasonSummary?: Record<string, PlayerPositionSummary>;
      };

      if (parsed.players?.length) {
        setPlayers(parsed.players);
        setPlayerInput(parsed.players.join("\n"));
      }

      if (typeof parsed.gameNumber === "number") {
        setGameNumber(parsed.gameNumber);
      }

      if (parsed.savedGames) {
        setSavedGames(parsed.savedGames);
      }

      if (parsed.seasonSummary) {
        setSeasonSummary(parsed.seasonSummary);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload = {
      players,
      gameNumber,
      savedGames,
      seasonSummary,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [players, gameNumber, savedGames, seasonSummary]);

  const currentSeasonBalance = useMemo(() => {
    return players.map((player) => {
      const totals = seasonSummary[player] ?? {
        ...createEmptyPositionSummary(),
        totalQuarters: 0,
      };

      const totalsCount = Object.values(totals).slice(0, 4) as number[];
      const totalAssigned = totalsCount.reduce((sum, value) => sum + value, 0);

      return {
        player,
        totalAssigned,
        totals,
      };
    });
  }, [players, seasonSummary]);

  const handlePlayerNamesChange = (raw: string) => {
    setPlayerInput(raw);
    const nextPlayers = raw
      .split(/\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (nextPlayers.length === 0) {
      return;
    }

    const normalized = [...new Set(nextPlayers)].slice(0, 10);
    setPlayers(normalized);
    setSeasonSummary((previous) => {
      const nextSummary = buildSeasonSummary(normalized);
      for (const player of normalized) {
        const oldSummary = previous[player];
        if (oldSummary) {
          nextSummary[player] = oldSummary;
        }
      }
      return nextSummary;
    });
  };

  const generateLineup = () => {
    const team = [...players];

    if (team.length < 7) {
      return;
    }

    const quarterUsage: Record<string, number> = Object.fromEntries(
      team.map((player) => [player, 0]),
    );

    const previousPosition: Record<string, Position> = {};
    const lastSavedGame = savedGames[savedGames.length - 1];

    if (lastSavedGame) {
      for (const quarter of lastSavedGame.lineup) {
        for (const assignment of quarter.players) {
          previousPosition[assignment.name] = assignment.position;
        }
      }
    }

    const getPlayerStats = (player: string) => {
      return seasonSummary[player] ?? {
        ...createEmptyPositionSummary(),
        totalQuarters: 0,
      };
    };

    const rankPlayers = (eligible: string[], focusPosition?: Position) => {
      return [...eligible].sort((a, b) => {
        const aStats = getPlayerStats(a);
        const bStats = getPlayerStats(b);

        return (
          (quarterUsage[a] ?? 0) - (quarterUsage[b] ?? 0) ||
          (aStats.totalQuarters ?? 0) - (bStats.totalQuarters ?? 0) ||
          (focusPosition ? (aStats[focusPosition] ?? 0) - (bStats[focusPosition] ?? 0) : 0) ||
          (previousPosition[a] === focusPosition ? 0 : 1) - (previousPosition[b] === focusPosition ? 0 : 1) ||
          a.localeCompare(b)
        );
      });
    };

    const getGoalieCandidates = (excludedPlayers: Set<string> = new Set()) => {
      return team
        .filter((player) => !excludedPlayers.has(player) && (quarterUsage[player] ?? 0) < 2)
        .sort((a, b) => {
          const aStats = getPlayerStats(a);
          const bStats = getPlayerStats(b);
          return (
            ((aStats.Goalie ?? 0) % 2) - ((bStats.Goalie ?? 0) % 2) ||
            (aStats.Goalie ?? 0) - (bStats.Goalie ?? 0) ||
            (aStats.totalQuarters ?? 0) - (bStats.totalQuarters ?? 0) ||
            (quarterUsage[a] ?? 0) - (quarterUsage[b] ?? 0) ||
            a.localeCompare(b)
          );
        });
    };

    const lineup: QuarterLineup[] = [];
    const firstHalfGoalie = getGoalieCandidates()[0] ?? team[0];
    const secondHalfGoalie = getGoalieCandidates(new Set([firstHalfGoalie]))[0] ?? firstHalfGoalie;

    for (let quarterIndex = 0; quarterIndex < 4; quarterIndex += 1) {
      const selectedPlayers = new Set<string>();
      const assignments: PlayerAssignment[] = [];
      const goalie = quarterIndex < 2 ? firstHalfGoalie : secondHalfGoalie;

      if (!goalie) {
        continue;
      }

      if ((quarterUsage[goalie] ?? 0) >= 4) {
        const fallbackGoalie = team.find((player) => (quarterUsage[player] ?? 0) < 4) ?? goalie;
        selectedPlayers.add(fallbackGoalie);
        quarterUsage[fallbackGoalie] += 1;
        assignments.push({ name: fallbackGoalie, position: "Goalie" });
      } else {
        selectedPlayers.add(goalie);
        quarterUsage[goalie] += 1;
        assignments.push({ name: goalie, position: "Goalie" });
      }

      const addAssignment = (player: string, position: Position) => {
        if (!player || selectedPlayers.has(player) || (quarterUsage[player] ?? 0) >= 3) {
          return;
        }

        if (position === "Goalie" && assignments.some((assignment) => assignment.position === "Goalie")) {
          return;
        }

        selectedPlayers.add(player);
        quarterUsage[player] += 1;
        assignments.push({ name: player, position });
      };

      const addRolePlayers = (position: Position, requiredCount: number) => {
        const eligible = team.filter((player) => !selectedPlayers.has(player) && (quarterUsage[player] ?? 0) < 3);
        const ranked = rankPlayers(eligible, position);

        let picked = 0;
        for (const player of ranked) {
          if (picked >= requiredCount) {
            break;
          }

          addAssignment(player, position);
          picked += 1;
        }
      };

      addRolePlayers("Defender", 3);
      addRolePlayers("Midfielder", 2);
      addRolePlayers("Forward", 1);

      while (selectedPlayers.size < 7) {
        const eligible = team.filter((player) => !selectedPlayers.has(player) && (quarterUsage[player] ?? 0) < 3);
        if (eligible.length === 0) {
          break;
        }

        const nextPlayer = rankPlayers(eligible, previousPosition[eligible[0]] ?? "Defender")[0];
        if (!nextPlayer) {
          break;
        }

        const preferredPosition = previousPosition[nextPlayer] === "Goalie" ? "Defender" : previousPosition[nextPlayer] ?? "Defender";
        addAssignment(nextPlayer, preferredPosition);
      }

      if (assignments.length < 7) {
        const fallback = team.filter((player) => !selectedPlayers.has(player) && (quarterUsage[player] ?? 0) < 3);
        for (const player of fallback) {
          if (selectedPlayers.size >= 7) {
            break;
          }

          const preferredPosition = previousPosition[player] === "Goalie" ? "Defender" : previousPosition[player] ?? "Defender";
          addAssignment(player, preferredPosition);
        }
      }

      const orderedAssignments = [...assignments]
        .slice(0, 7)
        .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));

      const actualGoalie = orderedAssignments.find((assignment) => assignment.position === "Goalie")?.name ?? goalie;
      const quarterEntry: QuarterLineup = {
        quarter: quarterIndex + 1,
        goalie: actualGoalie,
        players: orderedAssignments,
      };

      lineup.push(quarterEntry);

      for (const assignment of orderedAssignments) {
        previousPosition[assignment.name] = assignment.position;
      }
    }

    const nextSummary = summarizeLineup(lineup, team);

    const nextSavedGame: SavedGame = {
      id: Date.now(),
      generatedAt: new Date().toISOString(),
      gameNumber: gameNumber,
      lineup,
      seasonSummary: nextSummary,
    };

    setGeneratedLineup(lineup);
    setSavedGames((current) => [...current, nextSavedGame]);
    setSeasonSummary((current) => mergeSeasonSummary(current, nextSummary, team));
    setGameNumber((current) => current + 1);
  };

  const resetSeason = () => {
    const freshSummary = buildSeasonSummary(players);
    setSeasonSummary(freshSummary);
    setSavedGames([]);
    setGeneratedLineup([]);
    setGameNumber(1);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #031b2d 0%, #0a2a43 100%)",
        color: "#eaf8ff",
        padding: "32px 20px 80px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <p style={{ color: "#7bd3ff", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
              Soccer Game Planner
            </p>
            <h1 style={{ margin: "8px 0 0", fontSize: "clamp(2rem, 5vw, 3.4rem)" }}>
              Team Lineup Generator
            </h1>
          </div>

          <button
            onClick={generateLineup}
            style={{
              background: "#1cc8a7",
              color: "#03263a",
              border: "none",
              borderRadius: 12,
              padding: "12px 18px",
              fontWeight: 700,
              fontSize: 16,
              boxShadow: "0 12px 28px rgba(28, 200, 167, 0.25)",
              cursor: "pointer",
            }}
          >
            Generate Match Lineup
          </button>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              background: "rgba(11, 26, 38, 0.68)",
              border: "1px solid rgba(123, 211, 255, 0.22)",
              borderRadius: 20,
              padding: 18,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>Players</h2>
            <textarea
              value={playerInput}
              onChange={(event) => handlePlayerNamesChange(event.target.value)}
              rows={10}
              style={{
                width: "100%",
                resize: "vertical",
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(123, 211, 255, 0.3)",
                background: "rgba(3, 27, 45, 0.7)",
                color: "#eaf8ff",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              {players.map((player) => (
                <span
                  key={player}
                  style={{
                    background: "rgba(28, 200, 167, 0.12)",
                    border: "1px solid rgba(28, 200, 167, 0.3)",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                  }}
                >
                  {player}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "rgba(11, 26, 38, 0.68)",
              border: "1px solid rgba(123, 211, 255, 0.22)",
              borderRadius: 20,
              padding: 18,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>Game Rules</h2>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
              <li>4 quarters per match</li>
              <li>10 players on the roster</li>
              <li>7 players active each quarter</li>
              <li>1 Goalie per quarter</li>
              <li>3 defenders, 2 midfielders, 1 forward each quarter</li>
              <li>2-3 quarters per player</li>
              <li>Goalie rotates for first and second half</li>
            </ul>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              background: "rgba(11, 26, 38, 0.68)",
              border: "1px solid rgba(123, 211, 255, 0.22)",
              borderRadius: 20,
              padding: 18,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Season Position Tracker</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {currentSeasonBalance.map(({ player, totalAssigned, totals }) => (
                <div
                  key={player}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(90px, 1fr) auto",
                    alignItems: "center",
                    gap: 10,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    paddingBottom: 6,
                  }}
                >
                  <strong>{player}</strong>
                  <span style={{ color: "#7bd3ff" }}>{totalAssigned} quarters</span>
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {POSITION_ORDER.map((position) => (
                      <span
                        key={`${player}-${position}`}
                        style={{
                          fontSize: 12,
                          background: "rgba(123,211,255,0.08)",
                          borderRadius: 999,
                          padding: "4px 8px",
                        }}
                      >
                        {position}: {totals[position]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "rgba(11, 26, 38, 0.68)",
              border: "1px solid rgba(123, 211, 255, 0.22)",
              borderRadius: 20,
              padding: 18,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Current Match</h3>
            {generatedLineup.length === 0 ? (
              <p style={{ color: "#bfe9ff", opacity: 0.8 }}>
                Generate a lineup to see the quarter-by-quarter plan here.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {generatedLineup.map((quarter) => {
                  const assignmentsByPosition = quarter.players.reduce<Record<Position, string[]>>(
                    (acc, player) => {
                      acc[player.position] = [...(acc[player.position] ?? []), player.name];
                      return acc;
                    },
                    { Goalie: [], Defender: [], Midfielder: [], Forward: [] },
                  );

                  const slotCounts: Record<Position, number> = {
                    Goalie: 0,
                    Defender: 0,
                    Midfielder: 0,
                    Forward: 0,
                  };
                  const substitutes = players.filter(
                    (player) => !quarter.players.some((assignment) => assignment.name === player),
                  );

                  return (
                    <div
                      key={quarter.quarter}
                      style={{
                        border: "1px solid rgba(123, 211, 255, 0.25)",
                        borderRadius: 14,
                        padding: 12,
                        background: "rgba(5, 25, 36, 0.7)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <strong>{QUARTER_NAMES[quarter.quarter - 1]}</strong>
                      </div>

                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          height: 260,
                          borderRadius: 16,
                          border: "1px solid rgba(123,211,255,0.25)",
                          background:
                            "radial-gradient(circle at center, rgba(13,104,142,0.28) 0%, rgba(3,27,45,0.8) 68%, rgba(2,16,28,1) 100%)",
                          overflow: "hidden",
                        }}
                      >
                        {PITCH_LAYOUT.map((slot) => {
                          const positionIndex = slotCounts[slot.position];
                          slotCounts[slot.position] += 1;
                          const names = assignmentsByPosition[slot.position] ?? [];
                          const displayName = names[positionIndex] ?? "-";

                          return (
                            <div
                              key={`${quarter.quarter}-${slot.position}-${positionIndex}`}
                              style={{
                                position: "absolute",
                                left: slot.left,
                                top: slot.top,
                                transform: "translate(-50%, -50%)",
                                minWidth: 90,
                                padding: "6px 8px",
                                borderRadius: 18,
                                background: "rgba(3, 27, 45, 0.8)",
                                border: "1px solid rgba(123,211,255,0.35)",
                                color: "#eaf8ff",
                                textAlign: "center",
                                fontSize: 11,
                                lineHeight: 1.2,
                                boxShadow: "0 8px 16px rgba(3,27,45,0.35)",
                              }}
                            >
                              <div style={{ fontWeight: 700, fontSize: 10, color: "#7bd3ff" }}>{slot.position}</div>
                              <div>{displayName}</div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: "#7bd3ff", marginBottom: 6, fontWeight: 700 }}>
                          Substitutes
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {substitutes.length === 0 ? (
                            <span style={{ color: "#bfe9ff", opacity: 0.7, fontSize: 12 }}>None</span>
                          ) : (
                            substitutes.map((player) => (
                              <span
                                key={`${quarter.quarter}-sub-${player}`}
                                style={{
                                  background: "rgba(123,211,255,0.08)",
                                  border: "1px solid rgba(123,211,255,0.2)",
                                  borderRadius: 999,
                                  padding: "4px 8px",
                                  fontSize: 11,
                                  color: "#eaf8ff",
                                }}
                              >
                                {player}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div style={{ color: "#bfe9ff" }}>Game {gameNumber}</div>
          <button
            onClick={resetSeason}
            style={{
              background: "transparent",
              color: "#eaf8ff",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 12,
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            Reset Season
          </button>
        </div>

        {savedGames.length > 0 && (
          <section
            style={{
              background: "rgba(11, 26, 38, 0.68)",
              border: "1px solid rgba(123, 211, 255, 0.22)",
              borderRadius: 20,
              padding: 18,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Saved Games</h3>
            <div style={{ display: "grid", gap: 12 }}>
              {savedGames.slice().reverse().map((game) => (
                <div
                  key={game.id}
                  style={{
                    border: "1px solid rgba(123,211,255,0.18)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <strong>Game {game.gameNumber}</strong>
                  <div style={{ marginTop: 8, color: "#bfe9ff" }}>
                    {game.generatedAt}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {game.lineup.map((quarter) => (
                      <span
                        key={`${game.id}-${quarter.quarter}`}
                        style={{
                          background: "rgba(28,200,167,0.08)",
                          borderRadius: 999,
                          padding: "4px 8px",
                          fontSize: 12,
                        }}
                      >
                        {QUARTER_NAMES[quarter.quarter - 1]}: {quarter.goalie}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  return <GamePlanHistory />;
}
