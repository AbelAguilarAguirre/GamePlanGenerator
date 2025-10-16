# Soccer Lineup Generator

A web application built with **Next.js**, **React**, and **TypeScript** that helps soccer coaches and organizers generate fair and balanced lineups for games. This app allows you to track player positions, manage rotations, and ensure each player gets a fair amount of playing time.

---

## Features

-   **Dynamic Player Management**:  
    Add, remove, or edit players and their position preferences (Goalie, Defender, Midfielder, Forward).

-   **Active/Inactive Players**:  
    Toggle player availability to exclude players who won’t be at the game.

-   **Customizable Game Settings**:  
    Adjust maximum and minimum quarters per game, and the number of players per position.

-   **Automatic Lineup Generation**:  
    Generates lineups for each quarter while ensuring fair rotation and adherence to minimum/maximum playtime.

-   **Substitutes Included**:  
    Players not assigned to a position are automatically added as substitutes.

-   **Game Plan History**:  
    Stores previously generated lineups in local storage, so you can review past game plans.

-   **Mobile-Friendly UI**:  
    Tables are scrollable on small screens and buttons adapt to mobile devices.

-   **Confirmation on Clear**:  
    Prevents accidental clearing of saved data with a confirmation dialog.

-   **Visual Tracking**:  
    Shows how many quarters each player has played in the current game, highlighting players under the minimum.

---

## Screenshots

_Optional: Add screenshots of your app here_

---

## Getting Started

### Prerequisites

-   Node.js (>= 18.x recommended)
-   npm or yarn
-   Next.js project setup

### Installation

1. Clone this repository:

```bash
git clone https://github.com/yourusername/soccer-lineup-generator.git
cd soccer-lineup-generator
```
