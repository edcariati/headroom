// Cardápio completo do Escritório Petiscos & Cia (fonte: cardápios impressos da casa).
// Os lanches "Vida de Escritório" vêm da API (editáveis no painel); o resto está aqui.
window.CARDAPIO_CASA = {
  // Reserva de bebidas e doces (mesma lista de valores da API), usada só se a API não responder.
  extrasIniciais: {
    bebidas: [
      ["Refrigerantes", "Coca-Cola lata 350 ml", 6], ["Refrigerantes", "Guaraná lata 350 ml", 6],
      ["Refrigerantes", "Refrigerante 600 ml", 9], ["Refrigerantes", "Refrigerante 2 litros", 14],
      ["Sucos", "Suco natural de laranja", 10], ["Sucos", "Suco natural de limão", 8], ["Sucos", "Suco de polpa", 9, "Pergunte os sabores do dia."],
      ["Águas", "Água mineral sem gás 500 ml", 4], ["Águas", "Água mineral com gás 500 ml", 5], ["Águas", "Água de coco", 7],
      ["Cervejas", "Cerveja lata 350 ml", 8], ["Cervejas", "Cerveja long neck", 10],
    ],
    doces: [
      ["Sobremesas", "Pudim de leite", 9], ["Sobremesas", "Mousse de maracujá", 10], ["Sobremesas", "Pavê", 10],
      ["Doces", "Brigadeiro", 3], ["Doces", "Bolo do dia", 8, "Pergunte o sabor."], ["Sorvetes", "Sorvete (1 bola)", 7],
    ],
  },
  // Reserva dos lanches "Vida de Escritório", usada só se a API não responder (os nomes e preços oficiais vêm do painel).
  lanches: [
    [1, "Burger clássico", "CLT", "Pão, carne, queijo muçarela, maionese e catupiry.", 33.9],
    [2, "Burger salada", "13º", "Pão, carne, queijo muçarela, maionese, catupiry, tomate, cebola e repolho.", 35.9],
    [3, "Bacon", "PJ", "Pão, carne, queijo muçarela, repolho, maionese, catupiry e tomate.", 39.9],
    [4, "Onion Burger", "Hora Extra", "Pão, carne, queijo cheddar, barbecue e anéis de cebola empanados.", 37.9],
    [5, "Bacon MK", "Bônus do Mês", "Pão, carne, queijo provolone, bacon e doce de leite.", 36.9],
    [6, "Burgueritos", "Negócio Fechado", "Pão, carne, queijo cheddar Polenghi, maionese e Doritos.", 35.9],
    [7, "Toscana", "Sextou na Chapa", "Pão, carne, linguiça toscana, queijo provolone, maionese, rúcula e abacaxi chapeado.", 41.9],
    [8, "Gorgon Burger", "Ideia Genial", "Pão, carne, queijo gorgonzola, cebola caramelizada no barbecue com mel e rúcula.", 38.9],
    [9, "Frango", "Férias", "Pão, frango empanado ou filé, repolho, queijo provolone, maionese e catupiry.", 32.9],
    [10, "Kids", "Meio Período", "Pão, carne e queijo muçarela.", 29.9],
    [11, "Vegano", "Expediente Verde", "Pão, carne e queijo veganos, tomate, rúcula e cebola.", 34.9],
    [12, "Double", "Expediente Duplo", "Pão, 2 carnes, 2 queijos cheddar, maionese, catupiry e tomate.", 59.9],
    [13, "Alma Gêmea", "Direitos Iguais", "Pão, carne, queijo muçarela e goiabada.", 34.9],
  ],
  executivos: {
    nota: "Todos os pratos acompanham arroz, feijão, farofa e salada, conforme a composição de cada prato.",
    grupos: [
      { titulo: "Carne bovina", icone: "🐄", obs: "Acompanha arroz e batata frita. Não acompanha feijão.", itens: [["Bife acebolado", 29.9], ["Bife à milanesa", 34.9], ["Bife à parmegiana", 39.9]] },
      { titulo: "Frango", icone: "🐔", obs: "Acompanha arroz e batata frita. Não acompanha feijão.", itens: [["Filé de frango acebolado", 24.9], ["Filé de frango à milanesa", 28.9], ["Filé de frango à parmegiana", 33.9]] },
      { titulo: "Carne suína", icone: "🐖", itens: [["Bisteca suína acebolada", 24.9]] },
    ],
  },
  especiais: [
    { dia: "Terça", tema: "Dia do strogonoff", chamada: "Terça tem sabor!", texto: "Todo o sabor de um clássico, para deixar sua terça muito mais especial.", itens: [["Strogonoff de carne", 31.9], ["Strogonoff de frango", 25.9]] },
    { dia: "Quinta", tema: "Quinta da massa", chamada: "Quinta tem massa!", texto: "Massas que aquecem o coração e reúnem boas companhias.", itens: [["Lasanha", 29.9], ["Espaguete à bolonhesa", 25.9], ["Nhoque à bolonhesa", 27.9]] },
    { dia: "Sexta", tema: "Sexta do peixe", chamada: "Sexta tem peixe!", texto: "Peixes selecionados, preparados com todo o cuidado para um final de semana ainda melhor.", itens: [["Filé de merluza", 26.9], ["Filé de merluza à milanesa", 28.9], ["Filé de tilápia", 35.9], ["Filé de tilápia à milanesa", 38.9]] },
    { dia: "Sábado", tema: "Feijoada da casa", chamada: "Sábado tem feijoada!", texto: "A tradicional feijoada do Escritório, feita com ingredientes selecionados e aquele sabor que todo mundo adora.", itens: [["Feijoada da casa", 29.9], ["Extra: bisteca suína na chapa", 8.9]] },
  ],
  chapa: {
    nota: "Todos os pratos acompanham arroz, feijão, farofa, batata frita e salada.",
    itens: [
      { nome: "Filé-mignon à parmegiana", texto: "Suculência e sofisticação em um clássico que nunca sai de moda.", opcoes: [["Individual", 94.9], ["Para 2 pessoas", 169.9]] },
      { nome: "Picanha na chapa", texto: "A nobreza da picanha, no ponto certo, com todo o sabor da brasa.", opcoes: [["Individual (225 g)", 89.9], ["Para compartilhar (450 g)", 149.9]] },
      { nome: "Contrafilé na chapa", texto: "Tradição e sabor, servidos como tem que ser: na chapa.", opcoes: [["Individual (225 g)", 54.9], ["Para 2 pessoas (450 g)", 99.9]] },
    ],
  },
  leves: [
    { titulo: "Omeletes", sub: "Simples, nutritivos e deliciosos.", itens: [["Ovo mexido", 8.9, "Ovos mexidos, preparados com todo o sabor da casa."], ["Omelete de queijo", 9.9, "Ovos, queijo e temperos especiais."], ["Omelete de queijo e presunto", 11.9, "Ovos, queijo, presunto e temperos especiais."], ["Omelete especial", 13.9, "Ovos, queijo, presunto, tomate, cebola e temperos especiais."]] },
    { titulo: "Lanches naturais", sub: "Leveza e muito sabor.", itens: [["Lanche natural de queijo e presunto", 9.9, "Alface, tomate, queijo e presunto."], ["Lanche natural de queijo e salame", 13.9, "Alface, tomate, queijo e salame."]] },
    { titulo: "Pães especiais", sub: "Clássicos que sempre combinam.", itens: [["Pão na chapa", 5.5, "Pão tostado na chapa com manteiga."], ["Pão com ovo", 8.5, "Pão na chapa com ovos mexidos."], ["Misto quente", 12.9, "Pão na chapa com presunto e queijo derretido."], ["Pão, ovo, queijo e rúcula", 14.9, "Pão na chapa com ovos mexidos, queijo e rúcula fresca."]] },
    // Cafés fixos do Café e Bom Dia (os outros cafés vêm da aba Cardápio do painel, categoria "Cafés").
    { titulo: "Cafés", sub: "Passado na hora.", itens: [["Cafézinho coado (80 ml)", 4.5, "Passado na hora."], ["Café com leite coado (190 ml)", 6.5]] },
    { titulo: "Extras", sub: "Adicione mais sabor ao seu pedido.", itens: [["Ovo", 3.0], ["Bacon", 5.9], ["Cheddar", 4.9], ["Catupiry", 4.9], ["Muçarela", 4.9]] },
  ],
};
