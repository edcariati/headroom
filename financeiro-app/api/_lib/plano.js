// Plano de contas inicial para escritório de arquitetura e gestão de obras (ajuste na tela Cadastros).
// Os ids são fixos para que a criação inicial seja idempotente.
const CATEGORIAS = [
  ['Projeto arquitetônico', 'receita', 'receita_bruta'], ['Projeto de interiores', 'receita', 'receita_bruta'],
  ['Gestão de obras', 'receita', 'receita_bruta'], ['Regularização e documentação', 'receita', 'receita_bruta'],
  ['Visitas técnicas e consultoria', 'receita', 'receita_bruta'], ['Outras receitas operacionais', 'receita', 'receita_bruta'],
  ['Rendimentos financeiros', 'receita', 'financeiras'], ['Outras receitas não operacionais', 'receita', 'nao_operacionais'],
  ['Impostos sobre faturamento', 'despesa', 'deducoes'], ['Taxas de cobrança e boletos', 'despesa', 'deducoes'],
  ['Projetos complementares (terceirizados)', 'despesa', 'custos_operacionais'], ['Engenheiros e consultores', 'despesa', 'custos_operacionais'],
  ['Maquetes, plotagens e impressões', 'despesa', 'custos_operacionais'],
  ['Pró-labore e salários', 'despesa', 'despesas_operacionais'], ['Encargos e benefícios', 'despesa', 'despesas_operacionais'],
  ['Aluguel e condomínio', 'despesa', 'despesas_operacionais'], ['Energia, água e internet', 'despesa', 'despesas_operacionais'],
  ['Softwares e assinaturas', 'despesa', 'despesas_operacionais'], ['Marketing', 'despesa', 'despesas_operacionais'],
  ['Contabilidade', 'despesa', 'despesas_operacionais'], ['Material de escritório', 'despesa', 'despesas_operacionais'],
  ['Alimentação e deslocamento', 'despesa', 'despesas_operacionais'],
  ['Juros e tarifas bancárias', 'despesa', 'financeiras'], ['Outras despesas não operacionais', 'despesa', 'nao_operacionais'],
];
const CENTROS = ['Administrativo', 'Comercial e marketing', 'Projetos', 'Obras'];

export const MARCADOR = 'dados/meta/plano.json';

export function registrosDoPlano() {
  return {
    categorias: CATEGORIAS.map(([nome, tipo, grupo_dre], i) => ({ id: `cat${String(i + 1).padStart(2, '0')}`, nome, tipo, grupo_dre })),
    centros: CENTROS.map((nome, i) => ({ id: `cc${i + 1}`, nome })),
  };
}
