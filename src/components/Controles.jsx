import styled from 'styled-components'

const ControlesContainer = styled.div`
  display: flex;
  gap: 10px;
  margin: 20px;
`

const Botao = styled.button`
  padding: 10px 20px;
  font-size: 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  background-color: #3498db;
  color: white;

  &:hover {
    background-color: #2980b9;
  }

  &:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
  }
`

function Controles({ jogadorAtual, fase, onApostar, onPassar, onDesistir }) {
  const ehSuaVez = jogadorAtual === 3

  return (
    <ControlesContainer>
      <Botao onClick={onApostar} disabled={!ehSuaVez}>
        Apostar
      </Botao>
      <Botao onClick={onPassar} disabled={!ehSuaVez}>
        Passar
      </Botao>
      <Botao onClick={onDesistir} disabled={!ehSuaVez}>
        Desistir
      </Botao>
    </ControlesContainer>
  )
}

export default Controles