import {
    catchError, defer, EMPTY, filter, finalize, first, map, mergeMap, Observable,
    retry, tap, timeout, timer,
} from "rxjs";
import { Evento, TipoEvento } from "../domain/eventos";
import { Atividades } from "./atividades";
import { Barramento } from "./barramento";

const intervalosRetry = [100, 200, 400];

export function tentar<T>(operacao: () => Observable<T>): Observable<T> {
    return defer(operacao).pipe(
        timeout({ first: 2_000 }),
        first(),
        retry({
            count: intervalosRetry.length,
            delay: (_erro, tentativa) => timer(intervalosRetry[tentativa - 1]),
        }),
    );
}

export class Processamento {
    constructor(
        private readonly barramento: Barramento,
        private readonly atividades: Atividades,
    ) {}

    consumir<T extends TipoEvento>(
        tipos: readonly T[],
        concorrencia: number,
        executar: (evento: Evento<T>) => Observable<void>,
    ) {
        const recebidos = new Set<string>();

        return this.barramento.eventos$.pipe(
            filter((evento): evento is Evento<T> => tipos.some(tipo => tipo === evento.tipo)),
            filter(evento => !recebidos.has(evento.eventId)),
            tap(evento => recebidos.add(evento.eventId)),
            // Registra também os eventos na fila de concorrência.
            map(evento => ({ evento, concluir: this.atividades.registrar() })),
            mergeMap(({ evento, concluir }) => defer(() => executar(evento)).pipe(
                catchError(() => EMPTY),
                finalize(concluir),
            ), concorrencia),
            finalize(() => recebidos.clear()),
        ).subscribe();
    }
}
