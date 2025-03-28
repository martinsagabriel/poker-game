/**
 * poker-logic.js
 * Lógica central para um jogo de Poker Texas Hold'em
 * Foco: Gerenciamento do estado do jogo, ações, jogadores (1 humano, 3 IA)
 * Inclui callback de atualização da UI e lógica de avaliação de mãos robusta.
 */

// --- Constantes ---
const SUITS = ["H", "D", "C", "S"]; // Copas, Ouros, Paus, Espadas
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]; // T=10
// Índices correspondem aos valores retornados por _evaluateSingle5CardHand
const HAND_RANKS = [
    "High Card",        // 0
    "One Pair",         // 1
    "Two Pair",         // 2
    "Three of a Kind",  // 3
    "Straight",         // 4
    "Flush",            // 5
    "Full House",       // 6
    "Four of a Kind",   // 7
    "Straight Flush",   // 8
    "Royal Flush"       // 9
];

const STARTING_CHIPS = 1000;
const SMALL_BLIND_AMOUNT = 10;
const BIG_BLIND_AMOUNT = 20; // Também usado como aposta mínima padrão

// --- Classes ---

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.value = this._getRankValue(rank); // Valor numérico (2-14)
    }

    _getRankValue(rank) {
        if ("23456789".includes(rank)) return parseInt(rank);
        if (rank === "T") return 10;
        if (rank === "J") return 11;
        if (rank === "Q") return 12;
        if (rank === "K") return 13;
        if (rank === "A") return 14; // Ás alto por padrão
        return 0;
    }

    // Formato interno/lógico (ex: AH, TD, 2C)
    toString() {
        return `${this.rank}${this.suit}`;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
        this.shuffle();
    }

    reset() {
        this.cards = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push(new Card(suit, rank));
            }
        }
    }

    shuffle() {
        // Algoritmo Fisher-Yates (Knuth Shuffle)
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    dealCard() {
        return this.cards.pop();
    }

    get cardCount() {
        return this.cards.length;
    }
}

class Player {
    constructor(id, name, isHuman = false, chips = STARTING_CHIPS) {
        this.id = id;
        this.name = name;
        this.isHuman = isHuman;
        this.chips = chips;
        this.hand = []; // Cartas na mão (Card objects)
        this.currentBet = 0; // Aposta na ação atual
        this.totalBetInRound = 0; // Total apostado nesta FASE (preflop, flop, etc.)
        this.status = 'waiting'; // waiting, active, folded, all-in, out
        this.evaluationResult = null; // Resultado de _evaluateBestHand { rankIndex, hand, description, significantRanks }
        this.hasActedInRound = false; // Flag para controle de fim de rodada
        this.isLastAggressor = false; // Flag para controle de fim de rodada
    }

    resetForNewHand() {
        this.hand = [];
        this.currentBet = 0;
        this.totalBetInRound = 0;
        this.evaluationResult = null;
        this.hasActedInRound = false;
        this.isLastAggressor = false;
        if (this.chips > 0) {
            this.status = 'waiting';
        } else {
            this.status = 'out';
        }
    }

    addChips(amount) {
        this.chips += amount;
    }

    removeChips(amount) {
        const removed = Math.min(amount, this.chips);
        this.chips -= removed;
        return removed;
    }

    prepareToAction() {
        if (this.chips > 0 && this.status !== 'folded' && this.status !== 'all-in' && this.status !== 'out') {
            this.status = 'active';
        }
    }
}

class PokerGame {
    constructor(playerNames = ["Player 1", "Player 2", "Player 3", "Player 4"], uiUpdateCallback = null) {
        this.players = [];
        this.players.push(new Player(0, playerNames[0] || "Human", true));
        for (let i = 1; i < 4; i++) {
            this.players.push(new Player(i, playerNames[i] || `AI ${i}`, false));
        }

        this.deck = new Deck();
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0; // A maior aposta feita na rodada que precisa ser coberta
        this.minRaise = BIG_BLIND_AMOUNT; // O valor ADICIONAL mínimo para um raise
        this.dealerButtonIndex = -1;
        this.currentPlayerIndex = -1;
        this.currentPhase = 'idle'; // idle, preflop, flop, turn, river, showdown, gameOver
        this.log = [];
        this.uiUpdateCallback = uiUpdateCallback;
        this._subPots = []; // Não implementado em detalhe
        this._roundActionCounter = 0;
        this._lastRaiserId = -1; // ID do último a fazer bet/raise
    }

    _logEvent(message) {
        console.log(message);
        this.log.push(message);
        
        if (this.log.length > 200) this.log.shift(); // Limita tamanho do log
    }

    _triggerUIUpdate() {
        if (this.uiUpdateCallback) {
            // Adiciona um pequeno delay para garantir que o DOM possa ser atualizado
            // sem ser interrompido por outra ação imediata (especialmente IA)
            setTimeout(() => {
                try {
                     this.uiUpdateCallback(this.getGameState());
                } catch (e) {
                     console.error("Erro durante o callback de atualização da UI:", e)
                }
            }, 0); // Timeout 0 executa assim que a pilha atual estiver vazia
        }
    }

    // --- Gerenciamento do Jogo ---

    startNewHand() {
        const playersWithChips = this.players.filter(p => p.chips > 0);
        if (playersWithChips.length < 2) {
            this._logEvent("Não há jogadores suficientes com fichas para continuar.");
            this.currentPhase = 'gameOver';
            this._triggerUIUpdate();
            return;
        }

        this._logEvent("--- Iniciando Nova Mão ---");
        this.deck.reset();
        this.deck.shuffle();
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.minRaise = BIG_BLIND_AMOUNT;
        this._subPots = [];
        this._roundActionCounter = 0;
        this._lastRaiserId = -1;

        this.players.forEach(player => player.resetForNewHand());

        const activePlayersInGame = this.players.filter(p => p.status !== 'out');
        if (activePlayersInGame.length < 2) {
            this._logEvent("Erro inesperado: Menos de 2 jogadores ativos após reset.");
            this.currentPhase = 'gameOver';
            this._triggerUIUpdate();
            return;
        }

        this.dealerButtonIndex = this._getNextPlayerIndex(this.dealerButtonIndex, activePlayersInGame);
        const sbIndex = this._getNextPlayerIndex(this.dealerButtonIndex, activePlayersInGame);
        const bbIndex = this._getNextPlayerIndex(sbIndex, activePlayersInGame);

        this._postBlind(sbIndex, SMALL_BLIND_AMOUNT, "Small Blind");
        this._postBlind(bbIndex, BIG_BLIND_AMOUNT, "Big Blind");
        this._lastRaiserId = this.players[bbIndex]?.id ?? -1;
        this.players.forEach(p => p.isLastAggressor = (p.id === this._lastRaiserId));

        this.currentBet = BIG_BLIND_AMOUNT;
        this.currentPlayerIndex = this._getNextPlayerIndex(bbIndex, activePlayersInGame);

        this._dealPrivateCards();

        activePlayersInGame.forEach(p => {
            if (p.status !== 'all-in' && p.status !== 'out') p.prepareToAction();
            p.hasActedInRound = (p.id === this.players[sbIndex]?.id || p.id === this.players[bbIndex]?.id);
        });

        this.currentPhase = 'preflop';
        this._logEvent(`Fase: Preflop. Dealer é ${this.players[this.dealerButtonIndex]?.name}. ${this.players[sbIndex]?.name} posta SB(${SMALL_BLIND_AMOUNT}). ${this.players[bbIndex]?.name} posta BB(${BIG_BLIND_AMOUNT}).`);

        // Pula jogadores que já estão fora/all-in/folded até encontrar um ativo
        let safety = 0;
        while (this.players[this.currentPlayerIndex]?.status !== 'active' && safety < this.players.length * 2) {
             const currentStatus = this.players[this.currentPlayerIndex]?.status;
             if (currentStatus === 'out' || currentStatus === 'folded' || currentStatus === 'all-in') {
                 const nextIdx = this._getNextPlayerIndex(this.currentPlayerIndex, this._getPlayersInHand());
                 if (nextIdx === this.currentPlayerIndex || nextIdx === -1) {
                      this._logEvent("Não há jogadores ativos para iniciar a aposta, avançando.");
                      this._endBettingRound();
                      return;
                 }
                 this.currentPlayerIndex = nextIdx;
                 this.players[this.currentPlayerIndex].prepareToAction(); // Prepara o próximo encontrado
             } else {
                  // Jogador está 'waiting', prepara para 'active'
                   this.players[this.currentPlayerIndex].prepareToAction();
                  break; // Encontrou um jogador 'waiting' ou 'active'
             }
              safety++;
               if(safety >= this.players.length * 2) {
                   console.error("Loop infinito ao encontrar primeiro jogador pré-flop");
                    this._endBettingRound(); // Tenta terminar a rodada como fallback
                    return;
               }
        }


        this._logEvent(`Vez de: ${this.players[this.currentPlayerIndex]?.name}`);
        this._triggerUIUpdate();
        this._checkAndTriggerAIAction();
    }

    _postBlind(playerIndex, amount, blindType) {
        const player = this.players[playerIndex];
        if (!player || player.status === 'out') return;
        const blindAmount = player.removeChips(amount);
        player.currentBet = blindAmount;
        player.totalBetInRound = blindAmount;
        this.pot += blindAmount;
        this._logEvent(`${player.name} posta ${blindType} de ${blindAmount}`);
        if (player.chips === 0) {
            player.status = 'all-in';
            this._logEvent(`${player.name} está all-in com o blind.`);
        }
    }

    _dealPrivateCards() {
        this._logEvent("Distribuindo cartas...");
        const activePlayers = this.players.filter(p => p.status !== 'out');
        const startIndex = this._getNextPlayerIndex(this.dealerButtonIndex, activePlayers);
        let currentDealIndex = startIndex;
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < activePlayers.length; j++) {
                 const player = this.players[currentDealIndex];
                 if (player && player.status !== 'out') {
                     const card = this.deck.dealCard();
                     if (card) player.hand.push(card);
                     else { console.error("Baralho vazio!"); return; }
                 }
                 currentDealIndex = this._getNextPlayerIndex(currentDealIndex, activePlayers);
                 if(currentDealIndex === -1) { // Segurança
                      console.error("Erro ao obter próximo jogador na distribuição");
                      return;
                 }
            }
        }
    }

    // --- Lógica de Ação do Jogador ---
    handleAction(playerId, action, amount = 0) {
        const player = this.players.find(p => p.id === playerId);
        const currentPlayer = this.players[this.currentPlayerIndex];

        if (!player || player.id !== currentPlayer?.id) {
            this._logEvent(`Ação inválida: Não é a vez de ${player?.name ?? 'ID desconhecido'}. É a vez de ${currentPlayer?.name ?? 'Ninguém'}.`);
            return false;
        }
        if (player.status !== 'active') {
            this._logEvent(`Ação inválida: ${player.name} não está ativo (status: ${player.status}).`);
            return false;
        }

        let isValidAction = false;
        const amountToCall = this.currentBet - player.totalBetInRound;
        let actionDescription = "";
        let performMove = true;

        // Resetar flag de último agressor antes de processar a nova ação
        // Somente a ação agressiva (bet/raise) definirá a flag
        player.isLastAggressor = false;

        switch (action.toLowerCase()) {
            case 'fold':
                player.status = 'folded';
                actionDescription = `${player.name} desiste (fold).`;
                isValidAction = true;
                break;

            case 'check':
                if (amountToCall > 0) {
                    actionDescription = `Ação inválida: ${player.name} não pode dar check, precisa pagar ${amountToCall}.`;
                    performMove = false;
                } else {
                    actionDescription = `${player.name} passa (check).`;
                    isValidAction = true;
                }
                break;

            case 'call':
                if (amountToCall <= 0) {
                    actionDescription = `${player.name} passa (check) - (Call sem aposta pendente).`;
                    isValidAction = true;
                } else {
                    const callAmount = Math.min(amountToCall, player.chips);
                    player.removeChips(callAmount);
                    player.currentBet = callAmount;
                    player.totalBetInRound += callAmount;
                    this.pot += callAmount;
                    actionDescription = `${player.name} paga (call) ${callAmount}.`;
                    if (player.chips === 0) {
                        player.status = 'all-in';
                        actionDescription += ` e está all-in.`;
                    }
                    isValidAction = true;
                }
                break;

            case 'bet':
                const isEffectivelyCheck = amountToCall <= 0;
                if (!isEffectivelyCheck) {
                    actionDescription = `Ação inválida: ${player.name} não pode apostar (bet), use call ou raise.`;
                    performMove = false;
                } else if (amount <= 0) {
                    actionDescription = `Ação inválida: ${player.name} - valor da aposta deve ser positivo.`;
                    performMove = false;
                } else if (amount < this.minRaise && player.chips > amount) {
                    actionDescription = `Ação inválida: ${player.name} - aposta mínima é ${this.minRaise}.`;
                    performMove = false;
                } else if (amount > player.chips) {
                    actionDescription = `Ação inválida: ${player.name} não tem fichas suficientes para apostar ${amount}.`;
                    performMove = false;
                } else {
                    const betAmount = player.removeChips(amount);
                    player.currentBet = betAmount;
                    player.totalBetInRound = betAmount;
                    this.pot += betAmount;
                    this.currentBet = player.totalBetInRound;
                    this.minRaise = betAmount; // A própria aposta define o próximo raise mínimo ADICIONAL
                    this._lastRaiserId = player.id; // <<< Define quem foi o último agressor
                    this.players.forEach(p => p.isLastAggressor = (p.id === player.id)); // <<< Atualiza flag em todos
                    player.isLastAggressor = true; // Garante que o próprio jogador saiba
                    actionDescription = `${player.name} aposta (bet) ${betAmount}.`;
                    if (player.chips === 0) {
                        player.status = 'all-in';
                        actionDescription += ` e está all-in.`;
                    }
                    isValidAction = true;
                }
                break;

            case 'raise':
                const totalAfterRaise = amount;
                const raiseAmount = totalAfterRaise - player.totalBetInRound; // Quanto a mais está colocando
                const amountNeeded = amountToCall + raiseAmount; // Total a ser adicionado nesta jogada

                if (amountToCall <= 0) {
                    actionDescription = `Ação inválida: ${player.name} não pode dar raise, use bet.`;
                    performMove = false;
                } else if (raiseAmount <= 0) {
                    actionDescription = `Ação inválida: ${player.name} - o valor do raise (${totalAfterRaise}) deve ser maior que a aposta atual (${player.totalBetInRound}).`;
                    performMove = false;
                 } else if (raiseAmount < this.minRaise && player.chips > amountNeeded) { // Permite all-in menor
                     actionDescription = `Ação inválida: ${player.name} - aumento mínimo (raise) precisa ser de ${this.minRaise} a mais (totalizando ${this.currentBet + this.minRaise}). Tentou aumentar ${raiseAmount}.`;
                     performMove = false;
                 } else if (amountNeeded > player.chips) {
                    actionDescription = `Ação inválida: ${player.name} não tem fichas suficientes para aumentar para ${totalAfterRaise}. Tem ${player.chips}, precisa ${amountNeeded}.`;
                    performMove = false;
                 } else {
                    player.removeChips(amountNeeded);
                    player.currentBet = amountNeeded;
                    player.totalBetInRound = totalAfterRaise;
                    this.pot += amountNeeded;
                    this.currentBet = player.totalBetInRound;
                    this.minRaise = raiseAmount; // O valor ADICIONAL do raise define o próximo minRaise
                    this._lastRaiserId = player.id; // <<< Define quem foi o último agressor
                     this.players.forEach(p => p.isLastAggressor = (p.id === player.id)); // <<< Atualiza flag em todos
                     player.isLastAggressor = true; // Garante que o próprio jogador saiba
                    actionDescription = `${player.name} aumenta (raise) para ${totalAfterRaise}.`;
                    if (player.chips === 0) {
                        player.status = 'all-in';
                        actionDescription += ` e está all-in.`;
                    }
                    isValidAction = true;
                 }
                break;

            default:
                actionDescription = `Ação desconhecida: ${action}`;
                performMove = false;
                break;
        }

        this._logEvent(actionDescription);

        if (isValidAction) {
            player.hasActedInRound = true;
            this._roundActionCounter++;
            if (performMove) {
                 // Adia a chamada para _moveToNextPlayer para garantir que a UI possa atualizar ANTES
                 setTimeout(() => this._moveToNextPlayer(), 50); // Pequeno delay
                 // Atualiza a UI imediatamente para mostrar a ação do jogador atual
                 this._triggerUIUpdate();
            } else {
                 this._triggerUIUpdate(); // Atualiza mesmo se não mover (ex: erro para humano)
            }
            return true;
        } else {
            if (!player.isHuman) {
                this._logEvent(`IA ${player.name} tentou ação inválida. Tentando ação segura...`);
                 const canCheck = (this.currentBet - player.totalBetInRound) <= 0;
                 if (canCheck) setTimeout(() => this.handleAction(playerId, 'check'), 50); // Delay para não sobrecarregar
                 else if (player.chips > 0) setTimeout(() => this.handleAction(playerId, 'call'), 50);
                 else setTimeout(() => this.handleAction(playerId, 'fold'), 50); // Sem fichas, força fold
            } else {
                 this._triggerUIUpdate(); // Atualiza para humano tentar de novo
            }
            return false;
        }
    }


    // --- Controle de Fluxo do Jogo ---

    _getPlayersInHand(includeFolded = false) {
        return this.players.filter(p =>
            p.status !== 'out' && (includeFolded || p.status !== 'folded')
        );
    }

    _getActingPlayers() {
        return this.players.filter(p => p.status === 'active');
    }

    _getNextPlayerIndex(currentIndex, playerPool) {
        if (!playerPool || playerPool.length === 0) return -1;
        let attempts = 0;
        let nextIndex = currentIndex;
        do {
            nextIndex = (nextIndex + 1) % this.players.length;
            const nextPlayer = this.players[nextIndex];
            if (playerPool.some(p => p.id === nextPlayer.id)) {
                return nextIndex;
            }
            attempts++;
        } while (attempts <= this.players.length);
        console.warn("Não foi possível encontrar o próximo jogador no pool especificado.");
        return -1;
    }

    _moveToNextPlayer() {
        const playersStillInHand = this._getPlayersInHand();
        if (playersStillInHand.length <= 1) {
            this._logEvent("Apenas um jogador (ou nenhum) restante na mão.");
            this._awardPotToWinner(playersStillInHand);
            return;
        }

        const bettingRoundEnded = this._checkBettingRoundEnd();
        if (bettingRoundEnded) {
            this._endBettingRound();
        } else {
            let nextPlayerIndex = this.currentPlayerIndex;
            let nextPlayer = null;
            let safetyCounter = 0;
            do {
                nextPlayerIndex = this._getNextPlayerIndex(nextPlayerIndex, playersStillInHand);
                 if (nextPlayerIndex === -1 || safetyCounter > this.players.length * 2) {
                      console.error("Erro ao encontrar próximo jogador para agir. Forçando fim da rodada.");
                      this._endBettingRound();
                      return;
                 }
                 nextPlayer = this.players[nextPlayerIndex];
                 safetyCounter++;
            } while (nextPlayer.status === 'all-in' || nextPlayer.status === 'folded');

            this.currentPlayerIndex = nextPlayerIndex;
            nextPlayer.prepareToAction();
            this._logEvent(`Vez de: ${nextPlayer.name}`);
            this._triggerUIUpdate();
            this._checkAndTriggerAIAction();
        }
    }

    _checkBettingRoundEnd() {
        const playersInHand = this._getPlayersInHand();
        const actingPlayers = playersInHand.filter(p => p.status !== 'all-in'); // Que podem tomar decisões

        if (actingPlayers.length < 2) {
            if (playersInHand.length > 1) {
                 this._logEvent("Rodada de apostas encerrada (jogadores restantes estão all-in ou só há um ativo).");
                 return true;
            } else {
                 return true; // Mão já acabou, _moveToNextPlayer tratará
            }
        }

        // Verifica se todos que podem agir já agiram E igualaram a aposta máxima
        const highestBetInRound = this.currentBet; // A aposta a ser coberta
        const allEligibleActedAndMatched = actingPlayers.every(p =>
               p.hasActedInRound && p.totalBetInRound === highestBetInRound
        );

        // A rodada só pode terminar se houve aposta ou se todos deram check/passaram
        const bettingOccurred = highestBetInRound > 0;
        const allCheckedAround = highestBetInRound === 0 && actingPlayers.every(p => p.hasActedInRound);

        // Condição especial pré-flop: BB pode dar check para encerrar se ninguém aumentou
        const isPreflop = this.currentPhase === 'preflop';
        const currentPlayer = this.players[this.currentPlayerIndex];
        const bbCanEndRoundWithCheck = isPreflop &&
                                       currentPlayer?.totalBetInRound === BIG_BLIND_AMOUNT && // É o BB?
                                       highestBetInRound === BIG_BLIND_AMOUNT && // Ninguém aumentou?
                                       actingPlayers.every(p => p.hasActedInRound); // Todos já agiram?


        if ((bettingOccurred && allEligibleActedAndMatched) || allCheckedAround || bbCanEndRoundWithCheck ) {
            // Última verificação: Se o último jogador a agir foi o agressor (bet/raise),
            // a rodada NÃO termina ainda, a menos que todos os outros estejam all-in/folded.
            // Isso permite que a ação dê uma volta completa.
            // Usamos _lastRaiserId para saber quem foi o último a fazer bet/raise.
            const lastPlayer = this.players.find(p => p.id === this._lastRaiserId);

            // Se houve um agressor nesta rodada e a ação AINDA NÃO voltou para ele (ou para quem está logo após ele)
            // E ainda há mais de um jogador ativo
            // -> a rodada NÃO acabou.

            // Simplificação: A rodada termina se:
            // 1. Todos ativos igualaram a aposta atual (this.currentBet)
            // 2. E todos ativos já agiram (p.hasActedInRound)
            // (A lógica de _moveToNextPlayer garante a volta completa)

            this._logEvent("Todos igualaram ou estão all-in/folded. Rodada de apostas encerrada.");
            return true;
        }

        return false;
    }


    _endBettingRound() {
        this._logEvent(`--- Fim da Rodada de Apostas (${this.currentPhase}) ---`);
        this._logEvent(`Pote Total: ${this.pot}`);

        // Coleta apostas da rodada (importante para side pots no futuro)
        // Por enquanto, apenas reseta para a próxima
        this.currentBet = 0;
        this.minRaise = BIG_BLIND_AMOUNT;
        this._roundActionCounter = 0;
        this._lastRaiserId = -1;
        this.players.forEach(p => {
            p.currentBet = 0;
            // NÃO zerar totalBetInRound aqui - pode ser útil para side pots
            p.hasActedInRound = false;
            p.isLastAggressor = false;
        });

        const playersToShowdown = this._getPlayersInHand();
        const playersWhoCanBet = playersToShowdown.filter(p => p.status !== 'all-in');

        let nextPhase = '';
        switch (this.currentPhase) {
            case 'preflop': nextPhase = 'flop'; break;
            case 'flop': nextPhase = 'turn'; break;
            case 'turn': nextPhase = 'river'; break;
            case 'river': nextPhase = 'showdown'; break;
            default: nextPhase = 'idle'; break;
        }

        if (nextPhase !== 'showdown' && playersWhoCanBet.length >= 2) {
            this._dealCommunityCards(nextPhase, true);
        } else if (nextPhase !== 'showdown') {
            this._logEvent("Jogadores all-in ou apenas um ativo. Revelando cartas restantes...");
             let currentPhaseForDealing = this.currentPhase;
             while(currentPhaseForDealing !== 'river') {
                  let phaseToDeal = '';
                  if (currentPhaseForDealing === 'preflop') phaseToDeal = 'flop';
                  else if (currentPhaseForDealing === 'flop') phaseToDeal = 'turn';
                  else if (currentPhaseForDealing === 'turn') phaseToDeal = 'river';
                  if (phaseToDeal) {
                       this._dealCommunityCards(phaseToDeal, false); // Apenas distribui
                       currentPhaseForDealing = phaseToDeal;
                       if (this.deck.cardCount === 0 && currentPhaseForDealing !== 'river') break;
                  } else break;
             }
              // Adia o showdown para garantir que a última carta seja exibida
             setTimeout(() => this._showdown(), 100);
        } else {
            this._showdown();
        }
    }

    _dealCommunityCards(phase, startBettingRound = true) {
        const numPlayersInHand = this._getPlayersInHand().length;
        if (numPlayersInHand <= 1 && this.currentPhase !== 'idle') {
            this._logEvent("Apenas um jogador restante, pulando para o final da mão.");
            this._awardPotToWinner(this._getPlayersInHand());
            return;
        }

        if (this.deck.cardCount > 0) {
            this.deck.dealCard(); // Burn card
        } else if (this.communityCards.length < 5) {
             console.error("Baralho vazio antes de queimar carta para ", phase);
             // Continua para showdown mesmo assim
        }

        let cardsToDeal = 0;
        let expectedCommunitySize = 0;
        if (phase === 'flop') { cardsToDeal = 3; expectedCommunitySize = 0; }
        else if (phase === 'turn') { cardsToDeal = 1; expectedCommunitySize = 3; }
        else if (phase === 'river') { cardsToDeal = 1; expectedCommunitySize = 4; }

        if (cardsToDeal === 0 || this.communityCards.length !== expectedCommunitySize) {
            console.error("Tentativa de distribuir cartas comunitárias em fase/estado inválido:", phase, this.communityCards.length);
            if (this.currentPhase !== 'river' && this.currentPhase !== 'showdown') this._showdown();
            return;
        }

        this.currentPhase = phase;
        const dealtCards = [];
        for (let i = 0; i < cardsToDeal; i++) {
            if (this.deck.cardCount > 0) {
                const card = this.deck.dealCard();
                this.communityCards.push(card);
                dealtCards.push(card.toString());
            } else {
                console.error("Baralho vazio durante distribuição para", phase);
                this._logEvent(`Baralho vazio! ${phase} incompleto.`);
                break;
            }
        }
        this._logEvent(`--- ${phase.toUpperCase()} --- Cartas Comunitárias: ${this.communityCards.map(c=>c.toString()).join(', ')}`);

        const playersWhoCanBet = this._getPlayersInHand().filter(p => p.status !== 'all-in');
        if (startBettingRound && playersWhoCanBet.length >= 2) {
            this._logEvent("Iniciando rodada de apostas.");
            // Reseta apostas da rodada anterior e flags de ação para a nova rodada
             this.players.forEach(p => {
                 p.totalBetInRound = 0; // Zera para a nova fase
                 p.hasActedInRound = false;
                 p.isLastAggressor = false;
             });
             this._roundActionCounter = 0;
             this._lastRaiserId = -1;


            let firstToActIndex = -1;
            let potentialIndex = this.dealerButtonIndex;
            let loopGuard = 0;
            do {
                 potentialIndex = this._getNextPlayerIndex(potentialIndex, playersWhoCanBet);
                  if(potentialIndex !== -1) {
                      firstToActIndex = potentialIndex;
                      break;
                  }
                  loopGuard++;
            } while(loopGuard <= this.players.length)

            if (firstToActIndex !== -1) {
                this.currentPlayerIndex = firstToActIndex;
                this.players[firstToActIndex].prepareToAction();
                this._logEvent(`Vez de: ${this.players[firstToActIndex].name}`);
                this._triggerUIUpdate();
                this._checkAndTriggerAIAction();
            } else {
                 console.error("Não foi possível determinar o primeiro a agir após distribuir cartas.");
                 this._showdown();
            }
        } else {
              this._triggerUIUpdate(); // Atualiza para mostrar novas cartas mesmo sem apostas
              // O fluxo continuará de _endBettingRound se startBettingRound for false
        }
    }

    // --- Showdown e Avaliação de Mãos (VERSÕES CORRIGIDAS/ROBUSTAS) ---

    _showdown() {
        this.currentPhase = 'showdown';
        this._logEvent("--- SHOWDOWN ---");
        const contenders = this._getPlayersInHand();

        if (contenders.length === 0) {
            this._logEvent("Erro: Nenhum jogador no showdown.");
             this._triggerUIUpdate();
             setTimeout(() => this.startNewHand(), 5000);
            return;
        }
        if (contenders.length === 1) {
            this._logEvent(`${contenders[0].name} é o único restante.`);
            this._awardPotToWinner(contenders);
            return;
        }

        this._logEvent("Revelando mãos e avaliando:");
        let overallBestEval = null;

        contenders.forEach(player => {
            const allSevenCards = [...player.hand, ...this.communityCards];
            // Avalia a melhor mão E armazena o resultado no jogador
            player.evaluationResult = this._evaluateBestHand(allSevenCards);

            if (player.evaluationResult.rankIndex === -1) {
                 this._logEvent(`${player.name}: Erro ao avaliar mão.`);
                 return; // Pula jogador com erro
            }

            this._logEvent(`${player.name}: Mão [${player.hand.map(c=>c.toString()).join(', ')}] -> ${player.evaluationResult.description} (${player.evaluationResult.hand ? player.evaluationResult.hand.map(c=>c.toString()).join(', ') : 'N/A'})`);

             // Acompanha a melhor avaliação geral encontrada
             if (!overallBestEval ||
                 player.evaluationResult.rankIndex > overallBestEval.rankIndex ||
                 (player.evaluationResult.rankIndex === overallBestEval.rankIndex &&
                  this._compareSignificantRanks(player.evaluationResult.significantRanks, overallBestEval.significantRanks) > 0))
             {
                  overallBestEval = player.evaluationResult;
             }
        });

        if (!overallBestEval) {
             this._logEvent("Erro: Não foi possível determinar a melhor mão.");
              setTimeout(() => this.startNewHand(), 5000);
             return;
        }

        // Filtra os vencedores (aqueles cuja mão iguala a melhor avaliação)
        const winners = contenders.filter(player =>
             player.evaluationResult &&
             player.evaluationResult.rankIndex === overallBestEval.rankIndex &&
             this._compareSignificantRanks(player.evaluationResult.significantRanks, overallBestEval.significantRanks) === 0
        );

        this._distributePot(winners);
        this._triggerUIUpdate(); // Atualiza UI para mostrar mãos finais/vencedores

        this._logEvent("Próxima mão em 5 segundos...");
        setTimeout(() => this.startNewHand(), 5000);
    }

     _evaluateBestHand(sevenCards) {
        if (!sevenCards || sevenCards.length < 5) {
            return { rankIndex: -1, hand: null, description: "Invalid Cards", significantRanks: [] };
        }
        // Gera todas as combinações de 5 cartas
        const all5CardCombinations = this._getCombinations(sevenCards, 5);
        let bestHandOverall = { rankIndex: -1, hand: null, description: "None", significantRanks: [] };

        for (const hand5 of all5CardCombinations) {
            // Avalia cada combinação de 5 cartas
            const currentEval = this._evaluateSingle5CardHand(hand5);

            // Compara com a melhor encontrada até agora
            if (currentEval.rankIndex > bestHandOverall.rankIndex) {
                bestHandOverall = currentEval;
            } else if (currentEval.rankIndex === bestHandOverall.rankIndex) {
                 if (this._compareSignificantRanks(currentEval.significantRanks, bestHandOverall.significantRanks) > 0) {
                     bestHandOverall = currentEval;
                 }
            }
        }

        // Retorna os detalhes da melhor mão encontrada
        if (bestHandOverall.hand) {
            bestHandOverall.hand.sort((a, b) => b.value - a.value); // Ordena a mão final por valor
        }
        return bestHandOverall;
    }

     _getCombinations(arr, k) {
        if (k < 0 || k > arr.length) return [];
        if (k === 0) return [[]];
        if (k === arr.length) return [arr];
        if (k === 1) return arr.map(item => [item]);
        const combinations = [];
        const firstElement = arr[0];
        const rest = arr.slice(1);
        const combsWithFirst = this._getCombinations(rest, k - 1);
        combsWithFirst.forEach(comb => combinations.push([firstElement, ...comb]));
        const combsWithoutFirst = this._getCombinations(rest, k);
        combinations.push(...combsWithoutFirst);
        return combinations;
    }

    _evaluateSingle5CardHand(hand5) {
        if (!hand5 || hand5.length !== 5) {
            return { rankIndex: -1, hand: null, description: "Invalid Hand", significantRanks: [] };
        }
        const sortedHand = [...hand5].sort((a, b) => b.value - a.value);
        const ranks = sortedHand.map(c => c.value);
        const suits = sortedHand.map(c => c.suit);
        const isFlush = suits.every(s => s === suits[0]);
        const rankCounts = ranks.reduce((acc, rank) => { acc[rank] = (acc[rank] || 0) + 1; return acc; }, {});
        const counts = Object.values(rankCounts).sort((a, b) => b - a);
        const uniqueRanksSorted = [...new Set(ranks)].sort((a, b) => b - a);
        const isStraight = uniqueRanksSorted.length >= 5 && (
            (uniqueRanksSorted[0] - uniqueRanksSorted[4] === 4) ||
            (uniqueRanksSorted[0] === 14 && uniqueRanksSorted[1] === 5 && uniqueRanksSorted[2] === 4 && uniqueRanksSorted[3] === 3 && uniqueRanksSorted[4] === 2)
        );
        let highCardForStraight = 0;
        if (isStraight) {
            highCardForStraight = (uniqueRanksSorted[0] === 14 && uniqueRanksSorted[1] === 5) ? 5 : uniqueRanksSorted[0];
        }

        let rankIndex = -1;
        let description = "";
        let significantRanks = [];

        if (isStraight && isFlush) {
            if (highCardForStraight === 14) {
                rankIndex = 9; description = "Royal Flush"; significantRanks = [14];
            } else {
                rankIndex = 8; description = `Straight Flush (${this._rankValueToString(highCardForStraight)} high)`; significantRanks = [highCardForStraight];
            }
        } else if (counts[0] === 4) {
            rankIndex = 7;
            const fourRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 4));
            const kicker = ranks.find(r => r !== fourRank);
            description = `Four of a Kind (${this._rankValueToString(fourRank)}s)`;
            significantRanks = [fourRank, kicker];
        } else if (counts[0] === 3 && counts[1] === 2) {
            rankIndex = 6;
            const threeRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 3));
            const pairRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 2));
            description = `Full House (${this._rankValueToString(threeRank)}s over ${this._rankValueToString(pairRank)}s)`;
            significantRanks = [threeRank, pairRank];
        } else if (isFlush) {
            rankIndex = 5; description = `Flush (${this._rankValueToString(ranks[0])} high)`; significantRanks = ranks;
        } else if (isStraight) {
            rankIndex = 4; description = `Straight (${this._rankValueToString(highCardForStraight)} high)`; significantRanks = [highCardForStraight];
        } else if (counts[0] === 3) {
            rankIndex = 3;
            const threeRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 3));
            const kickers = ranks.filter(r => r !== threeRank).sort((a, b) => b - a);
            description = `Three of a Kind (${this._rankValueToString(threeRank)}s)`;
            significantRanks = [threeRank, ...kickers];
        } else if (counts[0] === 2 && counts[1] === 2) {
            rankIndex = 2;
            const pairRanks = Object.keys(rankCounts).filter(r => rankCounts[r] === 2).map(r => parseInt(r)).sort((a, b) => b - a);
            const kicker = ranks.find(r => rankCounts[r] === 1);
            description = `Two Pair (${this._rankValueToString(pairRanks[0])}s and ${this._rankValueToString(pairRanks[1])}s)`;
            significantRanks = [pairRanks[0], pairRanks[1], kicker];
        } else if (counts[0] === 2) {
            rankIndex = 1;
            const pairRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 2));
            const kickers = ranks.filter(r => r !== pairRank).sort((a, b) => b - a);
            description = `One Pair (${this._rankValueToString(pairRank)}s)`;
            significantRanks = [pairRank, ...kickers];
        } else {
            rankIndex = 0; description = `High Card (${this._rankValueToString(ranks[0])})`; significantRanks = ranks;
        }

        return { rankIndex, hand: sortedHand, description, significantRanks };
    }

     _compareSignificantRanks(ranks1, ranks2) {
        if (!ranks1 || !ranks2 || ranks1.length !== ranks2.length) {
            console.error("Erro ao comparar ranks significativos: arrays inválidos ou de tamanhos diferentes.", ranks1, ranks2);
            return 0;
        }
        for (let i = 0; i < ranks1.length; i++) {
            if (ranks1[i] > ranks2[i]) return 1;
            if (ranks1[i] < ranks2[i]) return -1;
        }
        return 0;
     }

     _rankValueToString(value) {
        if (value >= 2 && value <= 9) return String(value);
        const map = { 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
        return map[value] || '?';
     }

    // --- Distribuição do Pote ---
     _distributePot(winners) {
         if (winners.length === 0) {
             this._logEvent("Erro: Nenhum vencedor para distribuir o pote.");
             this.pot = 0;
             return;
         }
         // Implementação MUITO simplificada sem side pots
         const totalWinners = winners.length;
         const share = Math.floor(this.pot / totalWinners);
         let remainder = this.pot % totalWinners;
         this._logEvent(`Pote de ${this.pot} dividido entre ${totalWinners} vencedor(es):`);
         winners.forEach((winner) => {
             const amountWon = share + (remainder > 0 ? 1 : 0);
             winner.addChips(amountWon);
             this._logEvent(`- ${winner.name} (${winner.evaluationResult?.description}) ganha ${amountWon}`);
             if (remainder > 0) remainder--;
         });
         this.pot = 0;
     }

     _awardPotToWinner(winners) {
         if (winners && winners.length > 0) {
              const winner = winners[0];
              this._logEvent(`${winner.name} ganha o pote de ${this.pot} por desistência dos outros.`);
              winner.addChips(this.pot);
              this.pot = 0;
         } else {
             this._logEvent("Mão terminou sem vencedor claro, pote perdido?");
             this.pot = 0;
         }
          this._triggerUIUpdate();
          this._logEvent("Próxima mão em 3 segundos...");
          setTimeout(() => this.startNewHand(), 3000);
     }

    // --- Lógica da IA (Muito Básica) ---
    _checkAndTriggerAIAction() {
        if (this.currentPhase === 'idle' || this.currentPhase === 'showdown' || this.currentPhase === 'gameOver') return;
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (currentPlayer && !currentPlayer.isHuman && currentPlayer.status === 'active') {
            this._logEvent(`IA ${currentPlayer.name} está pensando...`);
            setTimeout(() => {
                 if(this.players[this.currentPlayerIndex]?.id === currentPlayer.id && currentPlayer.status === 'active') {
                    this._performAIAction(currentPlayer);
                 }
            }, 1500 + Math.random() * 1000);
        }
    }

    _performAIAction(player) {
        const amountToCall = this.currentBet - player.totalBetInRound;
        const callCostPercentage = player.chips > 0 ? (amountToCall / (player.chips + player.totalBetInRound)) * 100 : 100;

        if (amountToCall <= 0) { // Pode dar Check
            if (player.chips > BIG_BLIND_AMOUNT && Math.random() < 0.25) {
                 const betAmount = Math.min(player.chips, Math.max(BIG_BLIND_AMOUNT, Math.floor(this.pot * 0.5)));
                 this.handleAction(player.id, 'bet', betAmount);
            } else { this.handleAction(player.id, 'check'); }
        } else { // Precisa dar Call, Fold ou Raise
            if (amountToCall >= player.chips) { // Call é All-in
                 if (Math.random() < 0.5) this.handleAction(player.id, 'call');
                 else this.handleAction(player.id, 'fold');
            } else if (callCostPercentage > 40 && Math.random() < 0.7) { // Custo alto
                this.handleAction(player.id, 'fold');
            } else if (callCostPercentage > 15) { // Custo médio
                const rand = Math.random();
                if (rand < 0.3) this.handleAction(player.id, 'fold');
                else if (rand < 0.85 && player.chips >= amountToCall + this.minRaise) this.handleAction(player.id, 'call');
                else if (player.chips >= amountToCall + this.minRaise) {
                     const totalRaise = this.currentBet + this.minRaise; this.handleAction(player.id, 'raise', totalRaise);
                } else this.handleAction(player.id, 'call'); // Não pode raise, só call
            } else { // Custo baixo
                if (player.chips >= amountToCall + this.minRaise && Math.random() < 0.15) {
                     const totalRaise = this.currentBet + this.minRaise; this.handleAction(player.id, 'raise', totalRaise);
                } else this.handleAction(player.id, 'call');
            }
        }
    }

    // --- Funções de Utilidade / Acesso ---
    getGameState() {
        return {
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                isHuman: p.isHuman,
                chips: p.chips,
                hand: (p.isHuman || this.currentPhase === 'showdown' || p.status === 'out')
                    ? p.hand.map(card => card.toString())
                    : (p.hand.length > 0 ? p.hand.map(() => '?') : []),
                currentBet: p.currentBet,
                totalBetInRound: p.totalBetInRound, // Total APOSTADO NA RODADA ATUAL
                status: p.status,
                isDealer: this.players[this.dealerButtonIndex]?.id === p.id,
                isTurn: this.players[this.currentPlayerIndex]?.id === p.id && p.status === 'active',
                bestHandDescription: (this.currentPhase === 'showdown' && p.status !== 'folded' && p.status !== 'out' && p.evaluationResult?.description)
                                    ? p.evaluationResult.description
                                    : null
            })),
            communityCards: this.communityCards.map(card => card.toString()),
            pot: this.pot,
            currentBet: this.currentBet, // Aposta a ser igualada
            minRaise: this.minRaise,     // Valor ADICIONAL mínimo para raise
            currentPhase: this.currentPhase,
            log: [...this.log].slice(-15),
            // Adicionar bigBlindAmount aqui se necessário para UI
             bigBlindAmount: BIG_BLIND_AMOUNT
        };
    }

    performHumanAction(action, amount = 0) {
        const humanPlayer = this.players.find(p => p.isHuman);
        if (!humanPlayer || this.players[this.currentPlayerIndex]?.id !== humanPlayer.id || humanPlayer.status !== 'active') {
             this._logEvent("Ação humana inválida: Não é sua vez ou você não está ativo.");
             return false;
         }
        return this.handleAction(humanPlayer.id, action, amount);
    }

} // Fim da classe PokerGame

// Exporta classes (opcional)
// export { PokerGame, Card, Player };