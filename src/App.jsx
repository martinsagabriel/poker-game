import { useState } from 'react'
import styled from 'styled-components'
import Mesa from './components/Mesa'
import Jogador from './components/Jogador'
import Controles from './components/Controles'

const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  background-color: #2c3e50;
  display: flex;
  flex-direction: column;
  align-items: center;
`

function App() {
  const [estado, setEstado] = useState({
    jogadores: [
      { id: 1, nome: 'Computador 1', fichas: 1000, cartas: [], ativo: true },
      { id: 2, nome: 'Computador 2', fichas: 1000, cartas: [], ativo: true },
      { id: 3, nome: 'Computador 3', fichas: 1000, cartas: [], ativo: true },
      { id: 4, nome: 'Você', fichas: 1000, cartas: [], ativo: true }
    ],
    cartasMesa: [],
    pote: 0,
    jogadorAtual: 3,
    fase: 'inicio' // inicio, preFlop, flop, turn, river, final
  })

  return (
    <AppContainer>
      <Mesa cartasMesa={estado.cartasMesa} pote={estado.pote} />
      <div className="jogadores">
        {estado.jogadores.map(jogador => (
          <Jogador 
            key={jogador.id}
            nome={jogador.nome}
            fichas={jogador.fichas}
            cartas={jogador.cartas}
            ativo={jogador.ativo}
            isJogadorHumano={jogador.id === 4}
          />
        ))}
      </div>
      <Controles 
        jogadorAtual={estado.jogadorAtual}
        fase={estado.fase}
        onApostar={() => {}}
        onPassar={() => {}}
        onDesistir={() => {}}
      />
    </AppContainer>
  )
}

export default App