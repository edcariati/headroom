-- Protocolos de entrega ao cliente (além de Prefeitura, condomínio e outros órgãos)
alter type protocolo_tipo add value if not exists 'entrega_cliente';
