# Instruções de desenvolvimento — Pipeline de pedidos

## 1. Objetivo

Desenvolver o sistema descrito em `experimento/especificacao.md`, utilizando TypeScript e RxJS.

A especificação funcional é a referência principal para os comportamentos esperados.

Estas instruções complementam a especificação, estabelecendo orientações e restrições arquiteturais para a implementação.

Não amplie o escopo funcional nem crie eventos ou funcionalidades adicionais sem necessidade.

## 2. Organização do projeto

Toda a implementação da aplicação deverá ficar dentro de `pipeline/`.

A estrutura deverá contemplar as seguintes responsabilidades:

- `pipeline/src/domain/`: tipos e definições do domínio.
- `pipeline/src/infra/`: barramento de eventos e serviços simulados.
- `pipeline/src/handlers/`: handlers responsáveis pelo processamento dos eventos.
- `pipeline/src/main.ts`: composição e inicialização do sistema.
- `pipeline/test/`: testes automatizados.

Não concentre toda a implementação em um único arquivo.

## 3. Regras arquiteturais

### 3.1. Domain

O domínio deverá ser independente das demais camadas da aplicação.

Não deverá importar módulos de infraestrutura ou handlers.

### 3.2. Infraestrutura

A infraestrutura poderá depender do domínio.

Não deverá importar handlers nem executar regras de negócio pertencentes a eles.

### 3.3. Handlers

Cada handler deverá possuir responsabilidades próprias.

É proibido:

- Importar um handler diretamente de outro handler.
- Invocar métodos de outro handler.
- Estabelecer comunicação direta entre handlers.

A comunicação deverá ocorrer exclusivamente por meio do barramento de eventos.

### 3.4. Barramento de eventos

O barramento deverá funcionar como meio central de comunicação entre os handlers.

Não deverá conter regras de negócio específicas de pagamento, estoque, envio ou notificação.

### 3.5. Injeção de dependência

Os serviços simulados deverão ser fornecidos aos handlers externamente.

Os handlers não deverão criar diretamente suas próprias implementações concretas de serviços externos.

### 3.6. Composição do sistema

O arquivo `main.ts` deverá conectar os componentes, fornecer as dependências e inicializar o sistema.

As regras de negócio deverão permanecer nos respectivos handlers.

### 3.7. Programação reativa

Utilize os operadores do RxJS para compor e transformar os fluxos de eventos.

Evite assinaturas aninhadas, especialmente `subscribe` dentro de outro `subscribe`.

As falhas individuais de processamento deverão ser tratadas sem encerrar o fluxo global de eventos.

As assinaturas deverão possuir gerenciamento adequado de ciclo de vida, incluindo seu cancelamento durante o encerramento do sistema.

## 4. Confiabilidade e processamento

Respeite os requisitos de timeout, retry, concorrência, idempotência, isolamento de erros e cancelamento definidos em `experimento/especificacao.md`.

Não substitua os valores definidos na especificação por outros.

## 5. Testes automatizados

Os testes deverão ficar em `pipeline/test/`.

Utilize serviços simulados com comportamentos previsíveis para verificar os cenários descritos na especificação.

Os testes deverão contemplar tanto os fluxos bem-sucedidos quanto falhas e situações excepcionais.

Evite depender exclusivamente de comportamentos aleatórios.

Os testes deverão verificar os resultados observáveis do sistema, não apenas a execução de métodos internos.

## 6. Processo de desenvolvimento

Antes de implementar funcionalidades:

1. Leia a especificação funcional.
2. Analise a estrutura existente.
3. Apresente um breve plano de implementação.

Durante o desenvolvimento:

- Preserve as responsabilidades de cada camada.
- Não ignore as restrições arquiteturais.
- Não remova ou enfraqueça mecanismos de validação para fazer verificações passarem.
- Evite adicionar dependências sem necessidade.

Após implementar alterações:

1. Execute os testes disponíveis.
2. Execute as verificações de código configuradas.
3. Corrija os problemas encontrados.
4. Informe quais verificações foram executadas e seus resultados.

Se encontrar contradições entre a especificação e estas instruções, apresente o conflito antes de tomar uma decisão que altere os requisitos.