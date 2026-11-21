# Especificação funcional — Pipeline de pedidos orientado a eventos

**Versão:** 0.3
**Linguagem:** TypeScript
**Biblioteca reativa:** RxJS
**Ambiente:** Node.js
**Execução:** Local, em memória e pelo terminal.

## 1. Objetivo

Implementar um sistema de processamento de pedidos de uma loja utilizando programação reativa e arquitetura orientada a eventos.

O sistema deverá processar pedidos desde sua criação até a notificação do cliente, passando pelas etapas de pagamento, reserva de estoque e agendamento de entrega.

A comunicação entre os módulos deverá ocorrer por meio de um barramento de eventos.

## 2. Escopo

O sistema deverá funcionar inteiramente em memória.

Não deverão ser implementados:

- Interface gráfica.
- Banco de dados.
- Comunicação real com serviços externos.
- APIs ou servidores de rede.

Os serviços externos serão representados por implementações simuladas, incluindo gateway de pagamento, controle de estoque, transportadora e serviço de mensagens.

Os serviços simulados poderão apresentar atrasos e falhas técnicas, permitindo testar os mecanismos de confiabilidade do sistema.

## 3. Componentes do sistema

### 3.1. Gerador de pedidos

Responsável por criar pedidos de teste e publicá-los no barramento de eventos.

Deverá publicar `PedidoCriado`.

Não deverá consumir ou assinar eventos do sistema.

### 3.2. Barramento de eventos

Responsável por centralizar a publicação e distribuição dos eventos.

Deverá utilizar os recursos de programação reativa do RxJS.

Não deverá conter regras de negócio dos handlers.

### 3.3. Handler de pagamento

Responsável por processar pagamentos dos pedidos.

Deverá:

- Escutar `PedidoCriado`.
- Processar o pagamento por meio do serviço simulado.
- Publicar `PagamentoAprovado` quando o pagamento for aprovado.
- Publicar `PagamentoRecusado` quando o pagamento for recusado ou quando as tentativas técnicas forem esgotadas.
- Escutar `EstoqueInsuficiente`.
- Desfazer pagamentos anteriormente aprovados quando necessário, publicando `PagamentoEstornado`.

Uma recusa de negócio deverá ser tratada como resultado da operação, não como falha técnica.

### 3.4. Handler de estoque

Responsável pela reserva dos produtos dos pedidos.

Deverá:

- Escutar `PagamentoAprovado`.
- Tentar reservar os produtos por meio do serviço simulado.
- Publicar `EstoqueReservado` quando a reserva for concluída.
- Publicar `EstoqueInsuficiente` quando o serviço informar que não há disponibilidade suficiente.

### 3.5. Handler de envio

Responsável pelo agendamento da entrega.

Deverá:

- Escutar `EstoqueReservado`.
- Solicitar o agendamento ao serviço simulado de transporte.
- Publicar `EnvioAgendado` quando o agendamento for concluído.

### 3.6. Handler de notificação

Responsável por notificar o cliente após o agendamento da entrega.

Deverá:

- Escutar `EnvioAgendado`.
- Solicitar o envio da mensagem ao serviço simulado.
- Publicar `NotificacaoEnviada` quando a operação for concluída.

### 3.7. Serviços simulados

O sistema deverá possuir serviços simulados para:

- Gateway de pagamento, incluindo cobrança e estorno.
- Controle de estoque.
- Transportadora.
- Serviço de mensagens.

Os serviços deverão permitir comportamentos previsíveis e controláveis, incluindo atrasos, resultados de negócio e falhas técnicas.

Deverão ser fornecidos aos respectivos handlers por injeção de dependência, permitindo sua substituição por implementações alternativas durante os testes.

## 4. Contrato de eventos

Os seguintes eventos deverão existir no sistema:

| Evento | Publicador | Consumidor |
|---|---|---|
| `PedidoCriado` | Gerador | Pagamento |
| `PagamentoAprovado` | Pagamento | Estoque |
| `PagamentoRecusado` | Pagamento | Nenhum |
| `EstoqueReservado` | Estoque | Envio |
| `EstoqueInsuficiente` | Estoque | Pagamento |
| `PagamentoEstornado` | Pagamento | Nenhum |
| `EnvioAgendado` | Envio | Notificação |
| `NotificacaoEnviada` | Notificação | Nenhum |

Os nomes dos eventos deverão ser preservados.

Cada evento deverá possuir um identificador único (`eventId`) e permitir identificar o pedido ao qual está associado.

Os eventos deverão transportar os dados necessários para o processamento de seus respectivos consumidores.

A estrutura interna dos payloads e dos objetos de pedido ficará a critério da implementação.

## 5. Fluxos de processamento

### 5.1. Processamento bem-sucedido

O fluxo deverá ocorrer na seguinte ordem:

1. O gerador publica `PedidoCriado`.
2. O pagamento processa a cobrança e publica `PagamentoAprovado`.
3. O estoque reserva os produtos e publica `EstoqueReservado`.
4. O envio agenda a entrega e publica `EnvioAgendado`.
5. A notificação comunica o cliente e publica `NotificacaoEnviada`.

### 5.2. Pagamento recusado

1. O gerador publica `PedidoCriado`.
2. O pagamento identifica a recusa.
3. O pagamento publica `PagamentoRecusado`.
4. O fluxo daquele pedido é encerrado.

Nenhuma reserva de estoque deverá ocorrer.

### 5.3. Estoque insuficiente

1. O gerador publica `PedidoCriado`.
2. O pagamento aprova a cobrança e publica `PagamentoAprovado`.
3. O estoque identifica a indisponibilidade e publica `EstoqueInsuficiente`.
4. O pagamento consome esse evento e desfaz a cobrança.
5. O pagamento publica `PagamentoEstornado`.

Esse processo representa uma compensação: uma operação já realizada é desfeita por meio de um novo evento.

## 6. Comportamentos de processamento e confiabilidade

### 6.1. Timeout

Cada tentativa de operação em um serviço externo deverá possuir um limite de 2 segundos.

Caso esse limite seja ultrapassado, a tentativa deverá sofrer timeout e ser tratada como uma falha técnica.

Um timeout permitirá uma nova tentativa, desde que ainda existam tentativas disponíveis.

### 6.2. Retry

Falhas técnicas temporárias deverão provocar novas tentativas.

O sistema deverá realizar uma tentativa inicial e permitir até 3 novas tentativas, totalizando no máximo 4 chamadas ao serviço.

Os intervalos de espera serão:

- 100 ms antes da primeira nova tentativa.
- 200 ms antes da segunda nova tentativa.
- 400 ms antes da terceira nova tentativa.

Após esgotar as tentativas:

- No pagamento, a operação deverá resultar em `PagamentoRecusado`.
- Nos demais serviços, a falha deverá ser isolada ao processamento correspondente, sem publicar eventos que indiquem sucesso ou confundir uma falha técnica com um resultado de negócio.

Não deverão ser criados eventos adicionais ou novos fluxos de compensação para essas falhas técnicas.

### 6.3. Concorrência limitada

O processamento simultâneo deverá respeitar os seguintes limites:

| Handler | Concorrência máxima |
|---|---:|
| Pagamento | 5 |
| Estoque | 1 |
| Envio | 5 |
| Notificação | 5 |

Os limites representam a quantidade máxima de pedidos em processamento simultâneo por handler.

Um pedido continuará ocupando sua vaga de concorrência durante suas tentativas e intervalos de espera entre retries.

O handler de estoque deverá processar um pedido por vez, pois diferentes pedidos podem disputar a mesma quantidade disponível de produtos.

### 6.4. Idempotência

Todos os handlers deverão ser idempotentes.

Cada evento deverá possuir um identificador único (`eventId`).

O recebimento duplicado de um mesmo evento não poderá provocar a repetição de uma operação já realizada.

Exemplos:

- Não cobrar duas vezes em decorrência da duplicação de `PedidoCriado`.
- Não reservar duas vezes em decorrência da duplicação de `PagamentoAprovado`.
- Não agendar duas vezes em decorrência da duplicação de `EstoqueReservado`.
- Não notificar duas vezes em decorrência da duplicação de `EnvioAgendado`.

Eventos diferentes associados ao mesmo pedido deverão continuar sendo processados normalmente.

### 6.5. Isolamento de erros

Uma falha durante o processamento de um pedido não deverá encerrar o barramento de eventos nem impedir o processamento dos demais pedidos.

Os erros deverão ser tratados dentro dos respectivos fluxos de processamento.

Uma falha técnica deverá ser distinguida de um resultado de negócio.

### 6.6. Cancelamento

O sistema deverá oferecer um mecanismo de encerramento gracioso (*Graceful Shutdown*).

Ao solicitar o desligamento, deverá:

- Interromper a geração de novos pedidos.
- Impedir a aceitação de novos pedidos.
- Permitir que os pedidos já aceitos terminem seu processamento.
- Aguardar eventos pendentes, operações em andamento e retries.
- Cancelar todas as assinaturas dos handlers após o término dos processamentos pendentes.
- Liberar os recursos mantidos pelo sistema.

## 7. Organização lógica

A implementação deverá contemplar responsabilidades equivalentes às seguintes áreas:

- `domain/`: tipos relacionados aos pedidos e eventos.
- `infra/`: barramento de eventos e serviços simulados.
- `handlers/`: componentes responsáveis pelo processamento dos eventos.
- `main.ts`: inicialização e conexão dos componentes.
- `test/`: testes automatizados.

A organização física interna dos arquivos poderá ser definida durante a implementação, desde que as responsabilidades funcionais sejam preservadas.

O fluxo de processamento deverá ser orientado a eventos, utilizando o barramento como meio de comunicação entre os handlers.

## 8. Testes automatizados

O projeto deverá incluir testes automatizados que verifiquem o comportamento do sistema.

Os testes deverão contemplar os requisitos funcionais e os mecanismos de confiabilidade, incluindo cenários de sucesso, falha e situações excepcionais.

Os serviços simulados deverão permitir testar comportamentos previsíveis, sem depender exclusivamente de sorteios aleatórios.

## 9. Critérios gerais de conclusão

A implementação será considerada funcionalmente completa quando:

1. Processar corretamente pedidos bem-sucedidos.
2. Encerrar corretamente pedidos com pagamento recusado.
3. Executar a compensação em caso de estoque insuficiente.
4. Respeitar timeout e retry.
5. Respeitar os limites de concorrência.
6. Garantir idempotência.
7. Isolar erros entre os pedidos.
8. Encerrar corretamente as assinaturas e a geração de pedidos.
9. Incluir testes automatizados para verificar os comportamentos implementados.

As decisões de implementação não especificadas neste documento ficarão a critério da implementação, desde que os requisitos funcionais sejam respeitados.