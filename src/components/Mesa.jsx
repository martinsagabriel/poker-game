import styled from 'styled-components'

const MesaContainer = styled.div`
  width: 800px;
  height: 400px;
  background-color: #27ae60;
  border-radius: 200px;
  margin: 20px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`

const CartasMesa = styled.div`
  display: flex;
  gap: 10px;
`

const Pote = styled.div`
  color: white;
  font-size: 24px;
  margin-top: 20px;
`

function Mesa({ cartasMesa, pote }) {
  return (
    <MesaContainer>
      <CartasMesa>
        {cartasMesa.map((carta, index) => (
          <div key={index} className="carta">
            {/* Implementar visual da carta */}
          </div>
        ))}
      </CartasMesa>
      <Pote>Pote: ${pote}</Pote>
    </MesaContainer>
  )
}

export default Mesa