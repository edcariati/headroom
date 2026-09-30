# 7C — Offline: resumo (o desenho completo vem em `docs/offline/desenho.md`, com parada própria)

- **Leitura offline** do que foi aberto/pré-carregado da obra atual, com data da última sincronização sempre visível.
- **Fila de escrita** (IndexedDB) só para: diário e efetivo; fotos; inspeção de ficha; abrir ocorrência e registrar contato; marcar pacote da semana; apontamento/checklist de locação; entrega e conferência de recebimento; saída de estoque.
- **Só online:** liberar etapa, aprovar, pagar, emitir, encerrar, qualquer valor em R$, administração de usuários — com mensagem “esta ação precisa de internet”.
- **Sincronização:** UUID por operação (reenvio sem duplicar), ordem preservada, ao abrir o app/voltar a internet/por intervalo **(sem depender de sync em segundo plano)**.
- **Conflitos:** operações que só acrescentam não conflitam; edição guarda a `versao` base e, se o servidor mudou, guarda as duas versões e pede resolução. (A base já existe: o app v2 usa `versao` por linha e avisa conflito.)
- **Segurança:** cache só com o que o perfil pode ver (sem R$ para campo), apagado no logout e na revogação de sessão; fila preservada se a sessão expirar.
- **A verificar antes de codar** (não assumido): limpeza automática de armazenamento por navegador/iPhone e limites de cota.
