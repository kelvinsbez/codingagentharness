# Regras de Contagem — Experimento com Harness

## 1. Objetivo

Estabelecer critérios consistentes para registrar e comparar os resultados das implementações A e B.

## 2. Erros funcionais

Será contabilizado um erro para cada problema funcional distinto identificado na implementação.

Regras:

- Falhas em vários testes causadas pelo mesmo problema serão contabilizadas como um único erro.
- Problemas com causas diferentes serão contabilizados separadamente.
- Um problema deverá possuir evidência que permita identificar o comportamento incorreto.
- Sempre que possível, o erro deverá ser associado ao requisito funcional correspondente.

## 3. Violações arquiteturais

Será contabilizada cada ocorrência distinta de descumprimento das regras arquiteturais estabelecidas.

Regras:

- Cada dependência proibida identificada será registrada como uma violação.
- Uma mesma violação identificada por ferramentas diferentes será contabilizada apenas uma vez.
- Violações diferentes deverão ser registradas separadamente.
- Cada ocorrência deverá indicar a regra arquitetural desrespeitada e o local correspondente no código.

## 4. Intervenções humanas

Será contabilizada uma intervenção cada vez que for necessário corrigir, orientar ou redirecionar o agente durante o desenvolvimento.

Exemplos:

- Corrigir uma interpretação equivocada dos requisitos.
- Solicitar a correção de uma implementação incorreta.
- Redirecionar uma decisão arquitetural inadequada.
- Realizar alterações manuais para corrigir problemas no código.

Uma mesma interação corretiva será contabilizada como uma intervenção, mesmo quando abordar mais de um problema relacionado.

Instruções iniciais e interações rotineiras que não envolvam correção ou redirecionamento não serão contabilizadas.

## 5. Consumo de recursos

Será registrado o percentual de cota consumido durante cada etapa do desenvolvimento.

Sempre que possível, serão registrados:

- Consumo durante a implementação.
- Consumo durante a criação e correção dos testes.
- Consumo durante as correções solicitadas.
- Consumo total da execução.

Os registros deverão indicar os valores apresentados pela plataforma utilizada.

## 6. Qualidade dos testes produzidos

A qualidade dos testes será avaliada considerando:

- Cobertura dos requisitos funcionais.
- Verificação dos resultados esperados.
- Presença de cenários de sucesso e falha.
- Capacidade de identificar comportamentos incorretos.
- Reprodutibilidade dos resultados.

A quantidade de testes será registrada separadamente.

Uma quantidade maior de testes não será considerada, isoladamente, evidência de maior qualidade.

Os testes reprovados deverão ser analisados para distinguir falhas de implementação, erros nos próprios testes e problemas no ambiente de execução.

## 7. Registro das ocorrências

Cada ocorrência deverá possuir, quando aplicável:

- Identificação do problema.
- Descrição.
- Implementação em que foi encontrada.
- Requisito ou regra relacionada.
- Evidência ou localização no código.
- Resultado da análise.

## 8. Comparação final

Os resultados serão apresentados separadamente para A e B.

A análise deverá considerar os indicadores em conjunto, evitando conclusões baseadas exclusivamente na quantidade de testes, erros ou violações.

As diferenças encontradas deverão ser acompanhadas de evidências que permitam compreender os resultados.