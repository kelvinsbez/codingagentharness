# Coding Agent Harness

Um projeto experimental que investiga como a utilização de um Harness influencia o desenvolvimento de software realizado por agentes de inteligência artificial.

O experimento compara duas implementações da mesma aplicação orientada a eventos:

- **A — Sem Harness:** o agente recebe os requisitos funcionais e tem liberdade para organizar e configurar o projeto.
- **B — Com Harness:** o agente recebe os mesmos requisitos, além de instruções persistentes, restrições arquiteturais e ferramentas de validação automatizada.

As duas implementações utilizam TypeScript e RxJS e partem das mesmas condições iniciais, permitindo comparar os resultados obtidos.

## Sobre o projeto

A aplicação desenvolvida consiste em um pipeline de processamento de pedidos, executado inteiramente em memória e orientado a eventos.

O sistema simula as seguintes operações:

1. Criação de pedidos;
2. Processamento de pagamentos;
3. Reserva de estoque;
4. Agendamento de envio;
5. Notificação ao cliente.

Também contempla cenários de recusa de pagamento e insuficiência de estoque, incluindo o estorno do pagamento quando necessário.

Foram definidos requisitos adicionais de confiabilidade, como timeout, retry, limites de concorrência, idempotência, isolamento de erros e encerramento gracioso.

## Estrutura do repositório

```text
codingagentharness/
├── experimento/
│   ├── logs/
│   ├── especificacao.md
│   ├── metricas.md
│   ├── prompt-implementacao.md
│   └── regras-de-contagem.md
│
├── pipeline/
│   └── ...
│
└── README.md
```

As implementações estão organizadas em branches independentes:

| Branch | Descrição |
|---|---|
| `main` | Documentação e gerenciamento do experimento |
| `experimento/a-sem-harness` | Implementação sem Harness |
| `experimento/b-com-harness` | Implementação com Harness |

## Ferramentas do Harness

A implementação B utiliza as seguintes ferramentas e configurações:

- **AGENTS.md:** instruções persistentes que orientam o agente durante o desenvolvimento.
- **ESLint:** análise estática do código.
- **TypeScript:** verificação estática de tipos.
- **Dependency Cruiser:** validação das dependências e regras arquiteturais.
- **Jest:** execução dos testes automatizados.
- **npm run validate:** comando que reúne as verificações de lint, tipagem, arquitetura e testes.

## Critérios de avaliação

As implementações são comparadas considerando os seguintes critérios:

- Erros funcionais;
- Violações arquiteturais;
- Intervenções humanas;
- Consumo de recursos e cota;
- Qualidade dos testes.

A avaliação considera tanto o comportamento das aplicações quanto a organização do código-fonte e das suítes de testes.

## Como executar

Primeiro, escolha a implementação que deseja executar.

**Implementação A — Sem Harness**

```bash
git switch experimento/a-sem-harness
```

**Implementação B — Com Harness**

```bash
git switch experimento/b-com-harness
```

Em seguida, entre no diretório da aplicação e instale as dependências:

```bash
cd pipeline
npm ci
```

Para executar a implementação A:

```bash
npm test
npm run check
npm start
```

Para executar a implementação B:

```bash
npm run validate
npm start
```

## Resultados comparativos

Ambas as implementações executaram os três fluxos principais da aplicação e tiveram todos os testes aprovados.

| Métrica | A — Sem Harness | B — Com Harness |
|---|---:|---:|
| Testes aprovados | 14/14 | 17/17 |
| Erros funcionais comprovados | 0 | 0 |
| Violações arquiteturais comprovadas | 0 | 0 |

Os resultados indicam aderência funcional equivalente dentro dos requisitos avaliados. As implementações também apresentam diferenças na organização arquitetural e nas abordagens utilizadas nos testes.

A documentação do experimento e o relatório comparativo podem ser consultados no diretório `experimento/`.

---

*Projeto acadêmico desenvolvido para a disciplina de Paradigmas de Linguagens de Programação.*