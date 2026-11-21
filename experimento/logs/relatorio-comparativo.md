# Avaliação técnica comparativa das implementações A e B

## 1. Resumo executivo

**A e B apresentam aderência funcional equivalente na revisão estática.** Ambas implementam os fluxos de sucesso, recusa e compensação, limitam a concorrência por handler e preservam as operações pendentes durante o encerramento. A inspeção não identificou erro funcional ou violação arquitetural comprovada. B delimita melhor as responsabilidades dos handlers e verifica mais efeitos de ponta a ponta. A separa os contratos de serviço dos simuladores, verifica diretamente o efeito do timeout sobre o estoque e inclui a configuração da suíte no ZIP.

**Método.** A revisão confrontou a especificação v0.3 e o prompt de implementação com os fontes e testes de `implementacao-A.zip` e `implementacao-B.zip`. Os critérios vêm de `metricas.md` e `regras-de-contagem.md`. Os caminhos e linhas citados são internos ao respectivo ZIP. A análise foi exclusivamente estática. Nenhum sistema ou teste foi executado durante a revisão, nenhum teste foi criado e nenhum resultado de avaliação anterior foi utilizado.

| Evidência informada pelo solicitante nos ambientes de desenvolvimento | A | B |
|---|---:|---:|
| Testes executados | 14 | 17 |
| Aprovados | 14 | 17 |
| Reprovados | 0 | 0 |
| Verificação de tipos | Aprovada | Aprovada |
| Demonstração | Concluída com sucesso | Concluída com sucesso |

Esses registros documentam o resultado das execuções originais. A matriz da seção 6 identifica quais comportamentos as asserções efetivamente verificam.

## 2. Análise funcional de A

| Requisito | Leitura do código | Localização |
|---|---|---|
| Contrato, sucesso e recusa | Os oito eventos têm tipos discriminados, pedido associado e UUID a cada criação. A cobrança aprovada inicia a reserva. Reserva, agendamento e notificação produzem os eventos seguintes. A recusa de negócio é um valor normal e termina o fluxo sem retry nem reserva. | `domain/eventos.ts`, 4–30. `handlers/conectar.ts`, 55–86. |
| Estoque insuficiente e estorno | O simulador agrega as quantidades por produto e verifica a disponibilidade de todo o pedido antes do débito. A insuficiência transporta o identificador da cobrança. O simulador verifica seu vínculo com o pedido e a remove antes da publicação de `PagamentoEstornado`. | `infra/servicos-simulados.ts`, 53–84. `handlers/conectar.ts`, 55–61 e 72–77. |
| Timeout, retry e isolamento | Cada nova assinatura de `defer` inicia uma tentativa. O timeout de 2.000 ms aplica-se a cada tentativa. O retry admite três repetições com esperas de 100, 200 e 400 ms. O esgotamento da cobrança gera recusa técnica. Nas demais operações, a captura interna encerra apenas o processamento do evento afetado. | `handlers/conectar.ts`, 16–24, 43–49 e 64–69. |
| Concorrência e idempotência | O handler registra o `eventId` antes da fila. Cobrança e estorno compartilham cinco vagas. Estoque tem uma vaga, envio e notificação têm cinco cada. O retry pertence ao observable interno do `mergeMap`, de modo que o pedido ocupa a vaga durante o intervalo. Eventos distintos do mesmo pedido continuam elegíveis. | `handlers/conectar.ts`, 27–55, 72, 79 e 84. |
| Encerramento gracioso | O gerador fecha a entrada e interrompe o temporizador de geração. O barramento conta as publicações pendentes e o handler registra o trabalho antes da fila. Após a drenagem, a aplicação cancela as assinaturas e completa o barramento. | `infra/gerador.ts`, 28–57. `infra/barramento.ts`, 9–32. `handlers/conectar.ts`, 43–52. `main.ts`, 15–29. |

## 3. Análise funcional de B

| Requisito | Leitura do código | Localização |
|---|---|---|
| Contrato, sucesso e recusa | O domínio define os oito eventos. O barramento atribui um UUID na emissão e preserva o ID na republicação. A recusa de negócio termina antes do estoque. No sucesso, o evento de envio leva o rastreio devolvido pela transportadora até a mensageria. | `src/domain/eventos.ts`, 11–32. `src/infra/barramento.ts`, 14–28. `src/handlers/pagamento.ts`, 11–29. `src/handlers/estoque.ts`, 11–20. `src/handlers/envio.ts` e `src/handlers/notificacao.ts`, 11–14. |
| Estoque insuficiente e estorno | A reserva padrão agrega quantidades e verifica todos os saldos antes da alteração. O evento de insuficiência preserva o identificador da cobrança aprovada. O gateway registra a aprovação e remove a cobrança após o estorno. | `src/infra/servicos.ts`, 68–89 e 91–105. `src/handlers/estoque.ts`, 11–18. `src/handlers/pagamento.ts`, 13–17. |
| Timeout, retry e isolamento | Cada tentativa tem timeout de 2.000 ms. A lista de intervalos define três novas tentativas com esperas de 100, 200 e 400 ms. Esgotar a cobrança produz recusa técnica. Nas outras operações, a captura de erro dentro do processamento de cada evento preserva a assinatura para os demais pedidos. | `src/infra/processamento.ts`, 9–19 e 39–45. `src/handlers/pagamento.ts`, 20–28. |
| Concorrência e idempotência | Cada consumidor registra os IDs antes da fila. Os limites são 5/1/5/5 para pagamento, estoque, envio e notificação. Cobrança e estorno disputam as mesmas vagas. A operação interna inclui o retry e mantém a vaga durante a espera. | `src/infra/processamento.ts`, 28–46. Linha 11 de cada um dos quatro arquivos em `src/handlers/`. |
| Encerramento gracioso | A entrada fecha e o sinal de parada interrompe a geração. A contagem inclui eventos em distribuição, trabalho enfileirado, retries e novos eventos decorrentes de pedidos aceitos. A mesma promessa é devolvida em chamadas sucessivas de encerramento. A drenagem precede o cancelamento das assinaturas. | `src/infra/gerador.ts`, 11–32. `src/infra/atividades.ts`, 3–13. `src/infra/barramento.ts`, 14–31. `src/main.ts`, 25–38. |

## 4. Comparação arquitetural

| Critério | A | B | Classificação |
|---|---|---|---|
| Comunicação entre handlers | Cada etapa devolve um evento para publicação pelo trecho comum em `handlers/conectar.ts`, 43–49. | Os quatro módulos de `src/handlers/` consomem e publicam pelo barramento. | Regra atendida em ambas. Não se identificou importação ou chamada direta entre handlers. |
| Domínio e infraestrutura | As interfaces de serviço ficam em `domain/servicos.ts`, 10–23. Os simuladores ficam em infraestrutura. | Os tipos de pedido e evento ficam no domínio. Interfaces de serviço e simuladores compartilham `src/infra/servicos.ts`, 5–32 e 68–110. | Preferência de implementação. A especificação permite diferenças na organização física. |
| Injeção de dependências | A composição injeta o conjunto de serviços e o scheduler em `main.ts`, 9–12. | A composição injeta em cada handler apenas o serviço correspondente, em `src/main.ts`, 13–23. | Regra atendida em ambas. A oferece controle local do relógio. B restringe o conjunto de dependências de cada etapa. |
| Gerador e barramento | O gerador publica pedidos e usa um sinal próprio de parada. O barramento distribui eventos e conta atividades. | O gerador também apenas produz pedidos. O barramento delega a contagem a `Atividades`. | Regra atendida em ambas. O sinal privado de parada não caracteriza consumo de evento de negócio. |
| Assinaturas e desligamento | A agrega as assinaturas e limpa os IDs ao desligar em `handlers/conectar.ts`, 45–52, e `main.ts`, 20–28. | B agrega as assinaturas em `src/main.ts`, 18–23, cancela-as nas linhas 30–36 e limpa os IDs em `src/infra/processamento.ts`, 39–46. | Regra atendida em ambas. |

B facilita localizar e modificar uma responsabilidade de negócio isolada. A permite ler o encadeamento completo em um módulo e mantém os contratos fora da infraestrutura. Nenhuma dessas diferenças configura violação comprovada ou indício específico de problema arquitetural potencial.

## 5. Comparação da qualidade do código

| Aspecto | Evidência e avaliação |
|---|---|
| Clareza do fluxo RxJS | A usa `map` para construir o evento e centraliza sua publicação em `tap`. B publica dentro de `map`, produzindo o `Observable<void>` esperado pelo consumidor. Em A, o ponto em que ocorre o efeito de publicação é mais fácil de localizar. Ver A `handlers/conectar.ts`, 43–49 e 64–86, e B `src/infra/processamento.ts`, 28–44, e `src/handlers/envio.ts`, 11–14. |
| Coesão e acoplamento | A reúne as quatro etapas e a política de execução em `handlers/conectar.ts`, compartilhando a lógica sem duplicação. B extrai a política para `src/infra/processamento.ts` e deixa as decisões de negócio em módulos dedicados. A vantagem de B decorre da separação das responsabilidades e das dependências, independentemente da quantidade de arquivos. |
| TypeScript | As duas usam uniões discriminadas. Em A, um pagamento aprovado carrega `pagamentoId`. Em B, `EnvioAgendado` exige `rastreio`. A entrega `tsconfig.json` com `strict` e `noUncheckedIndexedAccess`. As opções de compilação de B no ambiente de desenvolvimento são indeterminadas a partir do ZIP. |
| Simuladores e tempo | Em A, cada roteiro recebe o pedido e o número da chamada. A resposta passa por `timer` com scheduler injetado, inclusive com atraso zero. Em B, o simulador emite com `of` quando o atraso é zero e usa `timer` para atraso positivo. Essa diferença ajuda a interpretar os testes de reentrância. Ver A `infra/servicos-simulados.ts`, 32–49, e B `src/infra/servicos.ts`, 35–65. |
| Tratamento de erros | As duas distinguem recusa comercial de falha técnica e capturam o erro no fluxo do evento correspondente. O uso de `EMPTY` após esgotar operações posteriores preserva os outros pedidos, mas deixa pouca informação diagnóstica sobre a causa final. A especificação não estabelece logging obrigatório nem permite criar um evento adicional para esse fim. |

## 6. Comparação da qualidade dos testes

Os números de linha nas colunas A e B referem-se a `test/pipeline.test.ts` do respectivo ZIP. “Sim” indica que existe uma asserção pertinente ao comportamento descrito.

| Requisito | Testado em A? | Testado em B? | Observações |
|---|---|---|---|
| Sucesso, ordem e IDs únicos | Sim, 33–67 | Sim, 42–57 | Ambas comparam a sequência por pedido e a unicidade dos IDs. B verifica também os argumentos da notificação e o rastreio por pedido. A exercita serviços síncronos com encerramento durante a distribuição do evento. |
| Recusa de negócio | Sim, 70–85 | Sim, 60–70 | As duas exigem motivo comercial, uma cobrança e zero chamadas de reserva. A contagem detecta inclusive uma chamada indevida que não chegue a publicar evento. |
| Estoque insuficiente e estorno | Sim, 88–107 | Sim, 73–85 e 237–285 | Ambas verificam a disputa por uma unidade e correlacionam o estorno à cobrança aprovada. A exige a chamada de estorno no próprio teste de disputa. B conta o efeito no teste de idempotência. |
| Timeout de 2 s por tentativa | Sim, 110–158 | Sim, 88–116 | A verifica o efeito de uma reserva atrasada sobre o saldo e os horários de cobrança e recusa. B instrumenta a finalização de cada tentativa e exige os instantes 2.000, 4.100, 6.300 e 8.700 ms. |
| Retry, intervalos e recuperação | Sim, 110–158 e 269–300 | Sim, 88–136 e 200–234 | Ambas verificam o máximo de quatro chamadas e os intervalos previstos. A verifica recuperação da reserva. B exige exatamente duas chamadas na recuperação da cobrança após uma falha técnica. |
| Limites 5/1/5/5 | Sim, 161–193 | Sim, 139–163 | A injeta eventos por etapa e compara todos os instantes de início com o lote esperado. B usa a entrada pública, verifica os lotes antes e depois da liberação das vagas e exige a sequência completa de todos os pedidos. |
| Vaga durante retry e limite comum de cobrança/estorno | Sim, 196–221 | Sim, 166–198 | A verifica o instante de início do estorno. B verifica que ele ainda não iniciou aos 99 ms e exige a compensação completa após a liberação da vaga. |
| Idempotência e IDs distintos do mesmo pedido | Sim, 224–266 | Sim, 237–285 | Ambas republicam eventos com o mesmo ID, contam efeitos nas cinco operações, inclusive estorno, e exercitam eventos diferentes do mesmo pedido. A compara a sequência de chamadas. B verifica contadores e eventos terminais. |
| Isolamento de falha técnica | Sim, 131–158 e 269–300 | Sim, 200–234 | Ambas cobrem falha definitiva na reserva, no envio, na notificação e no estorno. Exigem o fluxo parcial correto e a conclusão de um pedido posterior. B também verifica um pedido independente submetido antes do esgotamento. |
| Encerramento gracioso | Sim, 45–67 e 303–342 | Sim, 288–330 | Ambas verificam parada da geração, rejeição de novos pedidos, drenagem, fechamento observado e encerramento solicitado durante publicação. B exige também zero timers pendentes. O cancelamento das assinaturas dos handlers é identificável no código de composição. |

**Determinismo.** A usa `VirtualTimeScheduler` nos simuladores e no pipeline. B usa o relógio falso do Jest e restaura o relógio real depois de cada teste. Ambas fazem asserções temporais sem esperas reais. As verificações de UUID dependem da unicidade ou da correlação entre eventos, sem exigir valores aleatórios específicos.

**Possibilidade de falsos positivos.** Em A, o teste específico de concorrência mede o início das chamadas. Uma regressão posterior ao início de uma operação poderia escapar a esse teste isolado. B verifica também o fluxo terminal de cada pedido no mesmo caso. Em B, o teste específico de disputa de estoque exige o evento de estorno e sua correlação, porém não observa diretamente a chamada ao gateway. Outra prova, a de idempotência, conta essa chamada. A combina essas duas verificações no próprio teste de disputa.

**Reprodutibilidade.** A inclui `package.json`, `package-lock.json` e `tsconfig.json`. O comando de teste declarado é `npm run build && node --test dist/test/*.test.js`. B inclui apenas `src/` e `test/`. Os testes usam Jest, mas o ZIP não fixa suas versões, configuração ou comando. Isso limita a reprodução independente com o material entregue. O conteúdo do ZIP não estabelece quais arquivos estavam disponíveis no ambiente original.

## 7. Tabela consolidada de erros e violações

| Indicador | A | B |
|---|---:|---:|
| Erros funcionais comprovados | 0 | 0 |
| Violações arquiteturais comprovadas | 0 | 0 |
| Problemas potenciais com indício concreto de descumprimento no escopo | 0 | 0 |
| Requisitos não atendidos identificados no escopo funcional e arquitetural comum | 0 | 0 |

Zero significa que a inspeção não identificou ocorrência que cumpra os critérios de registro. Por isso, não há ocorrência individual à qual associar causa, requisito violado ou gravidade. A força das asserções e a limitação de reprodução da entrega B estão descritas na seção 6. Não se contabilizou a ausência de ferramentas como defeito funcional. Nenhuma interrupção de processamento ou perda de pedidos foi demonstrada pelos materiais analisados.

## 8. Pontos fortes e fracos de cada implementação

| Implementação | Pontos fortes | Limitações |
|---|---|---|
| A | Contratos de serviço separados, publicação de eventos centralizada, relógio injetável e configuração de teste incluída. Verifica o efeito do timeout sobre o estoque e associa a chamada de estorno à cobrança correta. | Quatro responsabilidades de negócio compartilham um módulo. O teste específico de concorrência depende de outros testes para verificar a conclusão do fluxo. |
| B | Handlers coesos com dependências específicas. Verifica o rastreio entregue à notificação, a finalização por timeout, a conclusão de cada pedido sob concorrência e a ausência de timers após a drenagem. | A publicação como efeito dentro de `map` é menos explícita. A prova do efeito do estorno está distribuída pela suíte. A configuração original do executor não acompanha o ZIP. |

## 9. Conclusão comparativa

- **Aderência à especificação.** Equivalente no escopo inspecionado. O código de ambas contempla os fluxos de negócio e os mecanismos de confiabilidade exigidos.
- **Organização arquitetural.** B tem vantagem na delimitação dos handlers e de suas dependências. A separa melhor os contratos de serviço dos simuladores. Ambas atendem às regras arquiteturais comuns.
- **Abrangência e confiabilidade dos testes.** B tem pequena vantagem na abrangência das asserções integradas, especialmente para concorrência, notificação e cancelamento de tentativas. A oferece melhor reprodutibilidade a partir do ZIP e prova mais direta do efeito de um timeout sobre o estoque. Ambas controlam o tempo. Os registros fornecidos não permitem comparar estabilidade entre execuções repetidas.
- **Peso das evidências.** A testa os quatro limites de concorrência dentro de um único caso. B usa quatro casos parametrizados para o mesmo requisito. A diferença entre 14 e 17 aprovações, portanto, não demonstra por si só cobertura adicional. As diferenças sustentadas estão nos efeitos observados pelas asserções, na organização dos componentes e no conteúdo entregue para reprodução.