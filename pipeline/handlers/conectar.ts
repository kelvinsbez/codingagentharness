import {
  EMPTY, Subscription, catchError, defer, filter, finalize, first, map, mergeMap, of,
  retry, tap, timeout, timer, type Observable, type SchedulerLike,
} from "rxjs";
import { criarEvento, type Evento, type TipoEvento } from "../domain/eventos";
import type { Servicos } from "../domain/servicos";
import type { Barramento } from "../infra/barramento";

export function conectarHandlers(
  barramento: Barramento,
  servicos: Servicos,
  scheduler: SchedulerLike,
): Subscription {
  const assinaturas = new Subscription();

  function tentar<Resultado>(operacao: () => Observable<Resultado>): Observable<Resultado> {
    return defer(operacao).pipe(
      timeout({ first: 2_000, scheduler }),
      first(),
      retry({
        count: 3,
        delay: (_erro, repeticao) => timer(100 * 2 ** (repeticao - 1), scheduler),
      }),
    );
  }

  function conectar<Tipo extends TipoEvento>(
    tipos: readonly Tipo[],
    concorrencia: number,
    processar: (evento: Extract<Evento, { tipo: Tipo }>) => Observable<Evento>,
  ): void {
    const vistos = new Set<string>();
    const assinatura = barramento.eventos$.pipe(
      filter((evento): evento is Extract<Evento, { tipo: Tipo }> =>
        tipos.some((tipo) => tipo === evento.tipo)),
      filter(({ eventId }) => {
        if (vistos.has(eventId)) {
          return false;
        }
        vistos.add(eventId);
        return true;
      }),
      // A atividade começa na entrada da fila e termina após todos os retries.
      map((evento) => ({ evento, concluir: barramento.iniciarAtividade() })),
      mergeMap(({ evento, concluir }) => defer(() => processar(evento)).pipe(
        tap((resultado) => barramento.publicar(resultado)),
        catchError(() => EMPTY),
        finalize(concluir),
      ), concorrencia),
    ).subscribe();
    assinatura.add(() => vistos.clear());
    assinaturas.add(assinatura);
  }

  conectar(["PedidoCriado", "EstoqueInsuficiente"], 5, (evento) => {
    const { pedido } = evento;
    if (evento.tipo === "EstoqueInsuficiente") {
      const { pagamentoId } = evento;
      return tentar(() => servicos.pagamento.estornar(pedido, pagamentoId)).pipe(
        map(() => criarEvento("PagamentoEstornado", pedido, { pagamentoId })),
      );
    }

    return tentar(() => servicos.pagamento.cobrar(pedido)).pipe(
      map((resultado) => resultado.status === "aprovado"
        ? criarEvento("PagamentoAprovado", pedido, { pagamentoId: resultado.pagamentoId })
        : criarEvento("PagamentoRecusado", pedido, { motivo: "recusa" })),
      catchError(() => of(criarEvento("PagamentoRecusado", pedido, { motivo: "falha-tecnica" }))),
    );
  });

  conectar(["PagamentoAprovado"], 1, ({ pedido, pagamentoId }) =>
    tentar(() => servicos.estoque.reservar(pedido)).pipe(
      map((resultado) => resultado === "reservado"
        ? criarEvento("EstoqueReservado", pedido, {})
        : criarEvento("EstoqueInsuficiente", pedido, { pagamentoId })),
    ));

  conectar(["EstoqueReservado"], 5, ({ pedido }) =>
    tentar(() => servicos.transporte.agendar(pedido)).pipe(
      map(() => criarEvento("EnvioAgendado", pedido, {})),
    ));

  conectar(["EnvioAgendado"], 5, ({ pedido }) =>
    tentar(() => servicos.mensagens.notificar(pedido)).pipe(
      map(() => criarEvento("NotificacaoEnviada", pedido, {})),
    ));

  return assinaturas;
}
