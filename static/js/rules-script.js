document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos
    const btnEn = document.getElementById('btn-en');
    const btnPt = document.getElementById('btn-pt');
    const sectionsEn = document.querySelectorAll('.lang-en'); // Seleciona todas as seções EN
    const sectionsPt = document.querySelectorAll('.lang-pt'); // Seleciona todas as seções PT
    const translatableParagraphs = document.querySelectorAll('.hand-text p[data-lang-en]'); // Seleciona parágrafos traduzíveis

    // Verifica se os elementos foram encontrados
    if (!btnEn || !btnPt || sectionsEn.length === 0 || sectionsPt.length === 0) {
        console.error("Erro: Não foi possível encontrar todos os elementos necessários para a troca de idioma (botões ou seções).");
        return;
    }

    /**
     * Função para trocar o idioma visível.
     * @param {'en' | 'pt'} lang - O idioma a ser mostrado ('en' ou 'pt').
     */
    function switchLanguage(lang) {
        if (lang === 'en') {
            // Mostra seções EN, esconde seções PT
            sectionsEn.forEach(el => el.style.display = 'block');
            sectionsPt.forEach(el => el.style.display = 'none');

            // Atualiza texto dos parágrafos traduzíveis para EN
            translatableParagraphs.forEach(p => {
                p.textContent = p.getAttribute('data-lang-en') || p.textContent; // Usa EN ou mantém o atual se faltar atributo
            });

            // Atualiza botões
            btnEn.classList.add('active');
            btnPt.classList.remove('active');

        } else if (lang === 'pt') {
            // Esconde seções EN, mostra seções PT
            sectionsEn.forEach(el => el.style.display = 'none');
            sectionsPt.forEach(el => el.style.display = 'block');

            // Atualiza texto dos parágrafos traduzíveis para PT
            translatableParagraphs.forEach(p => {
                p.textContent = p.getAttribute('data-lang-pt') || p.textContent; // Usa PT ou mantém o atual se faltar atributo
            });

            // Atualiza botões
            btnEn.classList.remove('active');
            btnPt.classList.add('active');
        } else {
            console.warn("Idioma inválido solicitado:", lang);
        }
    }

    // Adiciona listeners aos botões
    btnEn.addEventListener('click', () => switchLanguage('en'));
    btnPt.addEventListener('click', () => switchLanguage('pt'));

    // Define o idioma inicial (pode mudar para 'pt' se preferir começar em português)
    switchLanguage('en');

});