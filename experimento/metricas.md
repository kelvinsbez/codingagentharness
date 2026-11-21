# Métricas do experimento

## 1. Objetivo

Definir os indicadores utilizados para comparar as implementações produzidas com e sem harness.

A comparação considerará os resultados das implementações, a qualidade dos testes produzidos, as violações arquiteturais, as intervenções humanas e o consumo de recursos.

## 2. Indicadores principais

### 2.1. Erros funcionais

Identificar problemas no comportamento das implementações em relação aos requisitos funcionais da especificação.

### 2.2. Violações arquiteturais

Identificar situações em que a implementação desrespeita as regras arquiteturais estabelecidas para o projeto.

Exemplos:
- Um handler importar diretamente outro handler.
- Comunicação direta entre handlers, ignorando o Event Bus.
- Descumprimento de outras regras arquiteturais estabelecidas.

### 2.3. Intervenções humanas

Registrar as intervenções necessárias durante o desenvolvimento para corrigir problemas, esclarecer instruções ou redirecionar o agente.

### 2.4. Consumo de recursos

Registrar a utilização da cota disponibilizada pelo agente de IA durante a implementação.

## 3. Indicador complementar: qualidade dos testes

Avaliar os testes automatizados produzidos por cada agente.

Serão considerados:
- Abrangência dos requisitos funcionais.
- Presença de cenários de sucesso e falha.
- Qualidade das verificações realizadas.
- Capacidade de identificar comportamentos incorretos.
- Confiabilidade dos testes.

A quantidade de testes produzidos também será registrada, mas não será considerada, isoladamente, uma medida de qualidade.

## 4. Registro dos resultados

Os resultados serão registrados separadamente para cada implementação.

A comparação deverá considerar os mesmos requisitos funcionais e as mesmas regras arquiteturais.

Os resultados dos testes produzidos pelos próprios agentes serão analisados separadamente dos problemas identificados durante a revisão das implementações.

## 5. Interpretação

Os indicadores serão analisados em conjunto.

Uma quantidade maior de testes aprovados, por exemplo, não representa necessariamente uma implementação melhor, assim como uma quantidade maior de testes produzidos não representa necessariamente maior qualidade.

O objetivo é identificar diferenças entre os resultados obtidos com e sem harness.