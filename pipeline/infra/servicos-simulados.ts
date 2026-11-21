import { randomUUID } from "node:crypto";
import { asyncScheduler, defer, map, timer, type SchedulerLike } from "rxjs";
import type { Pedido } from "../domain/pedido";
import type { ResultadoEstoque, ResultadoPagamento, Servicos } from "../domain/servicos";

type Comportamento<Resultado> = { readonly atrasoMs?: number } & (
  | { readonly resultado?: Resultado; readonly erro?: never }
  | { readonly erro: Error; readonly resultado?: never }
);

type Roteiro<Resultado = void> = (
  pedido: Pedido,
  chamada: number,
) => Comportamento<Resultado> | undefined;

interface ConfiguracaoSimulacao {
  readonly estoqueInicial?: Readonly<Record<string, number>>;
  readonly cobrar?: Roteiro<ResultadoPagamento["status"]>;
  readonly estornar?: Roteiro;
  readonly reservar?: Roteiro<"insuficiente">;
  readonly agendar?: Roteiro;
  readonly notificar?: Roteiro;
}

export function criarServicosSimulados(
  configuracao: ConfiguracaoSimulacao = {},
  scheduler: SchedulerLike = asyncScheduler,
): Servicos {
  const saldo = new Map(Object.entries(configuracao.estoqueInicial ?? {}));
  const pagamentos = new Map<string, string>();

  function simular<Resultado, Valor>(
    roteiro: Roteiro<Resultado> | undefined,
    executar: (pedido: Pedido, resultado: Resultado | undefined, pagamentoId?: string) => Valor,
  ) {
    const chamadas = new Map<string, number>();
    return (pedido: Pedido, pagamentoId?: string) => defer(() => {
      const chamada = (chamadas.get(pedido.id) ?? 0) + 1;
      chamadas.set(pedido.id, chamada);
      const comportamento = roteiro?.(pedido, chamada);

      return timer(comportamento?.atrasoMs ?? 0, scheduler).pipe(
        map(() => {
          if (comportamento?.erro) {
            throw comportamento.erro;
          }
          return executar(pedido, comportamento?.resultado, pagamentoId);
        }),
      );
    });
  }

  const cobrar = simular(configuracao.cobrar, (pedido, resultado): ResultadoPagamento => {
    if (resultado === "recusado") {
      return { status: "recusado" };
    }
    const pagamentoId = randomUUID();
    pagamentos.set(pagamentoId, pedido.id);
    return { status: "aprovado", pagamentoId };
  });

  const estornar = simular(configuracao.estornar, (pedido, _resultado, pagamentoId) => {
    if (pagamentoId === undefined || pagamentos.get(pagamentoId) !== pedido.id) {
      throw new Error("Pagamento aprovado não encontrado para estorno");
    }
    pagamentos.delete(pagamentoId);
  });

  const reservar = simular(configuracao.reservar, (pedido, resultado): ResultadoEstoque => {
    const quantidades = new Map<string, number>();
    for (const { produtoId, quantidade } of pedido.itens) {
      quantidades.set(produtoId, (quantidades.get(produtoId) ?? 0) + quantidade);
    }

    if (resultado === "insuficiente" || [...quantidades].some(
      ([produtoId, quantidade]) => (saldo.get(produtoId) ?? 0) < quantidade,
    )) {
      return "insuficiente";
    }

    for (const [produtoId, quantidade] of quantidades) {
      saldo.set(produtoId, (saldo.get(produtoId) ?? 0) - quantidade);
    }
    return "reservado";
  });

  return {
    pagamento: { cobrar, estornar },
    estoque: { reservar },
    transporte: { agendar: simular(configuracao.agendar, () => undefined) },
    mensagens: { notificar: simular(configuracao.notificar, () => undefined) },
  };
}
