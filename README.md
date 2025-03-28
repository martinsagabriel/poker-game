# Web Poker Game (JS, HTML, CSS)

A simple Texas Hold'em poker game playable in a web browser, built entirely with vanilla JavaScript, HTML, and CSS. It features one human player against three basic AI opponents.

## Features

*   **Texas Hold'em Gameplay:** Implements the basic flow of Texas Hold'em (Blinds, Preflop, Flop, Turn, River, Showdown).
*   **1 Human vs 3 AI Players:** Play against three computer-controlled opponents.
*   **Basic AI:** The AI players have a simple logic for folding, calling, checking, and making basic bets/raises.
*   **Visual Interface:** A poker table layout created with CSS, showing player pods, chips, community cards, and player hands (human's visible, AI's hidden until showdown).
*   **Action Controls:** Buttons for Fold, Check/Call, Bet/Raise, and an input field for bet amounts.
*   **Quick Bet Buttons:** Buttons for quick betting actions (Min, 1/2 Pot, Pot, Max/All-in).
*   **Simplified Hand Evaluation:** Includes basic logic to determine the winning hand at showdown (Note: Hand evaluation logic is currently simplified and might not cover all edge cases or complex comparisons perfectly).
*   **Rules Page:** A separate page (`rules.html`) explaining poker hand rankings and basic rules, with language switching between English and Portuguese.
*   **No Dependencies:** Runs directly in the browser without needing any external libraries, frameworks, or build steps.

## Technologies Used

*   HTML5
*   CSS3
*   Vanilla JavaScript (ES6+)

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   A modern web browser (like Chrome, Firefox, Edge, Safari).
*   Git (optional, for cloning the repository).

### Installation & Setup

1.  **Clone the repository (if using Git):**
    ```bash
    git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git
    ```
    *(Replace `YOUR_USERNAME/YOUR_REPOSITORY_NAME` with the actual path to your repository if you upload it to GitHub).*

    **OR**

    **Download the ZIP:**
    If you downloaded the code as a ZIP file from GitHub or another source, simply extract the contents to a folder on your computer.

2.  **Navigate to the directory:**
    Open your terminal or command prompt and change into the project directory:
    ```bash
    cd YOUR_REPOSITORY_NAME
    ```
    *(Or navigate to the extracted folder using your file explorer).*

3.  **No Dependencies:** There are no further installation steps required!

## How to Run the Game

1.  **Open the Game:** Navigate to the project folder in your file explorer and double-click the `index.html` file. This should open the game directly in your default web browser.
    *   *(Optional: For a better development experience, you can use a simple local web server or a browser extension like "Live Server" for VS Code, but it's not strictly necessary to run the game).*

2.  **Play:**
    *   The game will start automatically. Blinds will be posted, and cards dealt.
    *   When it's your turn (your player pod will be highlighted), the action buttons at the bottom will become active.
    *   Use the buttons (Fold, Check/Call, Bet/Raise) or the Quick Bet buttons (Min, 1/2 Pot, Pot, Max) and the input field to make your move.
    *   The AI players will take their turns automatically after a short delay.
    *   Follow the game progress in the log area at the bottom.

3.  **View the Rules:**
    *   Click the "Regras do Jogo" (Game Rules) button in the top-right corner of the game page (`index.html`). This will open the `rules.html` page in a new browser tab.
    *   On the rules page, you can switch between English and Portuguese using the buttons provided.


## Contributing

Contributions are welcome! If you have suggestions or find bugs, please feel free to:
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` file for more information (if you create one).

---