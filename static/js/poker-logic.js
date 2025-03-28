/**
 * poker-logic.js
 * Lógica central para um jogo de Poker Texas Hold'em
 * Foco: Gerenciamento do estado do jogo, ações, jogadores (1 humano, 3 IA)
 * Modificado para incluir callback de atualização da UI.
 */

// --- Constantes ---
const SUITS = ["H", "D", "C", "S"]; // Copas, Ouros, Paus, Espadas
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]; // T=10
const HAND_RANKS = [
    "High Card", "One Pair", "Two Pair", "Three of a Kind",
    "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush", "Royal Flush"
];

const STARTING_CHIPS = 1000;
const SMALL_BLIND_AMOUNT = 10;
const BIG_BLIND_AMOUNT = 20;

// --- Classes ---

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.value = this._getRankValue(rank);
    }

    _getRankValue(rank) {
        if ("23456789".includes(rank)) return parseInt(rank);
        if (rank === "T") return 10;
        if (rank === "J") return 11;
        if (rank === "Q") return 12;
        if (rank === "K") return 13;
        if (rank === "A") return 14;
        return 0;
    }

    // Mapeamento para nomes de arquivos PNG
     _getRankStringForImage() {
        if ("TJQKA".includes(this.rank)) {
            const map = { 'T': '10', 'J': 'jack', 'Q': 'queen', 'K': 'king', 'A': 'ace' };
            return map[this.rank];
        }
        return this.rank;
    }

     _getSuitStringForImage() {
        const map = { 'H': 'hearts', 'D': 'diamonds', 'C': 'clubs', 'S': 'spades' };
        return map[this.suit];
    }

     toFilenameString() {
        // Usado pelo ui-controller para encontrar a imagem correta
        // Ex: 'ace_of_spades', '10_of_hearts', '2_of_clubs'
         const rankStr = this._getRankStringForImage();
         const suitStr = this._getSuitStringForImage();
         if (!rankStr || !suitStr) return 'card_back'; // Fallback
         return `${rankStr}_of_${suitStr}`;
     }


    toString() {
        // Formato interno/lógico (ex: AH, TD, 2C)
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
        this.hand = [];
        this.currentBet = 0;
        this.totalBetInRound = 0;
        this.status = 'waiting'; // waiting, active, folded, all-in, out
        this.bestHand = null;
        this.handRank = -1;
        this.hasActedInRound = false; // <<< Flag para controle de fim de rodada
        this.isLastAggressor = false; // <<< Flag para controle de fim de rodada
    }

    resetForNewHand() {
        this.hand = [];
        this.currentBet = 0;
        this.totalBetInRound = 0;
        this.bestHand = null;
        this.handRank = -1;
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
        if (this.chips > 0 && this.status !== 'folded' && this.status !== 'all-in') {
            this.status = 'active';
        }
    }
}

class PokerGame {
    // <<< MODIFICADO: Adicionado uiUpdateCallback ao construtor >>>
    constructor(playerNames = ["Player 1", "Player 2", "Player 3", "Player 4"], uiUpdateCallback = null) {
        this.players = [];
        this.players.push(new Player(0, playerNames[0] || "Human", true));
        for (let i = 1; i < 4; i++) {
            this.players.push(new Player(i, playerNames[i] || `${i}`, false));
        }

        this.deck = new Deck();
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.minRaise = BIG_BLIND_AMOUNT;
        this.dealerButtonIndex = -1;
        this.currentPlayerIndex = -1;
        // this.activePlayerCount = 0; // Removido - calcular dinamicamente é melhor
        this.currentPhase = 'idle'; // idle, preflop, flop, turn, river, showdown, gameOver
        this.log = [];
        this.uiUpdateCallback = uiUpdateCallback; // <<< Armazena o callback >>>
        this._subPots = []; // Simplificado
        this._roundActionCounter = 0; // <<< Contador de ações na rodada de apostas
        this._lastRaiserId = -1; // <<< ID do último jogador a fazer bet/raise
    }

    _logEvent(message) {
        console.log(message);
        this.log.push(message);
         // Opcional: manter o log com tamanho gerenciável
        // if (this.log.length > 50) this.log.shift();

        // <<< REMOVIDO: Não chamar update aqui, chamar em pontos chave >>>
        // if (this.uiUpdateCallback) this.uiUpdateCallback(this.getGameState());
    }

    _triggerUIUpdate() {
        // <<< Helper para chamar o callback de forma segura >>>
        if (this.uiUpdateCallback) {
            this.uiUpdateCallback(this.getGameState());
        }
    }

    // --- Gerenciamento do Jogo ---

    startNewHand() {
        const playersWithChips = this.players.filter(p => p.chips > 0);
        if (playersWithChips.length < 2) {
            this._logEvent("Não há jogadores suficientes com fichas para continuar.");
            this.currentPhase = 'gameOver';
            this._triggerUIUpdate(); // <<< UI UPDATE CALLBACK >>>
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
             this._triggerUIUpdate(); // <<< UI UPDATE CALLBACK >>>
            return;
        }

        // Move o botão do dealer (apenas entre jogadores que ainda estão 'in game')
        this.dealerButtonIndex = this._getNextPlayerIndex(this.dealerButtonIndex, activePlayersInGame);

        // Define Small Blind e Big Blind
        const sbIndex = this._getNextPlayerIndex(this.dealerButtonIndex, activePlayersInGame);
        const bbIndex = this._getNextPlayerIndex(sbIndex, activePlayersInGame);

        // Post blinds e marca quem postou como último 'agressor' inicial
        this._postBlind(sbIndex, SMALL_BLIND_AMOUNT, "Small Blind");
        this._postBlind(bbIndex, BIG_BLIND_AMOUNT, "Big Blind");
        this._lastRaiserId = this.players[bbIndex]?.id ?? -1; // BB é o 'agressor' inicial
        this.players.forEach(p => {
            p.hasActedInRound = false; // Garante reset
            p.isLastAggressor = (p.id === this._lastRaiserId);
        });

        this.currentBet = BIG_BLIND_AMOUNT;

        // Define o primeiro jogador a agir (UTG)
        this.currentPlayerIndex = this._getNextPlayerIndex(bbIndex, activePlayersInGame);

        this._dealPrivateCards();

        // Prepara jogadores ativos para agir (exceto os que já estão all-in pelos blinds)
        activePlayersInGame.forEach(p => {
            if (p.status !== 'all-in') p.prepareToAction();
            p.hasActedInRound = (p.id === this.players[sbIndex]?.id || p.id === this.players[bbIndex]?.id); // Blinds contam como ação inicial
        });

        this.currentPhase = 'preflop';
        this._logEvent(`Fase: Preflop. Dealer é ${this.players[this.dealerButtonIndex]?.name}. ${this.players[sbIndex]?.name} posta SB(${SMALL_BLIND_AMOUNT}). ${this.players[bbIndex]?.name} posta BB(${BIG_BLIND_AMOUNT}).`);

        // Se o primeiro a agir está fora ou all-in, avança
        while (this.players[this.currentPlayerIndex].status === 'out' || this.players[this.currentPlayerIndex].status === 'folded' || this.players[this.currentPlayerIndex].status === 'all-in') {
           const nextIdx = this._getNextPlayerIndex(this.currentPlayerIndex, this._getPlayersInHand());
           if (nextIdx === this.currentPlayerIndex || nextIdx === -1) {
               // Todos all-in/folded? A rodada pode acabar imediatamente.
               this._logEvent("Todos all-in/folded antes da primeira ação.");
               this._endBettingRound(); // Chama para avançar fases
               return; // Sai do startNewHand
           }
           this.currentPlayerIndex = nextIdx;
        }

        this._logEvent(`Vez de: ${this.players[this.currentPlayerIndex]?.name}`);

        this._triggerUIUpdate(); // <<< UI UPDATE CALLBACK >>> - Estado inicial pronto
        this._checkAndTriggerAIAction(); // Inicia IA se for a vez dela
    }

    _postBlind(playerIndex, amount, blindType) {
        const player = this.players[playerIndex];
        if (!player || player.status === 'out') return;

        const blindAmount = player.removeChips(amount);
        player.currentBet = blindAmount; // Aposta da ação
        player.totalBetInRound = blindAmount; // Total na rodada
        this.pot += blindAmount;
        this._logEvent(`${player.name} posta ${blindType} de ${blindAmount}`);

        if (player.chips === 0) {
            player.status = 'all-in';
            this._logEvent(`${player.name} está all-in com o blind.`);
        }
        // player.hasActedInRound = true; // Considera postar blind como ter agido
    }

     _dealPrivateCards() {
        this._logEvent("Distribuindo cartas...");
        const activePlayers = this.players.filter(p => p.status !== 'out');
        const startIndex = this._getNextPlayerIndex(this.dealerButtonIndex, activePlayers);
        const numActivePlayers = activePlayers.length;
        let currentDealIndex = startIndex;

        for (let i = 0; i < 2; i++) { // Duas cartas
            for (let j = 0; j < numActivePlayers; j++) {
                 const player = this.players[currentDealIndex];
                 if (player && player.status !== 'out') { // Segurança
                     const card = this.deck.dealCard();
                     if (card) {
                         player.hand.push(card);
                     } else {
                         console.error("Erro: Baralho vazio durante a distribuição!");
                         this._logEvent("Erro crítico: Baralho vazio!");
                         // Idealmente, invalidaria a mão ou terminaria o jogo aqui
                         return;
                     }
                 }
                 currentDealIndex = this._getNextPlayerIndex(currentDealIndex, activePlayers);
            }
        }
         // Log de depuração (não deve mostrar mãos de IA na UI real)
         // this.players.forEach(p => { if(p.status !== 'out') console.log(`${p.name} mão: ${p.hand.map(c => c.toString()).join(',')}`); });
    }


    // --- Lógica de Ação do Jogador ---

    handleAction(playerId, action, amount = 0) {
        const player = this.players.find(p => p.id === playerId);
        const currentPlayer = this.players[this.currentPlayerIndex];

        // --- Validações Iniciais ---
        if (!player || player.id !== currentPlayer?.id) {
            this._logEvent(`Ação inválida: Não é a vez de ${player?.name ?? 'ID desconhecido'}. É a vez de ${currentPlayer?.name ?? 'Ninguém'}.`);
            return false; // Não processa e não atualiza UI
        }
        if (player.status !== 'active') {
            this._logEvent(`Ação inválida: ${player.name} não está ativo (status: ${player.status}).`);
             // Se chegou aqui por erro, tenta avançar
             // this._moveToNextPlayer(); // Comentado para evitar loops inesperados, a UI não deveria permitir
            return false;
        }

        let isValidAction = false;
        const amountToCall = this.currentBet - player.totalBetInRound;
        let actionDescription = ""; // Para log
        let performMove = true; // Flag para saber se devemos chamar _moveToNextPlayer

        // Resetar flag de último agressor
        this.players.forEach(p => p.isLastAggressor = false);

        switch (action.toLowerCase()) {
            case 'fold':
                player.status = 'folded';
                actionDescription = `${player.name} desiste (fold).`;
                isValidAction = true;
                break;

            case 'check':
                if (amountToCall > 0) {
                    actionDescription = `Ação inválida: ${player.name} não pode dar check, precisa pagar ${amountToCall}.`;
                     performMove = false; // Jogador precisa tentar de novo
                } else {
                    actionDescription = `${player.name} passa (check).`;
                    isValidAction = true;
                }
                break;

            case 'call':
                if (amountToCall <= 0) {
                    // Permitir 'call' quando não há aposta funciona como 'check'
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
                const isEffectivelyCheck = amountToCall <= 0; // Pode apostar se ninguém apostou ainda
                 if (!isEffectivelyCheck) {
                     actionDescription = `Ação inválida: ${player.name} não pode apostar (bet), use call ou raise.`;
                      performMove = false;
                 } else if (amount <= 0) {
                     actionDescription = `Ação inválida: ${player.name} - valor da aposta (bet) deve ser positivo.`;
                      performMove = false;
                 } else if (amount < this.minRaise && player.chips > amount) { // Permite all-in menor
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
                    this.currentBet = player.totalBetInRound; // Nova aposta a ser coberta
                    this.minRaise = betAmount; // Próximo raise deve ser pelo menos isso a mais
                    this._lastRaiserId = player.id; // Ele é o novo agressor
                    player.isLastAggressor = true;
                    actionDescription = `${player.name} aposta (bet) ${betAmount}.`;
                    if (player.chips === 0) {
                        player.status = 'all-in';
                         actionDescription += ` e está all-in.`;
                    }
                    isValidAction = true;
                 }
                break;

            case 'raise':
                const totalAfterRaise = amount; // amount é o VALOR TOTAL que o jogador quer ter na rodada
                const raiseAmount = totalAfterRaise - player.totalBetInRound; // Quanto a mais está colocando

                 if (amountToCall <= 0) {
                    actionDescription = `Ação inválida: ${player.name} não pode dar raise, use bet.`;
                      performMove = false;
                } else if (raiseAmount <= 0) {
                     actionDescription = `Ação inválida: ${player.name} - o valor do raise (${totalAfterRaise}) deve ser maior que a aposta atual (${player.totalBetInRound}).`;
                      performMove = false;
                 } else if (raiseAmount < this.minRaise && (player.chips > (amountToCall + raiseAmount)) ) { // Permite all-in menor
                     actionDescription = `Ação inválida: ${player.name} - aumento mínimo (raise) precisa ser de ${this.minRaise} (totalizando ${this.currentBet + this.minRaise}). Tentou aumentar ${raiseAmount}.`;
                      performMove = false;
                 } else if ((amountToCall + raiseAmount) > player.chips) {
                     actionDescription = `Ação inválida: ${player.name} não tem fichas suficientes para aumentar para ${totalAfterRaise}. Tem ${player.chips}, precisa ${amountToCall + raiseAmount}.`;
                      performMove = false;
                 } else {
                    const amountToAdd = amountToCall + raiseAmount;
                    player.removeChips(amountToAdd);
                    player.currentBet = amountToAdd;
                    player.totalBetInRound = totalAfterRaise;
                    this.pot += amountToAdd;
                    this.currentBet = player.totalBetInRound; // Nova aposta a ser coberta
                    this.minRaise = raiseAmount; // O valor do aumento define o próximo minRaise
                    this._lastRaiserId = player.id; // Ele é o novo agressor
                    player.isLastAggressor = true;
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

        // --- Processamento Pós-Ação ---
        this._logEvent(actionDescription);

        if (isValidAction) {
            player.hasActedInRound = true;
            this._roundActionCounter++; // Incrementa contador de ações na rodada

             if (performMove) {
                 this._moveToNextPlayer(); // Avança o jogo
                 // A UI será atualizada DENTRO de _moveToNextPlayer ou _endBettingRound
             } else {
                  // Ação válida mas não avança (raro, talvez só check/call sem aposta)
                  // Mesmo assim, atualiza a UI para mostrar o status ou aposta zerada
                   this._triggerUIUpdate(); // <<< UI UPDATE CALLBACK >>>
             }
            return true;

        } else {
            // Ação foi inválida, jogador precisa agir novamente.
            // Se for IA, tenta uma ação segura (check ou fold)
            if (!player.isHuman) {
                this._logEvent(`IA ${player.name} tentou ação inválida. Tentando ação segura...`);
                 // Tenta Check primeiro
                const canCheck = (this.currentBet - player.totalBetInRound) <= 0;
                if (canCheck) {
                    this.handleAction(playerId, 'check');
                } else {
                    // Se não pode check, tenta Call (se tiver fichas) ou Fold
                    if (player.chips > 0) {
                        this.handleAction(playerId, 'call');
                    } else {
                        // Se não tem fichas e tentou algo inválido (não deveria acontecer), força Fold
                         this.handleAction(playerId, 'fold');
                    }
                }
            } else {
                // Se for humano, a UI deve permanecer para ele tentar de novo
                 this._triggerUIUpdate(); // <<< UI UPDATE CALLBACK >>> (para mostrar msg de erro talvez)
            }
            return false;
        }
    }


    // --- Controle de Fluxo do Jogo ---

    _getPlayersInHand(includeFolded = false) {
        // Retorna jogadores que ainda não foram eliminados ('out')
        // Por padrão, exclui os que desistiram ('folded')
        return this.players.filter(p =>
            p.status !== 'out' && (includeFolded || p.status !== 'folded')
        );
    }

    _getActingPlayers() {
        // Retorna jogadores que ainda podem/devem tomar uma decisão (não folded, não all-in, não out)
        return this.players.filter(p => p.status === 'active');
    }

    _getNextPlayerIndex(currentIndex, playerPool) {
        if (!playerPool || playerPool.length === 0) return -1;

        let attempts = 0;
        let nextIndex = currentIndex; // Começa do atual para poder dar a volta

        do {
            nextIndex = (nextIndex + 1) % this.players.length;
            const nextPlayer = this.players[nextIndex];

            // Está no pool que estamos considerando? (ex: jogadores ainda na mão, jogadores com fichas, etc.)
            if (playerPool.some(p => p.id === nextPlayer.id)) {
                return nextIndex; // Encontrou o próximo jogador válido no pool
            }
            attempts++;
        } while (attempts <= this.players.length); // Evita loop infinito

        // Se deu a volta completa e não achou ninguém no pool (além do inicial, talvez)
        console.warn("Não foi possível encontrar o próximo jogador no pool especificado.");
        return -1; // Ou talvez retornar o currentIndex se ele for o único no pool?
    }


    _moveToNextPlayer() {
        const playersStillInHand = this._getPlayersInHand(); // Não folded, não out

        // Condição de Fim de Mão Imediato (antes do showdown)
        if (playersStillInHand.length <= 1) {
            this._logEvent("Apenas um jogador (ou nenhum) restante na mão.");
            // O pote já deve ter sido atualizado pelas apostas
            this._awardPotToWinner(playersStillInHand); // Premia o último (se houver)
            // startNewHand será chamado dentro de _awardPotToWinner ou após
            return; // Encerra o movimento
        }

        // Condição de Fim da Rodada de Apostas
        const bettingRoundEnded = this._checkBettingRoundEnd();

        if (bettingRoundEnded) {
            this._endBettingRound(); // Finaliza a rodada e avança para próxima fase/showdown
            // UI Update será chamado dentro de _endBettingRound
        } else {
            // A rodada continua, encontra o próximo jogador que PODE agir
            let nextPlayerIndex = this.currentPlayerIndex;
            let nextPlayer = null;
            let safetyCounter = 0;

            do {
                nextPlayerIndex = this._getNextPlayerIndex(nextPlayerIndex, playersStillInHand); // Procura próximo na mão
                 if (nextPlayerIndex === -1 || safetyCounter > this.players.length * 2) {
                      console.error("Erro ao encontrar próximo jogador para agir. Forçando fim da rodada.");
                      this._endBettingRound();
                      return;
                 }
                 nextPlayer = this.players[nextPlayerIndex];
                 safetyCounter++;
                 // Continua procurando se o próximo estiver all-in ou folded (não deveria estar folded aqui, mas por segurança)
            } while (nextPlayer.status === 'all-in' || nextPlayer.status === 'folded');

            // Encontrou o próximo jogador que está 'active' ou 'waiting'
            this.currentPlayerIndex = nextPlayerIndex;
            nextPlayer.prepareToAction(); // Garante que o status é 'active'
            this._logEvent(`Vez de: ${nextPlayer.name}`);

            this._triggerUIUpdate(); // <<< UI UPDATE CALLBACK >>> - Passou a vez
            this._checkAndTriggerAIAction(); // Verifica se é IA
        }
    }

     _checkBettingRoundEnd() {
        const playersInHand = this._getPlayersInHand();
        const actingPlayers = playersInHand.filter(p => p.status !== 'all-in'); // Que podem tomar decisões

        // Caso 1: Menos de 2 jogadores podem agir (restantes estão all-in)
        if (actingPlayers.length < 2) {
            // A rodada de apostas acaba, mas a mão continua se houver >1 jogador inHand
            if (playersInHand.length > 1) {
                 this._logEvent("Rodada de apostas encerrada (jogadores restantes estão all-in ou só há um ativo).");
                 return true;
            } else {
                 // Se só sobrou 1 na mão no total, a mão já deveria ter terminado em _moveToNextPlayer
                 // Mas por segurança, retorna true aqui também.
                 return true;
            }
        }

        // Caso 2: Todos que podem agir já agiram nesta rodada E igualaram a aposta máxima?
        const highestBetInRound = Math.max(0, ...playersInHand.map(p => p.totalBetInRound));
        const allActiveHaveActed = actingPlayers.every(p => p.hasActedInRound);
        const allActiveMatched = actingPlayers.every(p => p.totalBetInRound === highestBetInRound);

        // Condição: Pelo menos uma ação real (não só blinds) ocorreu OU é preflop e a ação voltou para o BB sem raise.
        // E todos os jogadores ativos (não all-in) agiram pelo menos uma vez nesta rodada.
        // E todos os jogadores ativos (não all-in) têm o mesmo valor apostado nesta rodada.

         // Ação voltou para o último agressor?
         const actionReturnedToAggressor = this.players[this.currentPlayerIndex]?.id === this._lastRaiserId;
         // Ou, se ninguém aumentou (lastRaiser é o BB ou -1), a ação voltou para quem deveria ser o último (BB no preflop, Dealer nos outros)?
         // Isso é complexo, vamos simplificar:

         // Condição Simplificada:
         // - Pelo menos 2 ações ocorreram na rodada (para evitar fim prematuro no preflop com BB check)
         // - OU é preflop e a vez é do BB que pode dar check.
         // - E todos os jogadores que ainda podem agir (não all-in) já agiram.
         // - E todos esses jogadores igualaram a maior aposta da rodada.

          const enoughActionsTaken = this._roundActionCounter >= actingPlayers.length; // Todos tiveram chance de agir pelo menos uma vez?

          const isPreflopBbCheckOption = this.currentPhase === 'preflop'
              && this.players[this.currentPlayerIndex]?.totalBetInRound === BIG_BLIND_AMOUNT
              && this.currentBet === BIG_BLIND_AMOUNT; // BB tem opção de check

         // Correção: A rodada termina quando:
         // 1. Todos os jogadores ativos fizeram sua última ação (check ou call) OU desistiram.
         // 2. Todos os jogadores ativos apostaram a mesma quantia nesta rodada (exceto all-ins menores).

         // Nova verificação:
         // Todos os jogadores na mão (não-folded, não-out) que NÃO estão all-in:
         // a) Já agiram nesta rodada (p.hasActedInRound === true)
         // b) Têm sua aposta igual à aposta corrente (p.totalBetInRound === this.currentBet)

         const canStillAct = playersInHand.filter(p => p.status !== 'all-in');
         const allEligibleActedAndMatched = canStillAct.every(p =>
                p.hasActedInRound && p.totalBetInRound === this.currentBet
         );

         // A rodada só pode terminar se houve alguma aposta (currentBet > 0) ou se todos deram check (currentBet == 0 e todos agiram)
          const bettingOccurred = this.currentBet > 0;
          const allChecked = this.currentBet === 0 && canStillAct.every(p => p.hasActedInRound);

          // Considera também o caso inicial do preflop onde o BB pode dar check
          const bbCanEndRoundWithCheck = this.currentPhase === 'preflop' &&
                                         this.currentBet === BIG_BLIND_AMOUNT &&
                                         this.players[this.currentPlayerIndex]?.totalBetInRound === BIG_BLIND_AMOUNT && // É o BB?
                                         canStillAct.every(p => p.hasActedInRound) && // Todos outros já agiram?
                                         canStillAct.filter(p => p.id !== this.players[this.currentPlayerIndex].id)
                                                    .every(p => p.totalBetInRound === this.currentBet || p.status === 'all-in'); // Outros igualaram?


         if ((bettingOccurred || allChecked) && allEligibleActedAndMatched || bbCanEndRoundWithCheck ) {
              // Exceção: Se a última ação foi um bet/raise, a rodada NÃO acaba ainda,
              // a menos que SÓ haja jogadores all-in restantes ou que deram fold.
               const lastPlayer = this.players.find(p => p.id === this.currentPlayerIndex); // Quem acabou de agir
               if (lastPlayer.isLastAggressor && actingPlayers.length > 1) {
                  // Ele acabou de fazer bet/raise e ainda há outros que podem agir, a rodada continua
                  this._logEvent("Rodada continua após raise/bet.");
                  return false;
               }

               // Se não foi bet/raise ou se os outros já estão all-in/folded
               this._logEvent("Todos igualaram ou estão all-in/folded. Rodada de apostas encerrada.");
               return true;
         }


        return false; // Rodada continua
     }

    _endBettingRound() {
        this._logEvent(`--- Fim da Rodada de Apostas (${this.currentPhase}) ---`);
        this._logEvent(`Pote Total: ${this.pot}`);

        // Resetar para próxima rodada de apostas
        this.currentBet = 0;
        this.minRaise = BIG_BLIND_AMOUNT;
        this._roundActionCounter = 0; // Zera contador de ações
        this._lastRaiserId = -1; // Zera último agressor
        this.players.forEach(p => {
            p.currentBet = 0; // Zera aposta da *ação*
            p.totalBetInRound = 0; // Zera aposta *da rodada*
            p.hasActedInRound = false; // Reseta para a próxima rodada
            p.isLastAggressor = false;
            // Status 'active' ou 'waiting' permanece se ainda podem jogar
        });

        // Lógica de Side Pot (Simplificada - apenas verifica se precisa ir direto ao showdown)
        const playersToShowdown = this._getPlayersInHand();
        const playersWhoCanBet = playersToShowdown.filter(p => p.status !== 'all-in');

        // Avança para a próxima fase ou showdown
        let nextPhase = '';
        switch (this.currentPhase) {
            case 'preflop': nextPhase = 'flop'; break;
            case 'flop': nextPhase = 'turn'; break;
            case 'turn': nextPhase = 'river'; break;
            case 'river': nextPhase = 'showdown'; break;
            default:
                console.error("Fase desconhecida ao terminar rodada:", this.currentPhase);
                nextPhase = 'idle'; // Evitar erro
                break;
        }

        // Se jogadores podem apostar na próxima fase, distribui cartas e continua
        // Se não podem (<=1 ativo ou todos all-in), distribui todas cartas restantes e vai pro showdown
        if (nextPhase !== 'showdown' && playersWhoCanBet.length >= 2) {
            this._dealCommunityCards(nextPhase, true); // Distribui e inicia nova rodada de apostas
        } else if (nextPhase !== 'showdown') {
            // Menos de 2 jogadores podem apostar, revela todas cartas restantes
            this._logEvent("Jogadores all-in ou apenas um ativo. Revelando cartas restantes...");
             let currentPhaseForDealing = this.currentPhase;
             while(currentPhaseForDealing !== 'river') {
                  let phaseToDeal = '';
                  if (currentPhaseForDealing === 'preflop') phaseToDeal = 'flop';
                  else if (currentPhaseForDealing === 'flop') phaseToDeal = 'turn';
                  else if (currentPhaseForDealing === 'turn') phaseToDeal = 'river';

                  if (phaseToDeal) {
                       this._dealCommunityCards(phaseToDeal, false); // Apenas distribui, sem iniciar apostas
                       currentPhaseForDealing = phaseToDeal; // Atualiza a fase atual para o próximo loop
                       if (this.deck.cardCount === 0 && currentPhaseForDealing !== 'river') {
                            this._logEvent("Baralho acabou antes do river.");
                            break; // Sai se acabar o baralho
                       }
                  } else {
                      break; // Sai do loop se algo der errado
                  }
             }
             this._showdown(); // Vai para o showdown após revelar tudo
        } else {
            // Já era a fase 'river', então vai direto para o showdown
            this._showdown();
        }
        // <<< UI UPDATE CALLBACK >>> será chamado dentro de _dealCommunityCards ou _showdown
    }

     _dealCommunityCards(phase, startBettingRound = true) {
         const numPlayersInHand = this._getPlayersInHand().length;
         if (numPlayersInHand <= 1 && this.currentPhase !== 'idle') { // Não premia se for idle
             this._logEvent("Apenas um jogador restante, pulando para o final da mão.");
              this._awardPotToWinner(this._getPlayersInHand());
              // startNewHand será chamado em _awardPotToWinner
             return;
         }

         // Queima uma carta
         if (this.deck.cardCount > 0) {
             this.deck.dealCard();
         } else if (this.communityCards.length < 5) { // Só loga erro se realmente faltam cartas
              console.error("Baralho vazio antes de queimar carta para ", phase);
              this._showdown(); // Vai para showdown mesmo sem carta queimada/completa
              return;
         }

        let cardsToDeal = 0;
        let expectedCommunitySize = 0;
        if (phase === 'flop') { cardsToDeal = 3; expectedCommunitySize = 0; }
        else if (phase === 'turn') { cardsToDeal = 1; expectedCommunitySize = 3; }
        else if (phase === 'river') { cardsToDeal = 1; expectedCommunitySize = 4; }

        if (cardsToDeal === 0 || this.communityCards.length !== expectedCommunitySize) {
             console.error("Tentativa de distribuir cartas comunitárias em fase/estado inválido:", phase, this.communityCards.length);
              if (this.currentPhase !== 'river') this._showdown(); // Tenta ir pro showdown se não for river ainda
             return;
        }

        this.currentPhase = phase; // Atualiza a fase ATUAL do jogo

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

         // Se for para iniciar apostas e houver jogadores para isso
         const playersWhoCanBet = this._getPlayersInHand().filter(p => p.status !== 'all-in');
         if (startBettingRound && playersWhoCanBet.length >= 2) {
             this._logEvent("Iniciando rodada de apostas.");
             // Define quem começa a agir (Small Blind ou primeiro ativo depois dele)
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
                 this._triggerUIUpdate(); // <<< UI UPDATE CALLBACK >>> - Nova fase, novo jogador
                 this._checkAndTriggerAIAction();
             } else {
                  console.error("Não foi possível determinar o primeiro a agir após distribuir cartas.");
                   this._showdown(); // Fallback para showdown
             }

         } else {
              // Se não inicia apostas (pq startBettingRound=false ou não há jogadores suficientes)
              // A UI precisa ser atualizada para mostrar as novas cartas comunitárias.
               this._triggerUIUpdate(); // <<< UI UPDATE CALLBACK >>> - Mostra novas cartas
               // O fluxo continuará (para próxima carta ou showdown) a partir de _endBettingRound
         }
    }


    // --- Showdown e Avaliação de Mãos ---

    _showdown() {
        this.currentPhase = 'showdown';
        this._logEvent("--- SHOWDOWN ---");
        const contenders = this._getPlayersInHand(); // Jogadores que não desistiram

        if (contenders.length === 0) {
            this._logEvent("Erro: Nenhum jogador no showdown.");
            this._triggerUIUpdate(); // <<< UI UPDATE CALLBACK >>>
             setTimeout(() => this.startNewHand(), 5000); // Tenta iniciar próxima mão
            return;
        }

        if (contenders.length === 1) {
            this._logEvent(`${contenders[0].name} é o único restante.`);
            this._awardPotToWinner(contenders); // Premia e inicia próxima mão
            return; // awardPotToWinner vai chamar UI update
        }

        this._logEvent("Revelando mãos:");
        let bestRankFound = -1;

        contenders.forEach(player => {
            const allSevenCards = [...player.hand, ...this.communityCards];
            const evaluationResult = this._evaluateBestHand(allSevenCards); // <<< FUNÇÃO CRÍTICA >>>

            player.bestHand = evaluationResult.hand;
            player.handRank = evaluationResult.rankIndex;
            const rankName = HAND_RANKS[player.handRank] || "Desconhecido";
            bestRankFound = Math.max(bestRankFound, player.handRank);

            this._logEvent(`${player.name}: Mão [${player.hand.map(c=>c.toString()).join(', ')}] -> Melhor Mão: ${rankName} (${player.bestHand ? player.bestHand.map(c=>c.toString()).join(', ') : 'N/A'})`);
        });

        // Determina o(s) vencedor(es) filtrando pelo melhor rank
        let potentialWinners = contenders.filter(p => p.handRank === bestRankFound);
        let winners = [];

        if (potentialWinners.length === 1) {
            winners = potentialWinners;
        } else {
            // Empate no rank, precisa comparar as mãos (kickers)
            winners.push(potentialWinners[0]); // Assume o primeiro como melhor temporariamente
            for (let i = 1; i < potentialWinners.length; i++) {
                const currentContender = potentialWinners[i];
                const compareResult = this._compareHands(currentContender.bestHand, winners[0].bestHand); // <<< FUNÇÃO CRÍTICA >>>

                if (compareResult > 0) { // Contender tem mão melhor
                    winners = [currentContender]; // Novo melhor único
                } else if (compareResult === 0) { // Empate real
                    winners.push(currentContender); // Adiciona ao grupo de vencedores
                }
                // Se compareResult < 0, a mão do contender é pior, não faz nada
            }
        }

        // Distribui o pote
        this._distributePot(winners);

        this._triggerUIUpdate(); // <<< UI UPDATE CALLBACK >>> - Mostrar mãos finais e vencedores

        // Inicia a próxima mão após um delay
        this._logEvent("Próxima mão em 5 segundos...");
        setTimeout(() => this.startNewHand(), 5000);
    }

     /**
     * PLACEHOLDER MUITO SIMPLIFICADO: Avalia a melhor mão de 5 cartas a partir de 7.
     * PRECISA SER SUBSTITUÍDO por um avaliador real e completo.
     */
     _evaluateBestHand(sevenCards) {
         // Esta lógica é apenas um exemplo mínimo e INCORRETA para poker real.
         if (!sevenCards || sevenCards.length < 5) return { rankIndex: -1, hand: null };
         sevenCards.sort((a, b) => b.value - a.value);

         // Lógica placeholder de exemplo (procura par mais alto)
         const ranks = sevenCards.map(c => c.value);
         const rankCounts = {};
         ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);

         let bestPairRank = -1;
         for(const r in rankCounts) {
             if(rankCounts[r] >= 2) {
                 bestPairRank = Math.max(bestPairRank, parseInt(r));
             }
         }

         if (bestPairRank !== -1) {
             const pairCards = sevenCards.filter(c => c.value === bestPairRank).slice(0, 2);
             const kickers = sevenCards.filter(c => c.value !== bestPairRank).slice(0, 3);
             return { rankIndex: 1, hand: [...pairCards, ...kickers] }; // One Pair
         } else {
             return { rankIndex: 0, hand: sevenCards.slice(0, 5) }; // High Card
         }
         // RETORNAR UM OBJETO { rankIndex: number, hand: Card[] }
         // Onde hand é um array das 5 cartas da MELHOR mão, ordenadas por importância.
     }

    /**
     * PLACEHOLDER: Compara duas mãos de 5 cartas (do mesmo rank).
     * PRECISA SER SUBSTITUÍDO por um comparador real.
     */
     _compareHands(hand1, hand2) {
        if (!hand1 || !hand2 || hand1.length !== 5 || hand2.length !== 5) return 0;
        // Compara carta por carta (assumindo que _evaluateBestHand ordenou corretamente)
        for (let i = 0; i < 5; i++) {
            if (hand1[i].value > hand2[i].value) return 1;
            if (hand1[i].value < hand2[i].value) return -1;
        }
        return 0; // Empate total
     }

     _distributePot(winners) {
         if (winners.length === 0) {
             this._logEvent("Erro: Nenhum vencedor para distribuir o pote.");
             // O pote pode ser perdido ou carregado para a próxima mão (raro)
             this.pot = 0; // Zera por segurança
             return;
         }

         // Implementação MUITO simplificada sem side pots
         const totalWinners = winners.length;
         const share = Math.floor(this.pot / totalWinners);
         let remainder = this.pot % totalWinners;

         this._logEvent(`Pote de ${this.pot} dividido entre ${totalWinners} vencedor(es):`);

         // Ordena vencedores pela posição em relação ao dealer para distribuir resto (opcional)
         // winners.sort((a,b) => /* lógica de posição */);

         winners.forEach((winner, index) => {
             const amountWon = share + (remainder > 0 ? 1 : 0);
             winner.addChips(amountWon);
             this._logEvent(`- ${winner.name} ganha ${amountWon}`);
             if (remainder > 0) remainder--;
         });

         this.pot = 0;
     }

     _awardPotToWinner(winners) {
         // Usado quando a mão termina antes do showdown
         if (winners && winners.length > 0) {
              const winner = winners[0]; // Assume o primeiro se houver múltiplos por erro
              this._logEvent(`${winner.name} ganha o pote de ${this.pot} por desistência dos outros.`);
              winner.addChips(this.pot);
              this.pot = 0;
         } else {
             this._logEvent("Mão terminou sem vencedor claro (todos desistiram?), pote perdido?");
             this.pot = 0; // Zera o pote
         }
          this._triggerUIUpdate(); // <<< UI UPDATE CALLBACK >>> - Mostrar pote zerado/fichas atualizadas

          // Inicia a próxima mão após um delay
          this._logEvent("Próxima mão em 3 segundos...");
          setTimeout(() => this.startNewHand(), 3000);
     }

    // --- Lógica da IA (Muito Básica) ---

    _checkAndTriggerAIAction() {
        if (this.currentPhase === 'idle' || this.currentPhase === 'showdown' || this.currentPhase === 'gameOver') {
             return;
        }
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (currentPlayer && !currentPlayer.isHuman && currentPlayer.status === 'active') {
            this._logEvent(`IA ${currentPlayer.name} está pensando...`);
            // Delay para simular pensamento
            setTimeout(() => {
                 // Verifica se o estado ainda é válido (ex: humano não agiu nesse meio tempo)
                 if(this.players[this.currentPlayerIndex]?.id === currentPlayer.id && currentPlayer.status === 'active') {
                    this._performAIAction(currentPlayer);
                 } else {
                      console.warn(`IA ${currentPlayer.name} ia agir, mas o estado mudou.`);
                 }
            }, 1500 + Math.random() * 1000); // Delay de 1.5-2.5 segundos
        }
    }

    _performAIAction(player) {
        // Lógica de decisão da IA - MUITO BÁSICA
        const amountToCall = this.currentBet - player.totalBetInRound;
        const potOdds = amountToCall > 0 ? (this.pot + amountToCall) / amountToCall : 0; // Simplificado

        // --- Decisões ---
        // 1. Pode dar Check?
        if (amountToCall <= 0) {
            // 25% de chance de apostar (metade do pote) se tiver fichas
            if (player.chips > BIG_BLIND_AMOUNT && Math.random() < 0.25) {
                 const betAmount = Math.min(player.chips, Math.max(BIG_BLIND_AMOUNT, Math.floor(this.pot * 0.5)));
                 this.handleAction(player.id, 'bet', betAmount);
            } else {
                this.handleAction(player.id, 'check');
            }
            return; // Sai após a ação
        }

        // 2. Precisa dar Call. Analisa custo vs stack.
        const callCostPercentage = player.chips > 0 ? (amountToCall / (player.chips + player.totalBetInRound)) * 100 : 100;

        // All-in forçado?
        if (amountToCall >= player.chips) {
             // Decide se paga o all-in (50% chance por enquanto)
             if (Math.random() < 0.5) {
                 this.handleAction(player.id, 'call');
             } else {
                  this.handleAction(player.id, 'fold');
             }
             return;
        }

        // Custo alto? (> 40% do stack restante) - Maior chance de fold
        if (callCostPercentage > 40 && Math.random() < 0.7) { // 70% chance de fold
            this.handleAction(player.id, 'fold');
            return;
        }

        // Custo médio? (15-40% do stack) - Chance de fold, call, ou raise pequeno
        if (callCostPercentage > 15) {
            const rand = Math.random();
            if (rand < 0.3) { // 30% fold
                 this.handleAction(player.id, 'fold');
            } else if (rand < 0.85 && player.chips >= amountToCall + this.minRaise) { // 55% call
                this.handleAction(player.id, 'call');
            } else if (player.chips >= amountToCall + this.minRaise) { // 15% raise mínimo
                 const totalRaise = this.currentBet + this.minRaise;
                 this.handleAction(player.id, 'raise', totalRaise);
            } else { // Não pode dar raise, só call
                 this.handleAction(player.id, 'call');
            }
            return;
        }

        // Custo baixo? (< 15% do stack) - Quase sempre call, pequena chance de raise
        if (player.chips >= amountToCall + this.minRaise && Math.random() < 0.15) { // 15% raise mínimo
             const totalRaise = this.currentBet + this.minRaise;
             this.handleAction(player.id, 'raise', totalRaise);
        } else {
             this.handleAction(player.id, 'call'); // Call na maioria das vezes
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
                // <<< MODIFICADO: Usar toFilenameString para nomes de imagem, mas retornar ? para IAs antes do showdown >>>
                hand: (p.isHuman || this.currentPhase === 'showdown' || p.status === 'out') // Revela se humano, showdown ou eliminado
                    ? p.hand.map(card => card.toString()) // Usa formato interno (AS, KH) para UI mapear
                    : (p.hand.length > 0 ? p.hand.map(() => '?') : []), // Mostra '?' para cada carta se não revelada, ou vazio se não tem mão
                currentBet: p.currentBet,
                totalBetInRound: p.totalBetInRound,
                status: p.status,
                isDealer: this.players[this.dealerButtonIndex]?.id === p.id,
                isTurn: this.players[this.currentPlayerIndex]?.id === p.id && p.status === 'active',
                bestHandDescription: (this.currentPhase === 'showdown' && p.bestHand && p.status !== 'folded')
                                    ? `${HAND_RANKS[p.handRank]}`
                                    : null
            })),
            communityCards: this.communityCards.map(card => card.toString()), // Usa formato interno (AS, KH)
            pot: this.pot,
            currentBet: this.currentBet,
            minRaise: this.minRaise,
            currentPhase: this.currentPhase,
            log: [...this.log].slice(-15), // Últimos 15 logs
            // currentPlayerId: this.players[this.currentPlayerIndex]?.id // Opcional
        };
    }

    performHumanAction(action, amount = 0) {
        const humanPlayer = this.players.find(p => p.isHuman);
        if (!humanPlayer) return false; // Segurança

        if (this.players[this.currentPlayerIndex]?.id !== humanPlayer.id) {
             this._logEvent("Ação humana inválida: Não é sua vez.");
             return false;
         }
         if (humanPlayer.status !== 'active') {
              this._logEvent("Ação humana inválida: Você não está ativo para jogar.");
             return false;
         }

        // A validação principal e o avanço do jogo ocorrem em handleAction
        return this.handleAction(humanPlayer.id, action, amount);
    }
}

// Exporta classes (opcional, para ambientes com módulos)
// export { PokerGame, Card, Player };