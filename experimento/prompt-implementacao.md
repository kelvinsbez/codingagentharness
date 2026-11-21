# Prompt de implementação — Pipeline de pedidos

Você deverá implementar um sistema de processamento de pedidos orientado a eventos, utilizando TypeScript e RxJS.

## 1. Instruções iniciais

Antes de implementar:

1. Leia integralmente `experimento/especificacao.md`.
2. Inspecione a estrutura e os arquivos existentes no repositório.
3. Identifique as dependências e configurações já disponíveis.
4. Apresente um breve plano de implementação.

Após apresentar o plano, prossiga com a implementação.

## 2. Implementação

Implemente integralmente o sistema descrito na especificação funcional.

A aplicação deverá ficar dentro do diretório `pipeline/` e contemplar as responsabilidades de domínio, infraestrutura, handlers e inicialização do sistema.

Utilize TypeScript e RxJS.

Implemente os serviços simulados de pagamento, estoque, transporte e notificação, permitindo representar operações bem-sucedidas, falhas técnicas, resultados de negócio e atrasos.

Respeite os eventos, fluxos de processamento e comportamentos de confiabilidade definidos na especificação.

Não acrescente funcionalidades, eventos ou requisitos que não estejam previstos no escopo.

## 3. Testes automatizados

Crie uma suíte de testes automatizados para verificar o comportamento da aplicação.

Os testes deverão contemplar:

- Processamento bem-sucedido de pedidos.
- Pagamento recusado.
- Estoque insuficiente e estorno.
- Timeout e retry.
- Limites de concorrência.
- Idempotência.
- Isolamento de erros.
- Encerramento do sistema.

Utilize serviços simulados com comportamentos previsíveis, evitando dependência de sorteios aleatórios.

Escolha e configure as ferramentas de teste necessárias, respeitando as ferramentas e configurações já disponíveis no projeto.

## 4. Validação

Após implementar:

1. Execute os testes automatizados.
2. Execute as verificações de código disponíveis no projeto.
3. Corrija os problemas identificados.
4. Execute novamente as verificações.
5. Não considere a implementação concluída enquanto houver falhas não justificadas.

Não remova, desative ou enfraqueça verificações existentes apenas para obter uma execução aprovada.

## 5. Entrega

Ao concluir, apresente:

- Resumo da implementação.
- Estrutura de arquivos criada.
- Ferramentas e dependências utilizadas.
- Testes implementados e respectivos resultados.
- Verificações executadas e respectivos resultados.
- Problemas conhecidos ou requisitos não atendidos.
- Decisões de implementação tomadas nos pontos em que a especificação permite liberdade.

Não modifique os documentos do experimento. Trabalhe exclusivamente na implementação e nos arquivos de configuração necessários dentro de `pipeline/`.