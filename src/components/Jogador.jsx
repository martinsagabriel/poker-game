import styled from 'styled-components'

const JogadorContainer = styled.div`
  background-color: rgba(0, 0, 0, 0.5);
  padding: 15px;
  border-radius: 10px;
  color: white;
  margin: 10px;
  ${props => !props.ativo && `
    opacity: 0.5;
  `}
`

const Cartas = styled.div`
  display: flex;
  gap: 5px;
  margin: 10px 0;
`

function Jogador({ nome, fichas, cartas, ativo, isJogadorHumano }) {
  return (
    <JogadorContainer ativo={ativo}>
      <h3>{nome}</h3>
      <Cartas>
        {cartas.map((carta, index) => (
          <div key={index} className="carta">
            {/* Implementar visual da carta */}
          </div>
        ))}
      </Cartas>
      <div>Fichas: ${fichas}</div>
    </JogadorContainer>
  )
}

export default Jogador